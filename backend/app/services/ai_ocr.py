"""
AI OCR Service — CallMedex Production Verification Pipeline
Uses Google Gemini Vision to extract structured data from uploaded certificates.
Supports: Medical licenses, Drug licenses, Nursing certificates, Hospital registrations.

Handles:
  - PDF documents (via PyMuPDF page-to-image conversion)
  - Image files (JPEG, PNG, WEBP)
  - Blurry / illegible documents → returns is_legible=false
  - Wrong document type (selfie, random photo) → returns is_valid_document=false
"""
import base64
import json
import logging
from typing import Dict, Any, Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ─── Role-specific Gemini prompts ─────────────────────────────────────────────
# Each prompt tells Gemini exactly what to extract based on the provider type.

EXTRACTION_PROMPTS = {
    "doctor": """
You are a highly accurate Indian medical document verification AI.
You are analyzing an uploaded image of a Doctor's medical registration certificate
(issued by NMC, State Medical Council, or equivalent Indian authority).

Extract the following information from the document. Be extremely precise with names and numbers.
Output ONLY valid JSON, no markdown, no backticks:
{
    "is_legible": true if the document text is clearly readable, false if too blurry/dark/cut-off,
    "is_valid_document": true if this appears to be a genuine medical registration certificate, false otherwise,
    "extracted_name": "Full name of the doctor as printed on the certificate, or null",
    "license_number": "Medical registration/license number exactly as printed, or null",
    "qualification": "Degree/qualification mentioned (e.g., MBBS, MD, MS), or null",
    "issuing_authority": "Name of the council/authority that issued the certificate, or null",
    "expiry_date": "Expiry date if visible (YYYY-MM-DD format), or null",
    "confidence_score": a number from 0.0 to 1.0 indicating your confidence in the extraction accuracy
}
""",
    "pharmacy": """
You are a highly accurate Indian pharmaceutical document verification AI.
You are analyzing an uploaded image of a Pharmacy's Drug License or Registration Certificate
(issued by State Drug Controller or Pharmacy Council of India).

Extract the following information. Be extremely precise with numbers and names.
Output ONLY valid JSON, no markdown, no backticks:
{
    "is_legible": true if the document text is clearly readable, false if too blurry/dark/cut-off,
    "is_valid_document": true if this appears to be a genuine drug license or pharmacy registration, false otherwise,
    "extracted_name": "Pharmacy name as printed on the document, or null",
    "registration_number": "Pharmacy registration number, or null",
    "drug_license_number": "Drug license number (e.g., DL-XX-XXXXX), or null",
    "pharmacist_name": "Name of the pharmacist in charge, or null",
    "gst_number": "GST number if visible, or null",
    "issuing_authority": "Name of the issuing authority, or null",
    "expiry_date": "Expiry date if visible (YYYY-MM-DD format), or null",
    "confidence_score": a number from 0.0 to 1.0 indicating your confidence in the extraction accuracy
}
""",
    "phlebotomist": """
You are a highly accurate Indian medical certification verification AI.
You are analyzing an uploaded image of a Phlebotomist's MLT/DMLT/BMLT certification
or laboratory technician certificate.

Extract the following information. Be extremely precise.
Output ONLY valid JSON, no markdown, no backticks:
{
    "is_legible": true if the document text is clearly readable, false if too blurry/dark/cut-off,
    "is_valid_document": true if this appears to be a genuine MLT/DMLT/lab technician certificate, false otherwise,
    "extracted_name": "Full name of the certificate holder, or null",
    "certification_number": "Certificate or registration number, or null",
    "qualification": "Qualification mentioned (e.g., DMLT, MLT, BMLT, BSc MLT), or null",
    "issuing_authority": "Name of the issuing institution or council, or null",
    "expiry_date": "Expiry date if visible (YYYY-MM-DD format), or null",
    "confidence_score": a number from 0.0 to 1.0 indicating your confidence in the extraction accuracy
}
""",
    "organization": """
You are a highly accurate Indian institutional document verification AI.
You are analyzing an uploaded image of a Hospital/Clinic/Diagnostic Center registration
certificate, municipal license, or accreditation certificate.

Extract the following information. Be extremely precise.
Output ONLY valid JSON, no markdown, no backticks:
{
    "is_legible": true if the document text is clearly readable, false if too blurry/dark/cut-off,
    "is_valid_document": true if this appears to be a genuine hospital/clinic registration or license, false otherwise,
    "extracted_name": "Organization/Hospital/Clinic name as printed, or null",
    "license_number": "Registration or license number, or null",
    "head_of_institution": "Name of the head/director if visible, or null",
    "issuing_authority": "Name of the issuing authority (municipality, health dept, etc.), or null",
    "expiry_date": "Expiry date if visible (YYYY-MM-DD format), or null",
    "confidence_score": a number from 0.0 to 1.0 indicating your confidence in the extraction accuracy
}
""",
    "nurse": """
You are a highly accurate Indian nursing document verification AI.
You are analyzing an uploaded image of a Nurse's registration certificate
(issued by State Nursing Council or Indian Nursing Council).

Extract the following information. Be extremely precise.
Output ONLY valid JSON, no markdown, no backticks:
{
    "is_legible": true if the document text is clearly readable, false if too blurry/dark/cut-off,
    "is_valid_document": true if this appears to be a genuine nursing registration/license, false otherwise,
    "extracted_name": "Full name of the nurse as printed, or null",
    "license_number": "Nursing registration/license number, or null",
    "qualification": "Qualification (e.g., GNM, BSc Nursing, ANM), or null",
    "issuing_authority": "Name of the nursing council or issuing body, or null",
    "expiry_date": "Expiry date if visible (YYYY-MM-DD format), or null",
    "confidence_score": a number from 0.0 to 1.0 indicating your confidence in the extraction accuracy
}
""",
}


