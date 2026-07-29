"""
Phlebotomist doorstep operations — Spec 3 write paths.

Two doorstep actions that happen at the patient's address:

    1. Tube scan validation — compare scanned tube against expected, warn on mismatch
    2. Doorstep add-on — add extra tests at the patient's doorstep

Both feed the existing `booking_tests` / `samples` schema from Spec 1.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user
from app.services.tube_derivation import derive_tubes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/phlebo", tags=["Phlebotomist Doorstep"])


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _first(result) -> dict:
    rows = _rows(result)
    return rows[0] if rows else {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_phlebo(user: dict) -> dict:
    if user.get("role") not in ("phlebotomist", "admin"):
        raise HTTPException(403, "Phlebotomists only.")
    return user


# ─── Booking samples read ─────────────────────────────────────────────────

@router.get("/booking-samples/{booking_id}")
async def get_booking_samples(
    booking_id: str,
    user: dict = Depends(get_current_user),
):
    """Samples expected for a booking — the tube list for doorstep collection."""
    _require_phlebo(user)

    samples = _rows(
        supabase.table("samples")
        .select("id, barcode, status, expected_tube_type_code, tube_type_code, "
                "tube_mismatch_ack, booking_subject_id")
        .eq("booking_id", booking_id)
        .order("created_at")
        .execute()
    )

    # Enrich with tube type display info
    tube_types = _rows(
        supabase.table("tube_types")
        .select("code, name, cap_colour")
        .eq("is_active", True)
        .execute()
    )
    tube_map = {t["code"]: t for t in tube_types}

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

    # Build test names per sample
    sample_tests_map = {}
    for st in sample_test_rows:
        sid = st["sample_id"]
        svc = bt_map.get(st.get("booking_test_id", ""), {})
        if svc:
            sample_tests_map.setdefault(sid, []).append(
                svc.get("name") or svc.get("code", "")
            )

    for s in samples:
        expected = s.get("expected_tube_type_code", "")
        tube_info = tube_map.get(expected, {})
        s["expected_tube_name"] = tube_info.get("name", expected)
        s["expected_cap_colour"] = tube_info.get("cap_colour", "")
        actual = s.get("tube_type_code", "")
        if actual:
            actual_info = tube_map.get(actual, {})
            s["actual_tube_name"] = actual_info.get("name", actual)
            s["actual_cap_colour"] = actual_info.get("cap_colour", "")
        s["subject_name"] = subject_names.get(s.get("booking_subject_id", ""), "")
        s["test_names"] = sample_tests_map.get(s["id"], [])

    return {"samples": samples, "count": len(samples)}


# ─── Tube scan validation ─────────────────────────────────────────────────

class ScanTubeRequest(BaseModel):
    sample_id: str
    scanned_tube_type_code: str


@router.post("/scan-tube")
async def scan_tube(
    body: ScanTubeRequest,
    user: dict = Depends(get_current_user),
):
    """Compare scanned tube against expected. Warns on mismatch but does NOT block."""
    _require_phlebo(user)

    sample = _first(
        supabase.table("samples")
        .select("id, expected_tube_type_code, tube_type_code, barcode, status")
        .eq("id", body.sample_id)
        .limit(1)
        .execute()
    )
    if not sample:
        raise HTTPException(404, "Sample not found.")

    expected = sample.get("expected_tube_type_code", "")
    scanned = body.scanned_tube_type_code
    match = expected.lower() == scanned.lower()

    # Update the actual tube type on the sample
    supabase.table("samples").update({
        "tube_type_code": scanned,
    }).eq("id", body.sample_id).execute()

    # Get display names
    tube_types = _rows(
        supabase.table("tube_types")
        .select("code, name, cap_colour")
        .in_("code", [expected, scanned])
        .execute()
    )
    tube_map = {t["code"]: t for t in tube_types}
    expected_info = tube_map.get(expected, {})
    scanned_info = tube_map.get(scanned, {})

    result = {
        "match": match,
        "expected_code": expected,
        "expected_name": expected_info.get("name", expected),
        "expected_colour": expected_info.get("cap_colour", ""),
        "scanned_code": scanned,
        "scanned_name": scanned_info.get("name", scanned),
        "scanned_colour": scanned_info.get("cap_colour", ""),
    }

    if not match:
        result["warning"] = (
            f"Tube mismatch! Expected {expected_info.get('name', expected)} "
            f"({expected_info.get('cap_colour', '')}) but scanned "
            f"{scanned_info.get('name', scanned)} ({scanned_info.get('cap_colour', '')}). "
            f"Acknowledge to proceed."
        )

    return result


@router.post("/scan-tube/{sample_id}/ack-mismatch")
async def ack_mismatch(
    sample_id: str,
    user: dict = Depends(get_current_user),
):
    """Acknowledge a tube type mismatch and proceed."""
    _require_phlebo(user)

    sample = _first(
        supabase.table("samples")
        .select("id, expected_tube_type_code, tube_type_code")
        .eq("id", sample_id)
        .limit(1)
        .execute()
    )
    if not sample:
        raise HTTPException(404, "Sample not found.")

    supabase.table("samples").update({
        "tube_mismatch_ack": True,
    }).eq("id", sample_id).execute()

    return {"success": True, "message": "Mismatch acknowledged."}


# ─── Doorstep add-on ──────────────────────────────────────────────────────

class DoorstepAddonRequest(BaseModel):
    booking_id: str
    home_service_id: str
    booking_subject_id: Optional[str] = None


@router.post("/doorstep-addon")
async def add_doorstep_test(
    body: DoorstepAddonRequest,
    user: dict = Depends(get_current_user),
):
    """Add a test at the doorstep. Creates booking_tests row + any new samples."""
    _require_phlebo(user)
    phlebo_id = user.get("sub")

    # Validate the booking exists
    booking = _first(
        supabase.table("bookings")
        .select("id, processing_center_id, patient_id")
        .eq("id", body.booking_id)
        .limit(1)
        .execute()
    )
    if not booking:
        raise HTTPException(404, "Booking not found.")

    # Validate the service exists
    service = _first(
        supabase.table("home_services")
        .select("id, name, base_price")
        .eq("id", body.home_service_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if not service:
        raise HTTPException(404, "Home service not found or inactive.")

    # Determine the subject — use provided or first subject of the booking
    subject_id = body.booking_subject_id
    if not subject_id:
        subjects = _rows(
            supabase.table("booking_subjects")
            .select("id")
            .eq("booking_id", body.booking_id)
            .limit(1)
            .execute()
        )
        if not subjects:
            raise HTTPException(400, "No booking subjects found for this booking.")
        subject_id = subjects[0]["id"]

    # Check for duplicate
    existing = _rows(
        supabase.table("booking_tests")
        .select("id")
        .eq("booking_subject_id", subject_id)
        .eq("home_service_id", body.home_service_id)
        .limit(1)
        .execute()
    )
    if existing:
        raise HTTPException(409, "This test is already part of the booking for this subject.")

    # Create the booking_test
    bt_id = str(uuid.uuid4())
    supabase.table("booking_tests").insert({
        "id": bt_id,
        "booking_id": body.booking_id,
        "booking_subject_id": subject_id,
        "home_service_id": body.home_service_id,
        "price_charged": float(service.get("base_price", 0)),
        "source": "doorstep_addon",
        "added_by": phlebo_id,
        "added_at": _now_iso(),
    }).execute()

    # Check if the new test needs a tube type not already drawn
    tubes_needed = _rows(
        supabase.table("home_service_tubes")
        .select("tube_type_code, volume_ml")
        .eq("home_service_id", body.home_service_id)
        .execute()
    )

    existing_samples = _rows(
        supabase.table("samples")
        .select("id, expected_tube_type_code")
        .eq("booking_id", body.booking_id)
        .eq("booking_subject_id", subject_id)
        .execute()
    )
    existing_tubes = {s.get("expected_tube_type_code") for s in existing_samples}

    new_samples = []
    for tube in tubes_needed:
        tube_code = tube.get("tube_type_code")
        if tube_code and tube_code not in existing_tubes:
            # Create a new sample for this tube type
            sample_id = str(uuid.uuid4())
            supabase.table("samples").insert({
                "id": sample_id,
                "barcode": None,
                "booking_id": body.booking_id,
                "patient_id": booking.get("patient_id"),
                "booking_subject_id": subject_id,
                "processing_center_id": booking.get("processing_center_id"),
                "expected_tube_type_code": tube_code,
                "status": "pending_collection",
            }).execute()

            # Link sample to the booking test
            supabase.table("sample_tests").insert({
                "sample_id": sample_id,
                "booking_test_id": bt_id,
            }).execute()

            new_samples.append(sample_id)
            existing_tubes.add(tube_code)
        else:
            # Tube already exists, just link the test to the existing sample
            for s in existing_samples:
                if s.get("expected_tube_type_code") == tube_code:
                    try:
                        supabase.table("sample_tests").insert({
                            "sample_id": s["id"],
                            "booking_test_id": bt_id,
                        }).execute()
                    except Exception:
                        pass  # duplicate key — already linked
                    break

    return {
        "success": True,
        "booking_test_id": bt_id,
        "test_name": service.get("name", ""),
        "new_samples_created": len(new_samples),
        "message": (
            f"Added {service.get('name', '')} at the doorstep."
            + (f" {len(new_samples)} new tube(s) required." if new_samples else "")
        ),
    }
