"""
Legal Document Management Service — Next-Gen CallMedex
Handles version-controlled legal documents (MOUs, ToS, Privacy Policies)
and the secure acceptance workflow with full audit trail.
"""
import hashlib
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from app.database import supabase
from app.services.mou_loader import DOCUMENTS, documents_for, render_document

logger = logging.getLogger(__name__)


def acceptance_manifest(documents: List[dict]) -> List[dict]:
    """What an acceptance record keeps about each original: enough to prove,
    later, exactly which bytes were accepted."""
    return [
        {"key": d["key"], "filename": d["filename"], "title": d["title"], "sha256": d["sha256"]}
        for d in documents
    ]


# ─── Role-to-MOU-type mapping ─────────────────────────────────────────────
ROLE_MOU_MAP = {
    "doctor": "mou_doctor",
    "organization": "mou_organization",
    "pharmacy": "mou_pharmacy",
    "phlebotomist": "mou_phlebotomist",
    "nurse": "mou_nurse",
    "dietitian": "mou_dietitian",
    "physiotherapist": "mou_physiotherapist",
    "dentist": "mou_dentist",
    "staff": "mou_staff",
    "ambulance": "mou_ambulance",
}

# ─── Roles with no original agreement in legal_docs/mous/ ──────────────────
# Every other partner role is shown its signed original (app/services/
# mou_loader.py). These paraphrased texts are only for roles that have no
# original yet; they must never stand in for a role that has one.
FALLBACK_MOU = {
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
}


def _db_document(doc_type: str) -> Optional[dict]:
    """The legal_documents row for a role, if the table has one."""
    if not supabase or not doc_type:
        return None
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
        return result.data[0] if result.data else None
    except Exception as e:
        logger.warning(f"Failed to fetch legal document {doc_type} from DB: {e}")
        return None


class LegalService:
    """Manages legal documents, MOU delivery, and acceptance recording."""

    @staticmethod
    def get_partner_mou(
        role: str,
        *,
        phleb_type: Optional[str] = None,
        organization_type: Optional[str] = None,
        document_keys: Optional[List[str]] = None,
    ) -> dict:
        """
        The agreement(s) a partner accepts, as
        {"documents": [original, ...], "document": legacy single-document view}.

        `documents` holds the original .docx agreements rendered word for word
        (key, label, filename, title, sha256, html, text). `document_keys`, when
        given, pins the set — the dashboard passes the keys recorded at
        acceptance so a partner always sees what they signed, even if their
        organization type changes later.

        `document` keeps the shape older clients read (title, content_text,
        version): the full text of every original, or — for a role with no
        original (pharmacy) — the legal_documents row or its fallback.
        """
        role = (role or "").strip().lower()
        if document_keys:
            documents = [render_document(k) for k in document_keys if k in DOCUMENTS]
        else:
            documents = documents_for(role, phleb_type=phleb_type, organization_type=organization_type)

        doc_type = ROLE_MOU_MAP.get(role, "mou_generic")
        db_doc = _db_document(ROLE_MOU_MAP.get(role))

        if documents:
            legacy = {
                # The FK target for legal_acceptances.document_id, when seeded.
                "id": db_doc.get("id") if db_doc else None,
                "document_type": doc_type,
                "version": "sha256:" + ",".join(d["sha256"][:12] for d in documents),
                "title": " + ".join(d["title"] for d in documents),
                "content_text": "\n\n\n".join(d["text"] for d in documents),
                "content_url": None,
                "applicable_roles": [role],
                "is_active": True,
                "effective_date": None,
            }
        elif db_doc:
            legacy = db_doc
        else:
            fallback = FALLBACK_MOU.get(role, {})
            legacy = {
                "id": None,
                "document_type": doc_type,
                "version": "v1.0",
                "title": fallback.get("title") or f"{role.capitalize()} MOU — CallMedex",
                "content_text": fallback.get("content", ""),
                "content_url": None,
                "applicable_roles": [role],
                "is_active": True,
                "effective_date": None,
            }
        return {"documents": documents, "document": legacy}

    @staticmethod
    def get_active_document(role: str, subtype: Optional[str] = None) -> dict:
        """Legacy single-document view. `subtype` is a phleb_type or organization_type."""
        return LegalService.get_partner_mou(
            role, phleb_type=subtype, organization_type=subtype
        )["document"]

    @staticmethod
    def record_acceptance(
        *,
        user_id: str,
        token: str,
        document_id: Optional[str],
        documents: List[dict],
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Insert the accepted legal_acceptances row: who accepted, when, from
        where, and the exact originals (key, filename, SHA-256) they accepted.
        The token is stored hashed — the raw JWT carries the signup payload
        and can exceed Postgres' btree limit on the UNIQUE index.
        Returns the row, or None if it could not be written.
        """
        now = datetime.now(timezone.utc).isoformat()
        record = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "document_id": document_id,
            "mou_token": hashlib.sha256(token.encode("utf-8")).hexdigest(),
            "status": "accepted",
            "accepted_at": now,
            "ip_address": ip_address or "unknown",
            "user_agent": (user_agent or "unknown")[:500],
            "device_info": {"documents": acceptance_manifest(documents)},
            "created_at": now,
        }
        if not supabase:
            return record
        try:
            supabase.table("legal_acceptances").insert(record).execute()
            return record
        except Exception as e:
            logger.error(f"Failed to record MOU acceptance for user {user_id}: {e}")
            return None

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
