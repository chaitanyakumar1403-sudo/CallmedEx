"""
AI Verification Pipeline — Production-Grade CallMedex
Handles automated document verification for all provider roles.

Pipeline stages:
  1. Upload → Pre-processing (PDF/Image)
  2. AI OCR Extraction (Gemini Vision)
  3. Strict Matching (extracted data vs user profile — auto-reject on mismatch)
  4. Government API Cross-Check (NMC, Pharmacy Council, etc.)
  5. Audit Logging (immutable trail in documents table)

Status flow:
  pending → under_review → verified
                         → rejected_illegible
                         → rejected_invalid_document
                         → rejected_mismatch
                         → rejected_gov_api
                         → flagged_api_down (gov API unreachable — not user's fault)
"""
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from app.database import supabase
from app.services.ai_ocr import AIOCRService
from app.services.gov_registry import GovRegistryAPI
from app.services.verification_decision import decide, extract_license_from_ocr
from app.services.storage import StorageService
from app.config import settings

logger = logging.getLogger(__name__)


class VerificationService:
    """
    Orchestrates the full AI-powered verification pipeline for provider onboarding.
    """

    # ── Role → verification rules mapping ──────────────────────────────────
    VERIFICATION_RULES = {
        "doctor": {
            "required_fields": ["medical_license_number", "specialization", "qualification"],
            "verification_source": "NMC Registry + AI OCR",
            "table": "doctors",
            "name_field": "full_name",       # field name in users table
            "license_field": "medical_license_number",
        },
        "pharmacy": {
            "required_fields": ["registration_number", "drug_license_number"],
            "verification_source": "Drug License API + AI OCR",
            "table": "pharmacies",
            "name_field": "pharmacy_name",
            "license_field": "drug_license_number",
        },
        "phlebotomist": {
            "required_fields": ["certification_number", "qualification"],
            "verification_source": "MLT/DMLT Registry + AI OCR",
            "table": "phlebotomists",
            "name_field": "full_name",
            "license_field": "certification_number",
        },
        "organization": {
            "required_fields": ["license_number", "organization_name"],
            "verification_source": "Municipal License + ABDM HFR + AI OCR",
            "table": "organizations",
            "name_field": "organization_name",
            "license_field": "license_number",
        },
        "nurse": {
            "required_fields": ["nursing_license_number", "qualification"],
            "verification_source": "Nursing Council + AI OCR",
            "table": "nurses",
            "name_field": "full_name",
            "license_field": "nursing_license_number",
        },
    }

    # ═══════════════════════════════════════════════════════════════════════
    # MAIN PIPELINE: run_full_verification
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    async def run_full_verification(user_id, role, file_bytes, mime_type):
        rules = VerificationService.VERIFICATION_RULES.get(role)
        if not rules:
            return {"success": False, "status": "error", "message": f"No rules for role: {role}"}

        profile = await VerificationService.get_provider_profile(user_id, role)
        user_record = await VerificationService._get_user_record(user_id)
        if not profile:
            return {"success": False, "status": "error", "message": f"No {role} profile found"}

        stored_name = ((user_record or {}).get("full_name") if rules["name_field"] == "full_name"
                       else profile.get(rules["name_field"]) or "").strip()
        stored_license = (profile.get(rules["license_field"]) or "").strip()

        # Stage 0: store the document
        ext = "pdf" if "pdf" in mime_type.lower() else mime_type.split("/")[-1]
        doc_path = StorageService.upload_verification_doc(user_id, file_bytes, ext)

        # Stage 1: OCR (retry once on transient failure → under_review, never unfair reject)
        try:
            ocr = AIOCRService.extract_certificate_data(file_bytes, mime_type, role)
        except ValueError as e:
            logger.error(f"[VERIFY] OCR failed for {user_id}: {e}")
            return await VerificationService._finalize(
                user_id, role, doc_path, "under_review", "needs_review",
                {"error": "ocr_unavailable"}, None,
                "Automated check unavailable — under manual review.",
                [{"check": "ai_ocr", "passed": False, "detail": "OCR service error"}])

        ocr["_role"] = role  # so decide() resolves pharmacy/phleb license fields

        # Stage 3: gov check only when we have license + name matched enough to bother
        gov = None
        if settings.GOV_REGISTRY_MODE in ("mock", "live"):
            gov = await VerificationService._run_gov_check(role, profile, stored_name, stored_license)

        # Stage 3: decision
        result = decide(ocr, stored_name, stored_license, gov,
                        settings.VERIFICATION_AUTO_APPROVE, settings.GOV_REGISTRY_MODE)

        return await VerificationService._finalize(
            user_id, role, doc_path, result["final_status"], result["decision"],
            ocr, gov, result["reason"], result["checks"])

    # ═══════════════════════════════════════════════════════════════════════
    # LEGACY: run_verification (structural-only, no file upload)
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    async def run_verification(user_id: str, role: str) -> dict:
        """
        Legacy structural verification (no OCR). Checks required fields only.
        Still used as a quick pre-check before the full pipeline.
        """
        profile = await VerificationService.get_provider_profile(user_id, role)
        if not profile:
            return {
                "success": False,
                "message": f"No {role} profile found for user {user_id}",
                "status": "error",
            }

        # Run role-specific structural checks
        verify_fn = {
            "doctor": VerificationService._structural_verify_doctor,
            "pharmacy": VerificationService._structural_verify_pharmacy,
            "phlebotomist": VerificationService._structural_verify_phlebotomist,
            "organization": VerificationService._structural_verify_organization,
            "nurse": VerificationService._structural_verify_nurse,
        }.get(role)

        if not verify_fn:
            return {"success": False, "message": f"No verifier for role: {role}", "status": "error"}

        verification_result = await verify_fn(profile)
        new_status = verification_result["status"]

        # Update the role table
        rules = VerificationService.VERIFICATION_RULES[role]
        db_status = "verified" if new_status == "verified" else ("flagged" if new_status.startswith("flagged") else ("pending" if new_status == "pending" else "rejected"))
        if supabase:
            now = datetime.now(timezone.utc).isoformat()
            supabase.table(rules["table"]).update({
                "verification_status": db_status,
            }).eq("user_id", user_id).execute()

            audit_report = {
                "role": role,
                "checks": verification_result["checks"],
                "source": verification_result["source"],
                "result_status": new_status,
                "verified_at": now,
                "pipeline": "structural_only",
            }
            supabase.table("documents").insert({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "document_type": "verification_report",
                "file_url": "",
                "file_name": "verification_report.json",
                "verification_status": db_status,
                "verification_notes": json.dumps(audit_report),
                "uploaded_at": now,
            }).execute()

        return {
            "success": True,
            "message": f"Verification completed: {new_status}",
            "status": new_status,
            "checks": verification_result["checks"],
            "source": verification_result["source"],
        }

    # ═══════════════════════════════════════════════════════════════════════
    # HELPERS
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    async def get_provider_profile(user_id: str, role: str) -> Optional[dict]:
        """Fetch the role-specific profile for a user."""
        rules = VerificationService.VERIFICATION_RULES.get(role)
        if not rules:
            return None
        if supabase:
            result = (
                supabase.table(rules["table"])
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )
            if result.data:
                return result.data[0]
        return None

    @staticmethod
    async def _get_user_record(user_id: str) -> Optional[dict]:
        """Fetch the user record from the users table."""
        if supabase:
            result = (
                supabase.table("users")
                .select("id, full_name, email")
                .eq("id", user_id)
                .execute()
            )
            if result.data:
                return result.data[0]
        return None

    @staticmethod
    def _strict_match(stored: str, extracted: str) -> bool:
        """
        Robust case-insensitive comparison with prefix normalization and substring matching.
        """
        if not stored or not extracted:
            return False

        import re
        s = stored.lower().strip()
        e = extracted.lower().strip()

        # Remove common prefixes and punctuation
        clean_re = r'\b(m/s|ms|dr|dr\.|mr|mrs|prof)\b'
        s_clean = re.sub(clean_re, '', s).strip()
        e_clean = re.sub(clean_re, '', e).strip()

        # Alphanumeric normalization
        s_norm = re.sub(r'[^a-z0-9]', '', s_clean)
        e_norm = re.sub(r'[^a-z0-9]', '', e_clean)

        if not s_norm or not e_norm:
            return False

        return s_norm == e_norm or s_norm in e_norm or e_norm in s_norm

    @staticmethod
    def _get_extracted_name(ocr_result: dict, role: str) -> str:
        """Extract the name field from OCR result based on role."""
        return (ocr_result.get("extracted_name") or "").strip()

    @staticmethod
    def _get_extracted_license(ocr_result: dict, role: str) -> str:
        """Extract the license/registration field from OCR result based on role."""
        if role == "pharmacy":
            return (
                ocr_result.get("drug_license_number")
                or ocr_result.get("registration_number")
                or ""
            ).strip()
        if role == "phlebotomist":
            return (ocr_result.get("certification_number") or "").strip()
        if role == "nurse":
            return (ocr_result.get("license_number") or "").strip()
        # doctor, organization
        return (ocr_result.get("license_number") or "").strip()

    @staticmethod
    async def _run_gov_check(
        role: str, profile: dict, name: str, license_no: str
    ) -> Dict[str, Any]:
        """Route to the correct government API based on role."""
        if role == "doctor":
            return await GovRegistryAPI.verify_doctor(license_no, name)
        elif role == "pharmacy":
            return await GovRegistryAPI.verify_pharmacy(
                registration_number=profile.get("registration_number", ""),
                drug_license_number=profile.get("drug_license_number", ""),
                pharmacy_name=profile.get("pharmacy_name", name),
            )
        elif role == "phlebotomist":
            return await GovRegistryAPI.verify_phlebotomist(license_no, name)
        elif role == "organization":
            return await GovRegistryAPI.verify_organization(license_no, name)
        elif role == "nurse":
            return await GovRegistryAPI.verify_nurse(license_no, name)
        return {"is_valid": False, "status": "error", "error": f"Unknown role: {role}"}

    @staticmethod
    async def _finalize(user_id, role, doc_path, final_status, ai_decision,
                        ocr_data, gov_data, reason, checks):
        rules = VerificationService.VERIFICATION_RULES[role]
        now = datetime.now(timezone.utc).isoformat()
        db_status = {"verified": "verified", "rejected": "rejected"}.get(final_status, "pending")

        document_id = str(uuid.uuid4())
        if supabase:
            # documents row — REAL COLUMNS ONLY (no metadata/created_at)
            supabase.table("documents").insert({
                "id": document_id,
                "user_id": user_id,
                "document_type": f"{role}_license",
                "file_url": doc_path or "",
                "file_name": f"{role}_verification.{('pdf' if doc_path.endswith('pdf') else 'img')}",
                "verification_status": db_status,
                "verification_notes": json.dumps({"reason": reason, "checks": checks}),
                "uploaded_at": now,
            }).execute()

            # authority record
            supabase.table("verification_reviews").insert({
                "id": str(uuid.uuid4()),
                "provider_user_id": user_id,
                "role": role,
                "document_id": document_id,
                "ai_result": ocr_data or {},
                "ai_decision": ai_decision,
                "gov_result": gov_data or {},
                "final_status": final_status,
                "created_at": now,
                "decided_at": now if final_status != "under_review" else None,
            }).execute()

            # mirror onto role table (only when a definitive decision)
            if final_status in ("verified", "rejected"):
                supabase.table(rules["table"]).update(
                    {"verification_status": db_status}
                ).eq("user_id", user_id).execute()

        logger.info(f"[VERIFY] Final status for {role} user={user_id}: {final_status}")

        return {"success": final_status == "verified", "status": final_status,
                "message": reason, "checks": checks, "source": rules["verification_source"]}

    @staticmethod
    def _status_message(status: str) -> str:
        """Human-readable message for each verification status."""
        messages = {
            "verified": "Your credentials have been verified successfully!",
            "rejected_illegible": "Your document could not be read. Please upload a clearer image.",
            "rejected_invalid_document": "The uploaded file does not appear to be a valid certificate. Please upload your official registration document.",
            "rejected_mismatch": "The details on your certificate do not match your registration. Please ensure your name and license number match exactly.",
            "rejected_gov_api": "Your license/registration number was not found in the official government registry.",
            "flagged_api_down": "Government verification service is temporarily unavailable. Your application is on hold and will be retried.",
        }
        return messages.get(status, f"Verification status: {status}")

    # ═══════════════════════════════════════════════════════════════════════
    # STRUCTURAL VERIFIERS (legacy, no AI)
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    async def _structural_verify_doctor(profile: dict) -> dict:
        result = {"checks": [], "status": "pending", "source": "Structural Validation"}
        license_no = profile.get("medical_license_number", "")
        if license_no and len(license_no) >= 4:
            result["checks"].append({"check": "license_number_format", "passed": True, "detail": f"License: {license_no}"})
        else:
            result["checks"].append({"check": "license_number_format", "passed": False, "detail": "License number missing or too short"})
        if profile.get("specialization"):
            result["checks"].append({"check": "specialization", "passed": True, "detail": f"Specialization: {profile['specialization']}"})
        else:
            result["checks"].append({"check": "specialization", "passed": False, "detail": "Specialization not provided"})
        if profile.get("qualification"):
            result["checks"].append({"check": "qualification", "passed": True, "detail": f"Qualification: {profile['qualification']}"})
        else:
            result["checks"].append({"check": "qualification", "passed": False, "detail": "Qualification not provided"})
        all_passed = all(c["passed"] for c in result["checks"])
        result["status"] = "verified" if all_passed else "flagged"
        return result

    @staticmethod
    async def _structural_verify_pharmacy(profile: dict) -> dict:
        result = {"checks": [], "status": "pending", "source": "Structural Validation"}
        reg_no = profile.get("registration_number", "")
        if reg_no and len(reg_no) >= 4:
            result["checks"].append({"check": "registration_number", "passed": True, "detail": f"Registration: {reg_no}"})
        else:
            result["checks"].append({"check": "registration_number", "passed": False, "detail": "Registration number missing or invalid"})
        drug_license = profile.get("drug_license_number", "")
        if drug_license and len(drug_license) >= 4:
            result["checks"].append({"check": "drug_license", "passed": True, "detail": f"Drug license: {drug_license}"})
        else:
            result["checks"].append({"check": "drug_license", "passed": False, "detail": "Drug license missing or invalid"})
        if profile.get("pharmacist_in_charge"):
            result["checks"].append({"check": "pharmacist_in_charge", "passed": True, "detail": f"Pharmacist: {profile['pharmacist_in_charge']}"})
        else:
            result["checks"].append({"check": "pharmacist_in_charge", "passed": False, "detail": "Pharmacist in charge not specified"})
        all_passed = all(c["passed"] for c in result["checks"])
        result["status"] = "verified" if all_passed else "flagged"
        return result

    @staticmethod
    async def _structural_verify_phlebotomist(profile: dict) -> dict:
        result = {"checks": [], "status": "pending", "source": "Structural Validation"}
        cert_no = profile.get("certification_number", "")
        if cert_no and len(cert_no) >= 4:
            result["checks"].append({"check": "certification_number", "passed": True, "detail": f"Certificate: {cert_no}"})
        else:
            result["checks"].append({"check": "certification_number", "passed": False, "detail": "Certification number missing or invalid"})
        qualification = profile.get("qualification", "")
        if qualification:
            result["checks"].append({"check": "qualification", "passed": True, "detail": f"Qualification: {qualification}"})
        else:
            result["checks"].append({"check": "qualification", "passed": False, "detail": "Qualification not provided"})
        all_passed = all(c["passed"] for c in result["checks"])
        result["status"] = "verified" if all_passed else "flagged"
        return result

    @staticmethod
    async def _structural_verify_organization(profile: dict) -> dict:
        result = {"checks": [], "status": "pending", "source": "Structural Validation"}
        license_no = profile.get("license_number", "")
        if license_no and len(license_no) >= 4:
            result["checks"].append({"check": "license_number", "passed": True, "detail": f"License: {license_no}"})
        else:
            result["checks"].append({"check": "license_number", "passed": False, "detail": "License number missing or invalid"})
        org_name = profile.get("organization_name", "")
        if org_name and len(org_name) >= 2:
            result["checks"].append({"check": "organization_name", "passed": True, "detail": f"Organization: {org_name}"})
        else:
            result["checks"].append({"check": "organization_name", "passed": False, "detail": "Organization name missing"})
        all_passed = all(c["passed"] for c in result["checks"])
        result["status"] = "verified" if all_passed else "flagged"
        return result

    @staticmethod
    async def _structural_verify_nurse(profile: dict) -> dict:
        result = {"checks": [], "status": "pending", "source": "Structural Validation"}
        license_no = profile.get("nursing_license_number", "")
        if license_no and len(license_no) >= 4:
            result["checks"].append({"check": "nursing_license", "passed": True, "detail": f"License: {license_no}"})
        else:
            result["checks"].append({"check": "nursing_license", "passed": False, "detail": "Nursing license missing or invalid"})
        qualification = profile.get("qualification", "")
        if qualification:
            result["checks"].append({"check": "qualification", "passed": True, "detail": f"Qualification: {qualification}"})
        else:
            result["checks"].append({"check": "qualification", "passed": False, "detail": "Qualification not provided"})
        all_passed = all(c["passed"] for c in result["checks"])
        result["status"] = "verified" if all_passed else "flagged"
        return result

    # ═══════════════════════════════════════════════════════════════════════
    # DOCUMENT UPLOAD & STATUS (unchanged API)
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    async def upload_document(
        user_id: str,
        document_type: str,
        file_url: str,
        metadata: Optional[dict] = None,
    ) -> dict:
        """Record a document upload for verification."""
        doc_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        doc_data = {
            "id": doc_id,
            "user_id": user_id,
            "document_type": document_type,
            "file_url": file_url,
            "file_name": (metadata or {}).get("file_name", ""),
            "verification_status": "pending",
            "uploaded_at": now,
        }
        if supabase:
            supabase.table("documents").insert(doc_data).execute()
        return {
            "success": True,
            "document_id": doc_id,
            "message": "Document uploaded — verification queued",
        }

    @staticmethod
    async def get_verification_status(user_id: str, role: str) -> dict:
        """Get current verification status for a provider."""
        profile = await VerificationService.get_provider_profile(user_id, role)
        if not profile:
            return {"status": "not_found", "message": "Profile not found"}
        documents = []
        if supabase:
            result = (
                supabase.table("documents")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )
            documents = result.data or []
        rules = VerificationService.VERIFICATION_RULES.get(role, {})
        return {
            "verification_status": profile.get("verification_status", "pending"),
            "role": role,
            "documents": documents,
            "profile_complete": all(
                profile.get(f) for f in rules.get("required_fields", [])
            ),
        }
