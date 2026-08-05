"""
Tests for P0 Safety Fix — Image OCR Extraction.

Validates that:
1. JPEG/PNG lab report images produce real extracted text (not a placeholder).
2. Unreadable images return a clean error (not fabricated analysis).
3. The hardcoded placeholder string is unreachable.
4. PDF extraction still works correctly.
5. OpenRouter vision fallback chain works.
"""
import json
import pytest
from unittest.mock import patch, MagicMock
from app.services.groq_report_analyzer import GroqReportAnalyzerService
from app.services.openrouter_client import (
    OpenRouterClient,
    ImageExtractionError,
    AnalysisError,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

# Minimal valid JPEG (1x1 white pixel)
TINY_JPEG = bytes([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0xFF, 0xDA,
    0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7B, 0x94, 0x11, 0x00,
    0x00, 0x00, 0x00, 0xFF, 0xD9,
])

# Minimal valid PNG (1x1 white pixel)
TINY_PNG = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
])

MOCK_EXTRACTED_TEXT = """
Patient: John Doe, Age: 45, Gender: Male
Date: 2026-08-01

TEST                VALUE    UNIT     REFERENCE RANGE   FLAG
Hemoglobin          14.5     g/dL     13.0-17.0
Fasting Glucose     145      mg/dL    70-100             HIGH
HbA1c               7.8      %        4.0-5.6            HIGH
Total Cholesterol   210      mg/dL    <200               HIGH
TSH                 2.5      mIU/L    0.4-4.0
"""

MOCK_ANALYSIS_JSON = json.dumps({
    "plain_language_summary": "Your blood sugar levels are elevated.",
    "doctor_clinical_summary": "Elevated FBG (145 mg/dL) and HbA1c (7.8%).",
    "abnormal_flags": [
        {"marker": "Fasting Glucose", "value": "145 mg/dL", "status": "high", "reference_range": "70-100 mg/dL"},
        {"marker": "HbA1c", "value": "7.8%", "status": "high", "reference_range": "4.0-5.6%"},
    ],
    "recommendations": ["Consult endocrinologist", "Reduce sugar intake"],
})


# ── Test: Hardcoded placeholder is completely removed ─────────────────────────

def test_placeholder_string_unreachable():
    """The old hardcoded placeholder string must never appear in any code path."""
    import inspect
    source = inspect.getsource(GroqReportAnalyzerService)
    assert "Biomarker Evaluation: Blood Glucose" not in source
    assert "Lab Report Data Document" not in source


def test_fallback_analysis_removed():
    """The _fallback_analysis method that produced fabricated data must not exist."""
    assert not hasattr(GroqReportAnalyzerService, "_fallback_analysis")


# ── Test: Vision extraction path ──────────────────────────────────────────────

@patch("app.services.openrouter_client.openrouter_client")
def test_jpeg_image_calls_vision_model(mock_client):
    """JPEG input should call the OpenRouter vision model, not return a placeholder."""
    mock_client.extract_text_from_image.return_value = MOCK_EXTRACTED_TEXT
    result = GroqReportAnalyzerService.extract_text_from_file(TINY_JPEG, "image/jpeg")
    mock_client.extract_text_from_image.assert_called_once_with(TINY_JPEG, "image/jpeg")
    assert "Hemoglobin" in result
    assert "Biomarker Evaluation" not in result  # no placeholder


@patch("app.services.openrouter_client.openrouter_client")
def test_png_image_calls_vision_model(mock_client):
    """PNG input should also use the vision model."""
    mock_client.extract_text_from_image.return_value = MOCK_EXTRACTED_TEXT
    result = GroqReportAnalyzerService.extract_text_from_file(TINY_PNG, "image/png")
    mock_client.extract_text_from_image.assert_called_once_with(TINY_PNG, "image/png")
    assert "Hemoglobin" in result


@patch("app.services.openrouter_client.openrouter_client")
def test_vision_failure_returns_error_not_placeholder(mock_client):
    """If vision OCR fails, analyze_report_bytes must return an error dict — NOT fabricated data."""
    mock_client.extract_text_from_image.side_effect = ImageExtractionError(
        "Could not extract text"
    )
    result = GroqReportAnalyzerService.analyze_report_bytes(TINY_JPEG, "image/jpeg")
    assert result["error"] is True
    assert result["plain_language_summary"] == ""
    assert result["abnormal_flags"] == []
    # Must NOT contain the fabricated "stable baseline" text
    assert "stable baseline" not in result.get("plain_language_summary", "")


# ── Test: PDF extraction still works ──────────────────────────────────────────

def test_pdf_extraction_uses_pymupdf():
    """PDF extraction should still use PyMuPDF (fitz), not the vision model."""
    # Create a minimal valid PDF with text
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Hemoglobin: 14.5 g/dL\nGlucose: 145 mg/dL")
    pdf_bytes = doc.tobytes()
    doc.close()

    result = GroqReportAnalyzerService.extract_text_from_file(pdf_bytes, "application/pdf")
    assert "Hemoglobin" in result
    assert "14.5" in result


# ── Test: Full analysis pipeline with OpenRouter ──────────────────────────────

@patch("app.services.openrouter_client.openrouter_client")
@patch("app.services.groq_report_analyzer.settings")
def test_full_image_analysis_pipeline(mock_settings, mock_client):
    """Full end-to-end: image → vision OCR → analysis → structured result."""
    mock_settings.OPENROUTER_API_KEY = "test-key"
    mock_settings.GROQ_API_KEY = ""

    mock_client.extract_text_from_image.return_value = MOCK_EXTRACTED_TEXT
    mock_client.analyze_report_text.return_value = json.loads(MOCK_ANALYSIS_JSON)

    result = GroqReportAnalyzerService.analyze_report_bytes(TINY_JPEG, "image/jpeg")

    assert result.get("error") is not True
    assert "blood sugar" in result["plain_language_summary"].lower()
    assert len(result["abnormal_flags"]) == 2
    assert result["abnormal_flags"][0]["marker"] == "Fasting Glucose"


@patch("app.services.openrouter_client.openrouter_client")
@patch("app.services.groq_report_analyzer.settings")
def test_analysis_error_produces_error_dict(mock_settings, mock_client):
    """If both OpenRouter and Groq fail, return error dict — not fabricated data."""
    mock_settings.OPENROUTER_API_KEY = "test-key"
    mock_settings.GROQ_API_KEY = ""

    mock_client.extract_text_from_image.return_value = MOCK_EXTRACTED_TEXT
    mock_client.analyze_report_text.side_effect = AnalysisError("Service unavailable")

    result = GroqReportAnalyzerService.analyze_report_bytes(TINY_JPEG, "image/jpeg")

    assert result["error"] is True
    assert "temporarily unavailable" in result["message"]


# ── Test: OpenRouterClient unit tests ─────────────────────────────────────────

@patch("app.services.openrouter_client.settings")
def test_openrouter_client_no_api_key_raises(mock_settings):
    """Client should raise clear error when API key is not configured."""
    mock_settings.OPENROUTER_API_KEY = ""
    mock_settings.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
    client = OpenRouterClient()
    with pytest.raises(Exception, match="not configured"):
        client._call("test-model", [{"role": "user", "content": "hello"}])


def test_image_extraction_error_is_openrouter_error():
    """ImageExtractionError should be catchable as an OpenRouterError."""
    from app.services.openrouter_client import OpenRouterError
    assert issubclass(ImageExtractionError, OpenRouterError)
