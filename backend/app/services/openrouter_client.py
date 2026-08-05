"""
OpenRouter AI Client — Production multi-model gateway for CallMedex.

Wraps OpenRouter's OpenAI-compatible API to provide:
  1. Vision OCR  — extract text from lab report images (JPEG/PNG)
  2. Text Analysis — structured JSON report analysis
  3. Fallback     — backup analysis when MediAssist is unavailable

All models are configurable via env vars (OPENROUTER_VISION_MODEL, etc.)
so ops can hot-swap models without a deploy.
"""
import base64
import json
import logging
import urllib.request
import urllib.error
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

# ─── Custom Exceptions ──────────────────────────────────────────────────────

class OpenRouterError(Exception):
    """Base exception for OpenRouter API errors."""
    pass


class ImageExtractionError(OpenRouterError):
    """Raised when vision model cannot extract readable text from an image."""
    pass


class AnalysisError(OpenRouterError):
    """Raised when the analysis model returns an error or empty result."""
    pass


# ─── Client ──────────────────────────────────────────────────────────────────

class OpenRouterClient:
    """Thin, zero-dependency adapter for OpenRouter's chat completions API.

    Uses stdlib urllib so we don't add openai/httpx as new production deps.
    The API is OpenAI-compatible (POST /chat/completions with the same schema).
    """

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL.rstrip("/")

    def _call(
        self,
        model: str,
        messages: list,
        *,
        max_tokens: int = 4096,
        temperature: float = 0.1,
        response_format: Optional[dict] = None,
    ) -> str:
        """Make a chat completion request and return the text content."""
        if not self.api_key:
            raise OpenRouterError("OPENROUTER_API_KEY is not configured.")

        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if response_format:
            payload["response_format"] = response_format

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://callmedex.com",
            "X-Title": "CallMedex",
        }

        url = f"{self.base_url}/chat/completions"
        body = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(url, data=body, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.error(f"OpenRouter API error {e.code}: {err_body[:500]}")
            raise OpenRouterError(f"OpenRouter API returned {e.code}: {err_body[:200]}")
        except urllib.error.URLError as e:
            logger.error(f"OpenRouter connection error: {e}")
            raise OpenRouterError(f"Cannot reach OpenRouter API: {e}")
        except Exception as e:
            logger.error(f"OpenRouter unexpected error: {e}")
            raise OpenRouterError(f"OpenRouter request failed: {e}")

        # Extract text from OpenAI-compatible response
        choices = data.get("choices", [])
        if not choices:
            raise OpenRouterError("OpenRouter returned no choices.")

        content = choices[0].get("message", {}).get("content", "")
        if not content or not content.strip():
            raise OpenRouterError("OpenRouter returned empty content.")

        return content.strip()

    # ─── Vision OCR ──────────────────────────────────────────────────────

    def extract_text_from_image(
        self,
        image_bytes: bytes,
        content_type: str,
        model: Optional[str] = None,
    ) -> str:
        """Extract all text, tables, and values from a lab report image.

        Args:
            image_bytes: Raw image file bytes (JPEG or PNG).
            content_type: MIME type (e.g., 'image/jpeg').
            model: Override vision model; defaults to OPENROUTER_VISION_MODEL.

        Returns:
            Extracted text as a string.

        Raises:
            ImageExtractionError: If the image cannot be read or contains no text.
        """
        vision_model = model or settings.OPENROUTER_VISION_MODEL
        b64_image = base64.b64encode(image_bytes).decode("ascii")

        # Normalize content type
        mime = content_type.lower().split(";")[0].strip()
        if mime == "image/jpg":
            mime = "image/jpeg"

        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "You are a medical lab report transcription specialist. "
                            "Extract ALL text from this lab report image exactly as it appears. "
                            "Include:\n"
                            "- Patient name, age, gender, date\n"
                            "- All test names, values, units, and reference ranges\n"
                            "- Any flags (High/Low/Critical)\n"
                            "- Doctor/lab names and comments\n\n"
                            "Format as clean structured text with tables where applicable. "
                            "If you cannot read any part clearly, mark it as [UNREADABLE]. "
                            "Do NOT invent or fabricate any values."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime};base64,{b64_image}",
                        },
                    },
                ],
            }
        ]

        try:
            result = self._call(vision_model, messages, max_tokens=4096, temperature=0.05)
        except OpenRouterError:
            # Try fallback vision model (Gemini 3.5 Flash Lite)
            fallback_model = "google/gemini-3.5-flash-lite"
            logger.warning(
                f"Vision model {vision_model} failed, retrying with {fallback_model}"
            )
            try:
                result = self._call(
                    fallback_model, messages, max_tokens=4096, temperature=0.05
                )
            except OpenRouterError as e2:
                raise ImageExtractionError(
                    f"Could not extract text from image using either "
                    f"{vision_model} or {fallback_model}: {e2}"
                ) from e2

        # Validate extraction quality — reject placeholder/fabricated responses
        if not result or len(result.strip()) < 20:
            raise ImageExtractionError(
                "Vision model returned too little text — the image may be "
                "unreadable or not a lab report."
            )

        return result

    # ─── Text Analysis ───────────────────────────────────────────────────

    def analyze_report_text(
        self,
        extracted_text: str,
        prompt: str,
        model: Optional[str] = None,
    ) -> dict:
        """Analyze extracted lab report text using the analysis model.

        Args:
            extracted_text: Full text of the lab report.
            prompt: The system/analysis prompt.
            model: Override model; defaults to OPENROUTER_ANALYSIS_MODEL.

        Returns:
            Parsed JSON dict with analysis results.

        Raises:
            AnalysisError: If the analysis fails or returns invalid JSON.
        """
        analysis_model = model or settings.OPENROUTER_ANALYSIS_MODEL

        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": extracted_text},
        ]

        try:
            result = self._call(
                analysis_model,
                messages,
                max_tokens=4096,
                temperature=0.1,
                response_format={"type": "json_object"},
            )
        except OpenRouterError as e:
            raise AnalysisError(f"Report analysis failed: {e}") from e

        # Parse JSON response
        try:
            parsed = json.loads(result)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown fences
            if "```json" in result:
                json_block = result.split("```json")[1].split("```")[0].strip()
                try:
                    parsed = json.loads(json_block)
                except json.JSONDecodeError:
                    raise AnalysisError(
                        "Analysis model returned invalid JSON that could not be parsed."
                    )
            elif "```" in result:
                json_block = result.split("```")[1].split("```")[0].strip()
                try:
                    parsed = json.loads(json_block)
                except json.JSONDecodeError:
                    raise AnalysisError(
                        "Analysis model returned invalid JSON that could not be parsed."
                    )
            else:
                raise AnalysisError(
                    "Analysis model returned non-JSON content."
                )

        return parsed


# ─── Module-level singleton ──────────────────────────────────────────────────
openrouter_client = OpenRouterClient()
