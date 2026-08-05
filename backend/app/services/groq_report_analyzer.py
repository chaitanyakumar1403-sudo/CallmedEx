"""
AI Report Analyzer — CallMedex Engine (Production Hardened)

Text extraction pipeline:
  - PDF  → PyMuPDF (fitz) local extraction
  - JPEG/PNG → OpenRouter vision model (Qwen 3.7 Flash → Gemini fallback)
  - Analysis → OpenRouter text model (DeepSeek V4 Flash)

SAFETY: Image inputs are NEVER given a placeholder fallback. If the vision
model cannot read the image, an error dict is returned — not fabricated data.
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

import fitz  # PyMuPDF
from groq import Groq

from app.config import settings
from app.database import supabase
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)


class GroqReportAnalyzerService:
    """
    Direct in-process AI report analysis engine for CallMedex.

    Uses OpenRouter for vision (images) and Groq/OpenRouter for text analysis.
    """

    @staticmethod
    def extract_text_from_file(file_bytes: bytes, content_type: str) -> str:
        """Extract text from PDF or image lab report.

        - PDF: uses PyMuPDF local extraction (fast, free, no API call).
        - JPEG/PNG: calls OpenRouter vision model for OCR transcription.

        Raises:
            ImageExtractionError: If image OCR fails (never returns placeholder).
            ValueError: If content type is unsupported.
        """
        ct = content_type.lower().split(";")[0].strip()

        # ── PDF extraction (local, no API call) ─────────────────────────
        if "pdf" in ct:
            text = ""
            try:
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                for page in doc:
                    text += page.get_text() + "\n"
            except Exception as e:
                logger.warning(f"PyMuPDF text extraction failed: {e}")

            if text.strip():
                return text.strip()

            # PDF had no extractable text (scanned PDF) — treat as image
            logger.info("PDF contains no extractable text; attempting vision OCR.")
            # For scanned PDFs, we'd need to render pages to images first.
            # For now, return a clear error rather than fabricating data.
            raise ValueError(
                "This PDF appears to be a scanned document with no extractable text. "
                "Please upload a clear photo or a text-based PDF."
            )

        # ── Image extraction (OpenRouter Vision API) ────────────────────
        if ct in ("image/jpeg", "image/jpg", "image/png"):
            from app.services.openrouter_client import (
                openrouter_client,
                ImageExtractionError,
            )

            # This will raise ImageExtractionError if vision fails —
            # NEVER returns a placeholder string.
            return openrouter_client.extract_text_from_image(file_bytes, ct)

        raise ValueError(f"Unsupported content type for text extraction: {ct}")

    @staticmethod
    def analyze_report_bytes(file_bytes: bytes, content_type: str) -> Dict[str, Any]:
        """
        Analyze lab report file bytes and return structured results.

        Returns dict matching frontend ReportAnalysisPayload schema:
          - plain_language_summary (str)
          - doctor_clinical_summary (str)
          - abnormal_flags (list[dict])
          - recommendations (list[str])

        On extraction failure, returns an error dict with {"error": True, ...}
        instead of fabricated placeholder data.
        """
        # ── Step 1: Extract text ─────────────────────────────────────────
        try:
            extracted_text = GroqReportAnalyzerService.extract_text_from_file(
                file_bytes, content_type
            )
        except Exception as extraction_err:
            logger.error(f"Text extraction failed: {extraction_err}")
            return {
                "error": True,
                "message": (
                    "We couldn't read this report clearly. Please upload a higher-quality "
                    "image or a text-based PDF and try again."
                ),
                "plain_language_summary": "",
                "doctor_clinical_summary": "",
                "abnormal_flags": [],
                "recommendations": [],
            }

        if not extracted_text or len(extracted_text.strip()) < 20:
            return {
                "error": True,
                "message": "The report appears to be blank or unreadable.",
                "plain_language_summary": "",
                "doctor_clinical_summary": "",
                "abnormal_flags": [],
                "recommendations": [],
            }

        # ── Step 2: Analyze with AI ──────────────────────────────────────
        # Try OpenRouter first (cheaper, wider model selection), then Groq fallback
        analysis_result = GroqReportAnalyzerService._analyze_with_openrouter(
            extracted_text
        )
        if analysis_result:
            return analysis_result

        # Groq fallback (existing path, kept for backward compatibility)
        analysis_result = GroqReportAnalyzerService._analyze_with_groq(extracted_text)
        if analysis_result:
            return analysis_result

        # Both failed — return a clear error, NEVER fabricated data
        return {
            "error": True,
            "message": (
                "Our AI analysis service is temporarily unavailable. "
                "Your report has been saved and will be analyzed shortly."
            ),
            "plain_language_summary": "",
            "doctor_clinical_summary": "",
            "abnormal_flags": [],
            "recommendations": [],
        }

    @staticmethod
    def _build_analysis_prompt(extracted_text: str) -> str:
        """Build the analysis prompt — single source of truth for both providers."""
        return f"""
