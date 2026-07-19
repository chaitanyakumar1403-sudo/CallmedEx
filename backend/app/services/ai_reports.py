"""
Phase 4: AI Lab Report Interpretation Service
Uses PyMuPDF to extract text from PDFs, then Groq Llama 3 to analyze the text.
"""
import base64
import json
import logging
from typing import Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """
You are a highly skilled medical AI assistant acting as both a clinical diagnostician
(for the doctor) and a compassionate health educator (for the patient).

Carefully analyze the following extracted text from a medical lab report and extract all key information.

OUTPUT FORMAT — You MUST output ONLY valid JSON containing these exact keys:
{
    "plain_language_summary": "A highly compassionate, easy-to-understand paragraph (3-4 sentences) explaining what the results mean for the patient in plain English. Avoid medical jargon. Use a comforting, reassuring tone.",
    "doctor_clinical_summary": "A dense, jargon-heavy clinical paragraph that a doctor would read to get a quick overview. Include relevant values, units, and reference ranges. Mention any clinical correlations.",
    "abnormal_flags": [
        {
            "marker": "Name of the test (e.g. HbA1c)",
            "value": "The measured value with units",
            "status": "high, low, or critical",
            "reference_range": "The normal reference range"
        }
    ]
}

If there are no abnormal values, return an empty array [] for abnormal_flags.
If the text does not appear to be a medical lab report, return an appropriate message in plain_language_summary.

Lab Report Text:
{text}
"""


class AIReportService:

    @staticmethod
    def interpret_lab_report(file_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        """
        Extracts text from a PDF lab report using PyMuPDF and analyzes it using Groq.
        Returns structured JSON with patient-friendly and clinical summaries.
        """
        if not settings.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not set — returning simulated data.")
            return AIReportService._get_mock_data()

        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            
            extracted_text = ""

            # 1. Handle PDF by extracting text
            if "pdf" in mime_type.lower():
                try:
                    import fitz  # PyMuPDF
                    doc = fitz.open(stream=file_bytes, filetype="pdf")
                    for page in doc:
                        extracted_text += page.get_text() + "\n"
                except Exception as e:
                    logger.error(f"PyMuPDF failed to process PDF: {e}")
                    raise ValueError("Failed to extract text from the PDF document.")
            
            # 2. Handle native Image (Fallback to mock data since Groq has no Vision)
            else:
                logger.warning("Image upload detected. Groq Vision is decommissioned. Cannot process image text natively without OCR.")
                raise ValueError("Image uploads are currently not supported. Please upload a PDF.")

            if not extracted_text.strip():
                raise ValueError("Could not extract any readable text from the document. Please ensure it is a digital PDF and not a scanned image.")

            # 3. Call Groq Text API
            formatted_prompt = ANALYSIS_PROMPT.replace("{text}", extracted_text)

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "You are a precise JSON output generator. Output only valid JSON."},
                    {"role": "user", "content": formatted_prompt}
                ],
                temperature=0.1
            )
            
            return AIReportService._parse_response(response.choices[0].message.content)

        except Exception as e:
            logger.error(f"Groq analysis failed: {e}")
            raise ValueError(
                f"AI analysis failed: {str(e)}. "
            )

    @staticmethod
    def _parse_response(response_text: str) -> Dict[str, Any]:
        """Clean and parse the JSON response from Groq."""
        if not response_text:
            return AIReportService._get_mock_data()
            
        text = response_text.strip()

        try:
            parsed = json.loads(text)
            # Ensure required keys exist
            parsed.setdefault("plain_language_summary", "Summary not available.")
            parsed.setdefault("doctor_clinical_summary", "Clinical summary not available.")
            parsed.setdefault("abnormal_flags", [])
            return parsed
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Groq JSON response: {e}\nRaw: {text[:500]}")
            return {
                "plain_language_summary": text[:1000] if text else "Could not parse AI response.",
                "doctor_clinical_summary": "JSON parse error — see raw output.",
                "abnormal_flags": [],
            }

    @staticmethod
    def _get_mock_data() -> Dict[str, Any]:
        """Simulated response when GEMINI_API_KEY is not configured."""
        return {
            "plain_language_summary": (
                "Your recent blood test shows that most of your vitals are completely normal. "
                "However, your blood sugar (HbA1c) is slightly elevated at 6.2%, which is in "
                "the pre-diabetic range. This means you should watch your carbohydrate intake "
                "and consult with your doctor for guidance."
            ),
            "doctor_clinical_summary": (
                "Patient exhibits pre-diabetic markers with HbA1c at 6.2% (ref <5.7%). "
                "Fasting glucose 108 mg/dL (borderline). Liver enzymes (SGPT, SGOT) within "
                "normal limits. eGFR 92 mL/min/1.73m² indicating normal renal function. "
                "Lipid profile: LDL 128 mg/dL (borderline high). Recommend lifestyle "
                "modification and 3-month follow-up HbA1c."
            ),
            "abnormal_flags": [
                {
                    "marker": "HbA1c",
                    "value": "6.2%",
                    "status": "high",
                    "reference_range": "< 5.7%",
                },
                {
                    "marker": "Fasting Glucose",
                    "value": "108 mg/dL",
                    "status": "high",
                    "reference_range": "70–100 mg/dL",
                },
                {
                    "marker": "LDL Cholesterol",
                    "value": "128 mg/dL",
                    "status": "high",
                    "reference_range": "< 100 mg/dL",
                },
            ],
        }
