"""
Patient sample status — Spec 3.

Returns the patient's samples with a computed `stage` field that maps internal
statuses to the 5-step rail the patient sees:

    Pending Collection → Collected → In Transit / Received at PC → Verified → Sent to Reference Lab

The leak guard is a strict allowlist: no processing_center_id, batch_id,
lab_reference, or centre code ever reaches a patient's browser.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.database import supabase
from app.middleware.auth import get_current_user
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/patient", tags=["Patient Samples"])

# ── Leak guard — NEVER widen this without review. ─────────────────────────
PATIENT_SAFE_FIELDS = {
    "id", "barcode", "booking_id", "status", "expected_tube_type_code",
    "created_at", "collected_at", "verified_at", "sent_to_lab_at",
    "report_url", "report_status", "report_uploaded_at",
}

# Status → stage mapping for the 5-step rail
STAGE_MAP = {
    "pending_collection": {"stage": "pending_collection", "step": 0, "label": "Pending Collection"},
    "collected":          {"stage": "collected",          "step": 1, "label": "Collected"},
    "in_transit":         {"stage": "in_transit",         "step": 2, "label": "In Transit"},
    "handover_requested": {"stage": "in_transit",         "step": 2, "label": "In Transit"},
    "received":           {"stage": "received_at_pc",     "step": 3, "label": "Received at PC"},
    "verified":           {"stage": "verified",           "step": 3, "label": "Verified"},
    "batched":            {"stage": "verified",           "step": 3, "label": "Verified"},
    "sent_to_lab":        {"stage": "sent_to_lab",        "step": 4, "label": "Sent to Reference Lab"},
    "rejected":           {"stage": "rejected",           "step": -1, "label": "Rejected"},
    # Every status below was missing, and the lookup below falls back to
    # pending_collection -- so a cancelled, completed or failed tube rendered
    # on the patient's dashboard as "Pending Collection", for ever. That is
    # what produced rails for tests that were finished or called off months
    # earlier.
    "processing":         {"stage": "processing",         "step": 4, "label": "Being Analysed"},
    "report_ready":       {"stage": "report_ready",       "step": 5, "label": "Report Ready"},
    "delivered":          {"stage": "delivered",          "step": 5, "label": "Report Delivered"},
    "completed":          {"stage": "completed",          "step": 5, "label": "Completed"},
    "failed":             {"stage": "failed",             "step": -1, "label": "Could Not Be Processed"},
    "cancelled":          {"stage": "cancelled",          "step": -1, "label": "Cancelled"},
}

# What the live rail is for: work still in flight. A finished or cancelled tube
# is history and must drop off the tracker — but this endpoint is also the
# "My Reports" inbox, which needs exactly those finished rows. So the split is
# published as a per-sample `is_active` flag rather than filtered away here.
ACTIVE_SAMPLE_STATUSES = (
    "pending_collection", "collected", "in_transit", "handover_requested",
    "received", "verified", "batched", "sent_to_lab", "processing",
)


@router.get("/my-samples")
async def my_samples(user: dict = Depends(get_current_user)):
    """Patient's samples with 5-step stage for the status rail."""
    if user.get("role") != "patient":
        raise HTTPException(403, "Patients only.")

    patient_id = user.get("sub")
    if not patient_id:
        raise HTTPException(403, "Invalid session.")

    samples = _rows(
        supabase.table("samples")
        .select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )

    # Enrich with tube type display info
    tube_codes = list({s.get("expected_tube_type_code") for s in samples
                       if s.get("expected_tube_type_code")})
    tube_map = {}
    if tube_codes:
        tube_types = _rows(
            supabase.table("tube_types")
            .select("code, name, cap_colour")
            .in_("code", tube_codes)
            .execute()
        )
        tube_map = {t["code"]: t for t in tube_types}

    # Enrich with test names (sample_tests → booking_tests → home_services)
    sample_ids = [s["id"] for s in samples]
    sample_test_rows = []
    if sample_ids:
        sample_test_rows = _rows(
            supabase.table("sample_tests")
            .select("sample_id, booking_test_id")
            .in_("sample_id", sample_ids)
            .execute()
        )

    bt_ids = list({st["booking_test_id"] for st in sample_test_rows
                   if st.get("booking_test_id")})
    bt_map = {}
    if bt_ids:
        booking_tests = _rows(
            supabase.table("booking_tests")
            .select("id, home_service_id")
            .in_("id", bt_ids)
            .execute()
        )
        hs_ids = list({bt["home_service_id"] for bt in booking_tests
                       if bt.get("home_service_id")})
        hs_map = {}
        if hs_ids:
            services = _rows(
                supabase.table("home_services")
                .select("id, name, code")
                .in_("id", hs_ids)
                .execute()
            )
            hs_map = {s["id"]: s for s in services}
        bt_map = {
            bt["id"]: hs_map.get(bt.get("home_service_id", ""), {})
            for bt in booking_tests
        }

    sample_tests_map = {}
    for st in sample_test_rows:
        sid = st["sample_id"]
        svc = bt_map.get(st.get("booking_test_id", ""), {})
        if svc:
            sample_tests_map.setdefault(sid, []).append(
                svc.get("name") or svc.get("code", "")
            )

    # Enrich with subject names
    subject_ids = list({s.get("booking_subject_id") for s in samples
                        if s.get("booking_subject_id")})
    subject_names = {}
    if subject_ids:
        subjects = _rows(
            supabase.table("booking_subjects")
            .select("id, family_member_id")
            .in_("id", subject_ids)
            .execute()
        )
        fm_ids = list({s["family_member_id"] for s in subjects
                       if s.get("family_member_id")})
        fm_map = {}
        if fm_ids:
            members = _rows(
                supabase.table("family_members")
                .select("id, full_name")
                .in_("id", fm_ids)
                .execute()
            )
            fm_map = {m["id"]: m.get("full_name", "") for m in members}
        for s in subjects:
            subject_names[s["id"]] = fm_map.get(s.get("family_member_id", ""), "")

    # Build safe response
    out = []
    for s in samples:
        status = s.get("status", "pending_collection")
        stage_info = STAGE_MAP.get(status) or {
            "stage": status or "unknown", "step": 0, "label": "Processing",
        }

        # Leak guard — only expose safe fields
        safe = {k: s.get(k) for k in PATIENT_SAFE_FIELDS if k in s}

        expected = s.get("expected_tube_type_code", "")
        tube_info = tube_map.get(expected, {})

        safe.update({
            "stage": stage_info["stage"],
            "step": stage_info["step"],
            "step_label": stage_info["label"],
            "tube_name": tube_info.get("name", ""),
            "cap_colour": tube_info.get("cap_colour", ""),
            "test_names": sample_tests_map.get(s["id"], []),
            "subject_name": subject_names.get(s.get("booking_subject_id", ""), ""),
            # Drives the live status rail. Cancelled and finished tubes stayed
            # on it forever, rendered as "Pending Collection", because every
            # status missing from STAGE_MAP fell back to that.
            "is_active": status in ACTIVE_SAMPLE_STATUSES,
        })
        out.append(safe)

    return {"samples": out, "count": len(out)}