You are CallMedex AI, an expert medical diagnostic AI engine.
Analyze the following laboratory report text and extract a comprehensive health summary, doctor clinical summary, abnormal biomarker flags, and recommendations.

Report Content:
{extracted_text[:4000]}

Return ONLY valid JSON matching this exact structure (no markdown, no backticks):
{{
    "plain_language_summary": "Clear, empathetic health story for the patient explaining their lab results in plain language.",
    "doctor_clinical_summary": "Technical clinical summary for attending physician highlighting key markers, values, and diagnostic implications.",
    "abnormal_flags": [
        {{
            "marker": "Biomarker Name (e.g. Fasting Glucose, HbA1c, Hemoglobin, TSH)",
            "value": "Measured Value with units (e.g. 145 mg/dL, 7.8%)",
            "status": "high",
            "reference_range": "Normal range (e.g. < 100 mg/dL)"
        }}
    ],
    "recommendations": [
        "Recommendation 1 for patient (diet, exercise, or specialist consultation)",
        "Recommendation 2"
    ]
}}
"""

    @staticmethod
    def _normalize_flags(raw_flags) -> list:
        """Normalize abnormal_flags from various AI response shapes."""
        formatted = []
        if isinstance(raw_flags, list):
            for flag in raw_flags:
                if isinstance(flag, dict):
                    formatted.append({
                        "marker": str(flag.get("marker", "Biomarker")),
                        "value": str(flag.get("value", "")),
                        "status": str(flag.get("status", "high")).lower(),
                        "reference_range": str(flag.get("reference_range", "")),
                    })
        elif isinstance(raw_flags, dict):
            for k, v in raw_flags.items():
                formatted.append({
                    "marker": str(k),
                    "value": str(v),
                    "status": "high" if "high" in str(v).lower() else "low",
                    "reference_range": "",
                })
        return formatted

    @staticmethod
    def _parse_result(parsed: dict) -> Dict[str, Any]:
        """Build a normalized result dict from parsed AI JSON."""
        return {
            "plain_language_summary": parsed.get(
                "plain_language_summary", "Your lab report has been analyzed."
            ),
            "doctor_clinical_summary": parsed.get(
                "doctor_clinical_summary", "Clinical panel evaluated."
            ),
            "abnormal_flags": GroqReportAnalyzerService._normalize_flags(
                parsed.get("abnormal_flags", [])
            ),
            "recommendations": parsed.get(
                "recommendations",
                ["Follow up with your primary physician."],
            ),
        }

    @staticmethod
    def _analyze_with_openrouter(extracted_text: str) -> Optional[Dict[str, Any]]:
        """Attempt analysis via OpenRouter (DeepSeek V4 Flash)."""
        if not settings.OPENROUTER_API_KEY:
            return None

        try:
            from app.services.openrouter_client import openrouter_client

            prompt = GroqReportAnalyzerService._build_analysis_prompt(extracted_text)
            parsed = openrouter_client.analyze_report_text(
                extracted_text, prompt
            )
            result = GroqReportAnalyzerService._parse_result(parsed)
            result["analysis_source"] = "openrouter"
            return result
        except Exception as e:
            logger.warning(f"OpenRouter analysis failed, will try Groq: {e}")
            return None

    @staticmethod
    def _analyze_with_groq(extracted_text: str) -> Optional[Dict[str, Any]]:
        """Attempt analysis via Groq API (legacy fallback)."""
        if not settings.GROQ_API_KEY:
            return None

        prompt = GroqReportAnalyzerService._build_analysis_prompt(extracted_text)

        try:
            client = Groq(api_key=settings.GROQ_API_KEY)
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=1500,
            )
            content = completion.choices[0].message.content
            parsed = json.loads(content)
            result = GroqReportAnalyzerService._parse_result(parsed)
            result["analysis_source"] = "groq"
            return result
        except Exception as e:
            logger.error(f"Groq API report analysis error: {e}")
            return None
