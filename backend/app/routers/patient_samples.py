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
}


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
        stage_info = STAGE_MAP.get(status, STAGE_MAP["pending_collection"])

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
        })
        out.append(safe)

    return {"samples": out, "count": len(out)}
