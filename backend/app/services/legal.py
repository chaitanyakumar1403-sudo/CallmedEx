"""
Legal Document Management Service — Next-Gen CallMedex
Handles version-controlled legal documents (MOUs, ToS, Privacy Policies)
and the secure acceptance workflow with full audit trail.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from app.database import supabase

logger = logging.getLogger(__name__)

# ─── Role-to-MOU-type mapping ─────────────────────────────────────────────
ROLE_MOU_MAP = {
    "doctor": "mou_doctor",
    "organization": "mou_organization",
    "pharmacy": "mou_pharmacy",
    "phlebotomist": "mou_phlebotomist",
    "nurse": "mou_nurse",
    "staff": "mou_staff",
    "ambulance": "mou_ambulance",
}

# ─── Fallback MOU content (used when DB is not available) ──────────────────
FALLBACK_MOU = {
    "doctor": {
        "title": "Doctor MOU — CallMedex",
        "content": (
            "MEMORANDUM OF UNDERSTANDING (MOU)\n\n"
            "Between CallMeDex (\"Platform\") and the Registering Doctor (\"Partner\").\n\n"
            "1. PURPOSE\nThis MOU outlines the terms under which the Partner agrees to provide "
            "medical consultation services through the CallMeDex platform.\n\n"
            "2. RESPONSIBILITIES OF PARTNER\n"
            "- Valid medical license (NMC/State Medical Council) required.\n"
            "- Honor all appointments booked through the Platform.\n"
            "- Maintain patient confidentiality per DPDP Act 2023.\n"
            "- Consultation fees managed centrally by the Platform.\n\n"
            "3. SETTLEMENT\n"
            "- All fees collected by Platform, settled per agreed commission structure.\n\n"
            "4. ACCEPTANCE\n"
            "By clicking 'I Agree', you legally bind yourself to these terms."
        ),
    },
    "organization": {
        "title": "Organization MOU — CallMedex",
        "content": (
            "MEMORANDUM OF UNDERSTANDING (MOU)\n\n"
            "Between CallMeDex (\"Platform\") and the Registering Organization (\"Partner\").\n\n"
            "1. PURPOSE\nThis MOU outlines the terms for listing healthcare facility and services.\n\n"
            "2. RESPONSIBILITIES\n"
            "- Genuine licenses, certificates, and qualifications.\n"
            "- Honor all appointments.\n"
            "- ABDM data sharing compliance.\n\n"
            "3. ACCEPTANCE\n"
            "By clicking 'I Agree', you legally bind yourself to these terms."
        ),
    },
    "pharmacy": {
        "title": "Pharmacy MOU — CallMedex",
        "content": (
            "MEMORANDUM OF UNDERSTANDING (MOU)\n\n"
            "Between CallMeDex and the Registering Pharmacy.\n\n"
            "1. Valid Drug License and Registration required.\n"
            "2. Timely fulfillment of all orders.\n"
            "3. Compliance with drug dispensing regulations.\n\n"
            "ACCEPTANCE: By clicking 'I Agree', you legally bind yourself to these terms."
        ),
    },
    "phlebotomist": {
        "title": "Phlebotomist MOU — CallMedex",
        "content": (
            "MEMORANDUM OF UNDERSTANDING (MOU)\n\n"
            "Between CallMeDex and the Registering Phlebotomist.\n\n"
            "1. Valid DMLT/MLT certification required.\n"
            "2. Prompt response to dispatch assignments.\n"
            "3. Maintain hygiene and safety standards.\n\n"
            "ACCEPTANCE: By clicking 'I Agree', you legally bind yourself to these terms."
        ),
    },
    "nurse": {
        "title": "Nurse MOU — CallMedex",
        "content": (
            "MEMORANDUM OF UNDERSTANDING (MOU)\n\n"
            "Between CallMeDex and the Registering Nurse.\n\n"
            "1. Valid nursing license required.\n"
            "2. Prompt response to dispatch requests.\n"
            "3. Follow medical protocols and maintain patient safety.\n\n"
            "ACCEPTANCE: By clicking 'I Agree', you legally bind yourself to these terms."
        ),
    },
    "staff": {
        "title": "Staff MOU — CallMedex",
        "content": (
            "MEMORANDUM OF UNDERSTANDING (MOU)\n\n"
            "Between CallMeDex and the Registering Staff Member.\n\n"
            "1. Use platform responsibly.\n"
            "2. Maintain patient data confidentiality.\n"
            "3. Follow organization's operating procedures.\n\n"
            "ACCEPTANCE: By clicking 'I Agree', you legally bind yourself to these terms."
        ),
    },
}


class LegalService:
    """Manages legal documents, MOU generation, and acceptance recording."""

    @staticmethod
    def get_active_document(role: str) -> dict:
        """
        Fetch the latest active MOU document for a specific role.
        Falls back to hardcoded content if DB is unavailable.
        """
        doc_type = ROLE_MOU_MAP.get(role)
        if not doc_type:
            return LegalService._get_fallback(role)

        if supabase:
            try:
                result = (
                    supabase.table("legal_documents")
                    .select("*")
                    .eq("document_type", doc_type)
                    .eq("is_active", True)
                    .order("effective_date", desc=True)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    return result.data[0]
            except Exception as e:
                logger.warning(f"Failed to fetch legal document from DB: {e}")

        return LegalService._get_fallback(role)

    @staticmethod
    def _get_fallback(role: str) -> dict:
        """Return hardcoded fallback MOU content."""
        fallback = FALLBACK_MOU.get(role, FALLBACK_MOU.get("staff"))
        return {
            "id": str(uuid.uuid4()),
            "document_type": ROLE_MOU_MAP.get(role, "mou_generic"),
            "version": "v1.0",
            "title": fallback["title"],
            "content_text": fallback["content"],
            "content_url": None,
            "applicable_roles": [role],
            "is_active": True,
            "effective_date": datetime.now(timezone.utc).date().isoformat(),
        }

    @staticmethod
    def create_pending_acceptance(user_id: str, document_id: str, token: str) -> dict:
        """Create a pending legal acceptance record."""
        acceptance_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        record = {
            "id": acceptance_id,
            "user_id": user_id,
            "document_id": document_id,
            "mou_token": token,
            "status": "pending",
            "created_at": now,
        }

        if supabase:
            try:
                supabase.table("legal_acceptances").insert(record).execute()
            except Exception as e:
                logger.warning(f"Failed to insert legal acceptance: {e}")

        return record

    @staticmethod
    def complete_acceptance(
        token: str,
        user_id: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> dict:
        """
        Mark a legal acceptance as complete.
        Records IP address, user agent, and timestamp for audit.
        """
        now = datetime.now(timezone.utc).isoformat()

        update_data = {
            "status": "accepted",
            "accepted_at": now,
            "ip_address": ip_address or "unknown",
            "user_agent": user_agent or "unknown",
        }

        if supabase:
            try:
                # Check if already accepted
                existing = (
                    supabase.table("legal_acceptances")
                    .select("status")
                    .eq("mou_token", token)
                    .execute()
                )
                if existing.data and existing.data[0]["status"] == "accepted":
                    return {"already_accepted": True}

                result = (
                    supabase.table("legal_acceptances")
                    .update(update_data)
                    .eq("mou_token", token)
                    .eq("user_id", user_id)
                    .execute()
                )
                if result.data:
                    return {"success": True, "acceptance": result.data[0]}
            except Exception as e:
                logger.warning(f"Failed to complete acceptance: {e}")

        return {"success": True, "acceptance": update_data}

    @staticmethod
    def log_audit(
        actor_id: Optional[str],
        action: str,
        entity_type: str,
        entity_id: Optional[str],
        details: dict = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """Record an immutable audit log entry."""
        record = {
            "id": str(uuid.uuid4()),
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": details or {},
            "ip_address": ip_address or "unknown",
            "user_agent": user_agent or "unknown",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if supabase:
            try:
                supabase.table("audit_log").insert(record).execute()
            except Exception as e:
                logger.warning(f"Audit log insert failed: {e}")

        # Always log to console as backup
        logger.info(f"AUDIT: {action} | {entity_type}:{entity_id} | actor:{actor_id}")