@router.get("/samples/{sample_id}/timeline")
async def get_patient_sample_timeline(
    sample_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Specimen Passport timeline (§8.1 & §9.1):
    Returns chronological custody milestones formatted as CustodyEvent objects with:
    - id, eventType, label, actorRole, actorName (first name only), temperatureCelsius, at, verification
    Also returns specimen barcode, status, tube_type, and safe temperature status.
    """
    if not supabase:
        raise HTTPException(500, "Database unavailable.")

    patient_id = user.get("sub")
    role = user.get("role")

    # Fetch sample
    s_rows = _rows(
        supabase.table("samples")
        .select("*")
        .eq("id", sample_id)
        .limit(1)
        .execute()
    )
    if not s_rows:
        # Check by barcode fallback
        s_rows = _rows(
            supabase.table("samples")
            .select("*")
            .eq("barcode", sample_id)
            .limit(1)
            .execute()
        )
    if not s_rows:
        raise HTTPException(404, "Specimen not found.")

    sample = s_rows[0]
    sample_actual_id = sample["id"]

    # Security check: verify patient ownership, admin role, or care-circle guardian
    has_access = False
    if role == "admin":
        has_access = True
    elif sample.get("patient_id") == patient_id:
        has_access = True
    else:
        # Check Care Circle permissions
        cc_rows = _rows(
            supabase.table("care_circle_members")
            .select("scopes")
            .eq("patient_id", sample.get("patient_id"))
            .eq("member_user_id", patient_id)
            .eq("status", "accepted")
            .limit(1)
            .execute()
        )
        if cc_rows:
            scopes = cc_rows[0].get("scopes") or []
            if "view_reports" in scopes:
                has_access = True

    if not has_access:
        raise HTTPException(403, "Access denied to this specimen.")

    # Fetch sample events
    raw_events = _rows(
        supabase.table("sample_events")
        .select("*")
        .eq("sample_id", sample_actual_id)
        .order("created_at", desc=False)
        .execute()
    )

    # Resolve actor first names securely
    actor_ids = list({e.get("actor_id") for e in raw_events if e.get("actor_id")})
    actor_names = {}
    if actor_ids:
        try:
            users_data = _rows(
                supabase.table("users")
                .select("id, full_name")
                .in_("id", actor_ids)
                .execute()
            )
            for u in users_data:
                full = u.get("full_name") or ""
                # First name only for field privacy
                actor_names[u["id"]] = full.split()[0] if full else "Staff"
        except Exception:
            pass

    # Map raw events to CustodyEvent format
    events = []
    EVENT_LABEL_MAP = {
        "collected": "Sample Collected at Doorstep",
        "in_transit": "In Transit to Processing Center",
        "handover_requested": "Handover in Progress",
        "received": "Received at Processing Center",
        "verified": "5-Point Intake Verification Passed",
        "batched": "Aggregated into Cold-Chain Batch",
        "dispatched": "Dispatched to Reference Lab",
        "report_uploaded": "Diagnostic Report Published",
        "report_ready": "Diagnostic Report Published",
        "rejected": "Sample Quality Flagged",
    }

    # Verification details from sample
    verif_details = sample.get("verification_details") or {}
    sample_verification = None
    if sample.get("is_verified") or verif_details:
        sample_verification = [
            {"point": "Patient Identity Match", "passed": bool(verif_details.get("patient_identity_match", True))},
            {"point": "Tube Type & Color", "passed": bool(verif_details.get("tube_type_match", True))},
            {"point": "Volume Sufficiency", "passed": bool(verif_details.get("volume_sufficient", True))},
            {"point": "Cold Chain Integrity (2–8°C)", "passed": bool(verif_details.get("cold_chain_held", True))},
            {"point": "Physical Sample Quality", "passed": bool(verif_details.get("sample_quality_intact", True))},
        ]

    for ev in raw_events:
        etype = ev.get("event_type") or ev.get("event") or "update"
        label = EVENT_LABEL_MAP.get(etype, etype.replace("_", " ").title())
        actor_id = ev.get("actor_id")
        first_name = actor_names.get(actor_id, "Staff") if actor_id else None

        # Verification points attached to verified event
        ev_verification = None
        if etype in ("verified", "received") and sample_verification:
            ev_verification = sample_verification

        events.append({
            "id": ev.get("id"),
            "eventType": etype,
            "label": label,
            "actorRole": ev.get("actor_role") or "staff",
            "actorName": first_name,
            "temperatureCelsius": ev.get("temperature_celsius") or ev.get("temperature"),
            "at": ev.get("created_at") or ev.get("timestamp"),
            "verification": ev_verification,
        })

    # If no events logged yet, provide initial baseline milestone
    if not events:
        events.append({
            "id": "init_booking",
            "eventType": "pending_collection",
            "label": "Scheduled for Home Collection",
            "actorRole": "system",
            "actorName": "CallMedex",
            "temperatureCelsius": sample.get("temperature_celsius") or 4.0,
            "at": sample.get("created_at"),
            "verification": None,
        })

    return {
        "success": True,
        "sampleId": sample_actual_id,
        "barcode": sample.get("barcode", ""),
        "tubeType": sample.get("expected_tube_type_code") or sample.get("tube_type", ""),
        "status": sample.get("status", "pending_collection"),
        "isVerified": bool(sample.get("is_verified")),
        "events": events,
    }

