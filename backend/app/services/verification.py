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
    async def run_full_verification(
        user_id: str,
        role: str,
        file_bytes: bytes,
        mime_type: str,
    ) -> Dict[str, Any]:
        """
        Run the complete AI-powered verification pipeline:
          1. Fetch profile from DB
          2. AI OCR extraction from uploaded certificate
          3. Strict matching against profile data
          4. Government API cross-check
          5. Update DB status + audit trail

        Returns a dict with final status, checks performed, and any rejection reasons.
        """
        rules = VerificationService.VERIFICATION_RULES.get(role)
        if not rules:
            return {
                "success": False,
                "status": "error",
                "message": f"No verification rules for role: {role}",
            }

        # ── Step 0: Fetch profile ──────────────────────────────────────
        profile = await VerificationService.get_provider_profile(user_id, role)
        user_record = await VerificationService._get_user_record(user_id)

        if not profile:
            return {
                "success": False,
                "status": "error",
                "message": f"No {role} profile found for user {user_id}",
            }

        # For roles where the name is on the users table (doctor, phlebotomist, nurse)
        stored_name = ""
        if rules["name_field"] == "full_name" and user_record:
            stored_name = (user_record.get("full_name") or "").strip()
        else:
            stored_name = (profile.get(rules["name_field"]) or "").strip()

        stored_license = (profile.get(rules["license_field"]) or "").strip()

        checks = []
        now = datetime.now(timezone.utc).isoformat()

        # ── Step 1: AI OCR Extraction ──────────────────────────────────
        logger.info(f"[VERIFY] Step 1: AI OCR for {role} user={user_id}")
        try:
            ocr_result = AIOCRService.extract_certificate_data(
                file_bytes=file_bytes,
                mime_type=mime_type,
                role=role,
            )
        except ValueError as e:
            return await VerificationService._finalize(
                user_id, role, "rejected_illegible",
                checks=[{"check": "ai_ocr", "passed": False, "detail": str(e)}],
                ocr_data=None,
            )

        # Check legibility
        if not ocr_result.get("is_legible", False):
            checks.append({
                "check": "document_legibility",
                "passed": False,
                "detail": "Document is too blurry, dark, or cut-off to read.",
            })
            return await VerificationService._finalize(
                user_id, role, "rejected_illegible",
                checks=checks, ocr_data=ocr_result,
            )

        checks.append({
            "check": "document_legibility",
            "passed": True,
            "detail": f"Document is legible (confidence: {ocr_result.get('confidence_score', 'N/A')})",
        })

        # Check valid document type
        if not ocr_result.get("is_valid_document", False):
            checks.append({
                "check": "document_type",
                "passed": False,
                "detail": "This does not appear to be a valid registration/license certificate.",
            })
            return await VerificationService._finalize(
                user_id, role, "rejected_invalid_document",
                checks=checks, ocr_data=ocr_result,
            )

        checks.append({
            "check": "document_type",
            "passed": True,
            "detail": f"Valid {role} certificate detected.",
        })

        # ── Step 2: Strict Matching ────────────────────────────────────
        logger.info(f"[VERIFY] Step 2: Strict matching for {role} user={user_id}")

        # Extract the name and license from OCR result
        extracted_name = VerificationService._get_extracted_name(ocr_result, role)
        extracted_license = VerificationService._get_extracted_license(ocr_result, role)

        # Name match (case-insensitive, whitespace-normalized)
        name_match = VerificationService._strict_match(stored_name, extracted_name)
        if not name_match:
            checks.append({
                "check": "name_match",
                "passed": False,
                "detail": (
                    f"MISMATCH: Profile name '{stored_name}' does not match "
                    f"certificate name '{extracted_name}'. "
                    f"Please ensure your registered name exactly matches your certificate."
                ),
            })
            return await VerificationService._finalize(
                user_id, role, "rejected_mismatch",
                checks=checks, ocr_data=ocr_result,
            )

        checks.append({
            "check": "name_match",
            "passed": True,
            "detail": f"Name matches: '{stored_name}' ↔ '{extracted_name}'",
        })

        # License number match
        license_match = VerificationService._strict_match(stored_license, extracted_license)
        if not license_match:
            checks.append({
                "check": "license_match",
                "passed": False,
                "detail": (
                    f"MISMATCH: Profile license '{stored_license}' does not match "
                    f"certificate license '{extracted_license}'. "
                    f"Please ensure your license number exactly matches your certificate."
                ),
            })
            return await VerificationService._finalize(
                user_id, role, "rejected_mismatch",
                checks=checks, ocr_data=ocr_result,
            )

        checks.append({
            "check": "license_match",
            "passed": True,
            "detail": f"License matches: '{stored_license}' ↔ '{extracted_license}'",
        })

        # ── Step 3: Government API Cross-Check ─────────────────────────
        logger.info(f"[VERIFY] Step 3: Gov API check for {role} user={user_id}")
        gov_result = await VerificationService._run_gov_check(
            role, profile, stored_name, stored_license
        )

        if gov_result.get("status") == "api_down":
            # Gov API is down — not the user's fault, flag but don't reject
            checks.append({
                "check": "gov_api_crosscheck",
                "passed": False,
                "detail": f"Government registry is temporarily unreachable. Your application is on hold.",
            })
            return await VerificationService._finalize(
                user_id, role, "flagged_api_down",
                checks=checks, ocr_data=ocr_result, gov_data=gov_result,
            )

        if not gov_result.get("is_valid", False):
            checks.append({
                "check": "gov_api_crosscheck",
                "passed": False,
                "detail": (
                    f"Government registry check failed: "
                    f"{gov_result.get('error', 'License not found in official records.')}"
                ),
            })
            return await VerificationService._finalize(
                user_id, role, "rejected_gov_api",
                checks=checks, ocr_data=ocr_result, gov_data=gov_result,
            )

        checks.append({
            "check": "gov_api_crosscheck",
            "passed": True,
            "detail": f"Verified in {gov_result.get('details', {}).get('registry', 'Government Registry')}.",
        })

        # ── All checks passed! ─────────────────────────────────────────
        logger.info(f"[VERIFY] ✅ All checks passed for {role} user={user_id}")
        return await VerificationService._finalize(
            user_id, role, "verified",
            checks=checks, ocr_data=ocr_result, gov_data=gov_result,
        )

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
    async def _finalize(
        user_id: str,
        role: str,
        status: str,
        checks: list,
        ocr_data: Optional[dict] = None,
        gov_data: Optional[dict] = None,
    ) -> Dict[str, Any]:
        """
        Update the DB with final verification status and create an immutable audit record.
        """
        rules = VerificationService.VERIFICATION_RULES[role]
        now = datetime.now(timezone.utc).isoformat()

        # Map internal detailed status to Supabase DB constraint allowed values: ('pending', 'verified', 'flagged', 'rejected')
        db_status = "verified" if status == "verified" else ("flagged" if status.startswith("flagged") else ("pending" if status == "pending" else "rejected"))

        if supabase:
            # Update role table status with DB-compliant status
            supabase.table(rules["table"]).update({
                "verification_status": db_status,
            }).eq("user_id", user_id).execute()

            # Create immutable audit document (stores db_status in column, report details in verification_notes)
            audit_report = {
                "role": role,
                "pipeline": "ai_ocr_gov_api",
                "checks": checks,
                "ocr_extraction": ocr_data,
                "gov_api_response": gov_data,
                "result_status": status,
                "verified_at": now,
            }
            supabase.table("documents").insert({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "document_type": "ai_verification_report",
                "file_url": "",
                "file_name": "ai_verification_report.json",
                "verification_status": db_status,
                "verification_notes": json.dumps(audit_report),
                "uploaded_at": now,
            }).execute()

        logger.info(f"[VERIFY] Final status for {role} user={user_id}: {status}")

        return {
            "success": status == "verified",
            "status": status,
            "message": VerificationService._status_message(status),
            "checks": checks,
            "source": rules["verification_source"],
        }

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
            "metadata": metadata or {},
            "verification_status": "pending",
            "created_at": now,
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