class AIOCRService:
    """
    Extracts structured data from uploaded certificates using Google Gemini Vision.
    Returns a typed dictionary with the extracted fields plus legibility/validity flags.
    """

    @staticmethod
    def extract_certificate_data(
        file_bytes: bytes,
        mime_type: str,
        role: str,
    ) -> Dict[str, Any]:
        """
        Main entry point. Accepts raw file bytes and returns structured extraction.

        Args:
            file_bytes: Raw bytes of the uploaded file (image or PDF).
            mime_type: MIME type (e.g., 'image/jpeg', 'application/pdf').
            role: Provider role ('doctor', 'pharmacy', 'phlebotomist', 'organization', 'nurse').

        Returns:
            Dict with extracted fields, is_legible, is_valid_document, confidence_score.

        Raises:
            ValueError: If Gemini is not configured or extraction fails catastrophically.
        """
        if not settings.GEMINI_API_KEY:
            raise ValueError(
                "GEMINI_API_KEY is not configured. Cannot perform AI document verification."
            )

        prompt = EXTRACTION_PROMPTS.get(role)
        if not prompt:
            raise ValueError(f"No OCR extraction prompt defined for role: {role}")

        # Convert PDF pages to images if needed
        images = AIOCRService._prepare_images(file_bytes, mime_type)
        if not images:
            return {
                "is_legible": False,
                "is_valid_document": False,
                "error": "Could not read the uploaded file. Please upload a clear image or PDF.",
            }

        # Call Gemini Vision
        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.GEMINI_API_KEY)

            # Call Gemini Vision with model fallback strategy
            model_names = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"]
            response = None
            last_err = None
            for m_name in model_names:
                try:
                    model = genai.GenerativeModel(m_name)
                    response = model.generate_content([prompt, images[0]])
                    if response:
                        break
                except Exception as e:
                    last_err = e
            if not response and last_err:
                raise last_err

            response_text = (response.text or "").strip()

            # Clean markdown wrappers if Gemini adds them despite instructions
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            extracted = json.loads(response_text)
            logger.info(
                f"AI OCR extraction for {role}: legible={extracted.get('is_legible')}, "
                f"valid={extracted.get('is_valid_document')}, "
                f"confidence={extracted.get('confidence_score')}"
            )
            return extracted

        except json.JSONDecodeError as e:
            logger.error(f"Gemini returned unparseable JSON: {e}")
            return {
                "is_legible": False,
                "is_valid_document": False,
                "error": "AI could not parse the document. Please upload a clearer image.",
            }
        except Exception as e:
            logger.error(f"Gemini Vision extraction failed: {e}")
            raise ValueError(f"AI document analysis failed: {str(e)}")

    @staticmethod
    def _prepare_images(file_bytes: bytes, mime_type: str) -> list:
        """
        Convert the uploaded file to a list of PIL Images suitable for Gemini.
        Handles both direct images and PDF-to-image conversion.
        """
        from PIL import Image
        import io

        images = []

        if "pdf" in mime_type.lower():
            # Convert PDF pages to images using PyMuPDF
            try:
                import fitz  # PyMuPDF

                doc = fitz.open(stream=file_bytes, filetype="pdf")
                for page_num in range(min(doc.page_count, 3)):  # Max 3 pages
                    page = doc[page_num]
                    # Render at 2x resolution for better OCR
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                    img_bytes = pix.tobytes("png")
                    img = Image.open(io.BytesIO(img_bytes))
                    images.append(img)
                doc.close()
            except Exception as e:
                logger.error(f"PDF to image conversion failed: {e}")
                return []
        else:
            # Direct image upload
            try:
                img = Image.open(io.BytesIO(file_bytes))
                images.append(img)
            except Exception as e:
                logger.error(f"Image open failed: {e}")
                return []

        return images
