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
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user
from app.routers.phlebo_stock import decrement_for_collection
from app.services.audit import AuditService
from app.services.samples import validate_sample_transition
from app.services.tube_derivation import derive_tubes
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/phlebo", tags=["Phlebotomist Doorstep"])


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
    scanned_barcode: Optional[str] = None


def _bind_barcode(
    sample: dict,
    scanned_barcode: Optional[str],
    actor_id: str = "",
) -> dict:
    """
    Bind a physical barcode to a sample record.

    Called from scan-tube (and later from the auto-decrement stock hook).
    The barcode is the sample's unique sticker ID; the existing tube-type
    comparison is unchanged.

    Returns a dict with keys:
      - barcode_warning: str | None  — set when a *different* barcode
        already exists on the sample (possible tube swap)
      - barcode_bound: bool           — True when we just wrote the barcode
    """
    if not scanned_barcode:
        return {"barcode_warning": None, "barcode_bound": False}

    existing = sample.get("barcode")
    if existing is None:
        # Normalise: strip whitespace and uppercase
        scanned_barcode = scanned_barcode.strip().upper()

        # First bind — write the barcode (best-effort: unique-index collision
        # from concurrent same-sticker scan is handled gracefully)
        try:
            supabase.table("samples").update({
                "barcode": scanned_barcode,
            }).eq("id", sample["id"]).execute()
        except Exception as e:
            if "23505" in str(e) or "duplicate key" in str(e).lower() or "unique constraint" in str(e).lower():
                raise HTTPException(409, f"Barcode '{scanned_barcode}' is already registered to another sample.")
            return {"barcode_warning": None, "barcode_bound": False}

        # Log the custody event
        try:
            supabase.table("sample_events").insert({
                "id": str(uuid.uuid4()),
                "sample_id": sample["id"],
                "event": "barcode_bound",
                "actor_id": actor_id,
                "actor_role": "phlebotomist",
                "notes": f"Barcode {scanned_barcode} bound to sample",
                "created_at": _now_iso(),
            }).execute()
        except Exception:
            pass  # log is non-critical for the state transition

        return {"barcode_warning": None, "barcode_bound": True}

    if existing != scanned_barcode:
        # Different barcode already set — warn, don't overwrite
        return {
            "barcode_warning": (
                f"Sample already has barcode {existing}. "
                f"The scanned barcode {scanned_barcode} does not match. "
                f"Verify the tube label."
            ),
            "barcode_bound": False,
        }

    # Same barcode already set — no-op
    return {"barcode_warning": None, "barcode_bound": False}


@router.post("/scan-tube")
async def scan_tube(
    body: ScanTubeRequest,
    user: dict = Depends(get_current_user),
):
    """Compare scanned tube against expected. Warns on mismatch but does NOT block.

    Also binds the physical barcode to the sample record when `scanned_barcode`
    is provided (camera scan from the phlebotomist's device)."""
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
    try:
        supabase.table("samples").update({
            "tube_type_code": scanned,
        }).eq("id", body.sample_id).execute()
    except Exception as e:
        if "23505" in str(e) or "duplicate key" in str(e).lower() or "unique constraint" in str(e).lower():
            raise HTTPException(409, f"Barcode '{body.scanned_barcode}' is already registered to another sample.")
        raise e

    # Bind barcode (if provided)
    barcode_result = _bind_barcode(sample, body.scanned_barcode, actor_id=user.get("sub", ""))

    # Auto-decrement stock (best-effort, never blocks)
    phlebo_id = user.get("sub", "")
    decrement_for_collection(phlebo_id, scanned)

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
        # Barcode binding fields
        "barcode_bound": barcode_result["barcode_bound"],
        "barcode_warning": barcode_result["barcode_warning"],
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

    # ── Upsell incentive accrual ────────────────────────────────────────
    # Best-effort: if the rule row is missing, log and skip — never fail the addon.
    _accrue_upsell_incentive(phlebo_id, body.booking_id, bt_id, float(service.get("base_price", 0)))

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


# ── Upsell incentive helpers ───────────────────────────────────────────────────


def _accrue_upsell_incentive(
    phlebo_id: str,
    booking_id: str,
    booking_test_id: str,
    price_charged: float,
) -> None:
    """
    Create a pending incentive_ledger entry for a doorstep upsell.

    Best-effort — if the rule row is missing or inactive, log and skip
    so the addon never fails when the incentive tables are unwired.
    """
    if price_charged <= 0:
        return

    try:
        rules = _rows(
            supabase.table("incentive_rules")
            .select("id, code, reward_type, reward_value, is_active")
            .eq("code", "PHLEBO_UPSELL_SVC")
            .limit(1)
            .execute()
        )
    except Exception:
        logger.info("incentive_rules table not available — skipping upsell incentive.")
        return

    if not rules:
        logger.info("PHLEBO_UPSELL_SVC rule not found — skipping upsell incentive.")
        return

    rule = rules[0]
    if not rule.get("is_active", True):
        logger.info("PHLEBO_UPSELL_SVC rule is inactive — skipping upsell incentive.")
        return

    reward_type = rule.get("reward_type", "percent")
    reward_value = float(rule.get("reward_value", 0))

    if reward_type == "percent":
        reward_amount = round(price_charged * reward_value / 100.0, 2)
    else:
        reward_amount = round(reward_value, 2)  # flat

    if reward_amount <= 0:
        return

    try:
        supabase.table("incentive_ledger").insert({
            "provider_user_id": phlebo_id,
            "rule_id": rule["id"],
            "booking_id": booking_id,
            "base_amount": round(price_charged, 2),
            "reward_amount": reward_amount,
            "status": "pending",
            "notes": f"Doorstep upsell — booking_test {booking_test_id}",
        }).execute()
        logger.info(
            "Accrued upsell incentive: phlebo=%s bt=%s amount=%s",
            phlebo_id, booking_test_id, reward_amount,
        )
    except Exception as e:
        logger.error("Failed to accrue upsell incentive: %s", e)


# ─── Doorstep catalog (tests + packages) ──────────────────────────────────

@router.get("/doorstep-catalog")
async def doorstep_catalog(
    q: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """All active home services and health packages — no location gating.

    The phlebotomist is already at the patient's doorstep, so there is no
    need to resolve a processing centre for pricing. Base prices are used.
    This powers the "+ Add Test" modal on the Doorstep Collection tab.
    """
    _require_phlebo(user)

    # Individual tests
    services = _rows(
        supabase.table("home_services")
        .select("id, code, name, category, service_kind, base_price, "
                "home_collection_available, description")
        .eq("is_active", True)
        .order("name")
        .execute()
    )

    # Normalise price key for frontend
    for svc in services:
        svc["price"] = svc.get("base_price", 0)
        svc["type"] = "test"

    if q:
        needle = q.strip().lower()
        services = [s for s in services
                    if needle in (s.get("name") or "").lower()
                    or needle in (s.get("code") or "").lower()]

    # Health packages (from health_packages table if it exists, otherwise empty)
    packages = []
    try:
        packages = _rows(
            supabase.table("health_packages")
            .select("id, name, tests_included, mrp, price, is_active")
            .eq("is_active", True)
            .order("name")
            .execute()
        )
        for pkg in packages:
            pkg["type"] = "package"
    except Exception:
        # Table may not exist — fall back to empty
        packages = []

    return {
        "services": services,
        "packages": packages,
        "total": len(services) + len(packages),
    }


# ─── Sample Collection Verification Workflow ───────────────────────────────

import re

BARCODE_REGEX = re.compile(r"^[A-Z0-9\-]{6,32}$")


def _validate_barcode_format(barcode_str: str) -> str:
    """Validate barcode string length, character set, and format."""
    cleaned = (barcode_str or "").strip().upper()
    if not cleaned or not BARCODE_REGEX.match(cleaned):
        raise HTTPException(
            400,
            f"Invalid barcode format '{barcode_str}'. Barcodes must be 6-32 alphanumeric characters or hyphens.",
        )
    return cleaned


class VerifyBarcodeRequest(BaseModel):
    barcode: str
    sample_id: Optional[str] = None
    booking_id: Optional[str] = None
    patient_id: Optional[str] = None


@router.post("/verify-barcode")
async def verify_barcode(
    body: VerifyBarcodeRequest,
    user: dict = Depends(get_current_user),
):
    """
    Mandatory verification step immediately after a barcode is scanned.
    Lookups barcode in DB, retrieves context (Booking, Patient, Sample, Tests,
    Collection Status, Processing Center), evaluates safety rules across 4 cases,
    and returns context WITHOUT mutating sample collection status.
    """
    _require_phlebo(user)
    raw_barcode = _validate_barcode_format(body.barcode)

    # 1. Primary lookup by barcode in samples table
    sample = _first(
        supabase.table("samples")
        .select("*")
        .eq("barcode", raw_barcode)
        .limit(1)
        .execute()
    )

    # 2. Secondary lookup: if sample_id provided and sample.barcode is empty, check if sample exists
    if not sample and body.sample_id:
        sample_by_id = _first(
            supabase.table("samples")
            .select("*")
            .eq("id", body.sample_id)
            .limit(1)
            .execute()
        )
        if sample_by_id:
            # Check if raw_barcode belongs to ANOTHER sample
            other_sample = _first(
                supabase.table("samples")
                .select("id, patient_id, booking_id")
                .eq("barcode", raw_barcode)
                .neq("id", body.sample_id)
                .limit(1)
                .execute()
            )
            if other_sample:
                # Scanned barcode belongs to another sample/patient! -> CASE 4
                other_patient_name = "Another Patient"
                if other_sample.get("patient_id"):
                    usr = _first(supabase.table("users").select("full_name").eq("id", other_sample["patient_id"]).limit(1).execute())
                    other_patient_name = usr.get("full_name", "Another Patient")
                return {
                    "case": "DIFFERENT_PATIENT",
                    "valid": False,
                    "reason": "DIFFERENT_PATIENT",
                    "message": "This barcode belongs to another patient.",
                    "barcode": raw_barcode,
                    "patient_name": other_patient_name,
                    "booking_id": other_sample.get("booking_id"),
                    "allowed_actions": ["scan_again"],
                }
            sample = sample_by_id

    # CASE 2: BARCODE NOT FOUND
    if not sample:
        return {
            "case": "BARCODE_NOT_FOUND",
            "valid": False,
            "reason": "BARCODE_NOT_FOUND",
            "message": "Barcode not recognized. This barcode is not assigned to any booking.",
            "barcode": raw_barcode,
            "allowed_actions": ["scan_again", "manual_entry"],
        }

    # Retrieve related context
    patient_id = sample.get("patient_id")
    booking_id = sample.get("booking_id")

    patient_name = "Patient"
    if patient_id:
        p_row = _first(supabase.table("users").select("full_name, phone").eq("id", patient_id).limit(1).execute())
        patient_name = p_row.get("full_name") or p_row.get("phone") or "Patient"

    booking = {}
    if booking_id:
        booking = _first(supabase.table("bookings").select("id, status, address, city, scheduled_date").eq("id", booking_id).limit(1).execute())

    # CASE 4: BARCODE BELONGS TO DIFFERENT PATIENT
    if body.patient_id and patient_id and str(patient_id) != str(body.patient_id):
        return {
            "case": "DIFFERENT_PATIENT",
            "valid": False,
            "reason": "DIFFERENT_PATIENT",
            "message": "This barcode belongs to another patient.",
            "barcode": raw_barcode,
            "patient_name": patient_name,
            "booking_id": booking_id,
            "allowed_actions": ["scan_again"],
        }

    if body.booking_id and booking_id and str(booking_id) != str(body.booking_id):
        return {
            "case": "DIFFERENT_PATIENT",
            "valid": False,
            "reason": "DIFFERENT_PATIENT",
            "message": "This barcode belongs to another booking.",
            "barcode": raw_barcode,
            "patient_name": patient_name,
            "booking_id": booking_id,
            "allowed_actions": ["scan_again"],
        }

    # SAFETY CHECK: CANCELLED BOOKING
    if booking.get("status") == "cancelled":
        return {
            "case": "BOOKING_CANCELLED",
            "valid": False,
            "reason": "BOOKING_CANCELLED",
            "message": "This booking has been cancelled.",
            "barcode": raw_barcode,
            "patient_name": patient_name,
            "booking_id": booking_id,
            "allowed_actions": ["scan_again"],
        }

    # CASE 3: BARCODE ALREADY COLLECTED
    collector_name = None
    if sample.get("phlebotomist_user_id"):
        phlebo_user = _first(supabase.table("users").select("full_name").eq("id", sample["phlebotomist_user_id"]).limit(1).execute())
        collector_name = phlebo_user.get("full_name") or sample["phlebotomist_user_id"]

    if sample.get("status") in ("collected", "in_transit", "handover_requested", "received", "processing", "report_ready", "completed") or sample.get("collected_at"):
        return {
            "case": "ALREADY_COLLECTED",
            "valid": False,
            "reason": "ALREADY_COLLECTED",
            "message": "Sample already collected.",
            "barcode": raw_barcode,
            "sample_id": sample["id"],
            "booking_id": booking_id,
            "patient_name": patient_name,
            "collected_by": collector_name,
            "collected_at": sample.get("collected_at"),
            "allowed_actions": ["view_details", "scan_another"],
        }

    # Enrich tube details & ordered tests
    expected_code = sample.get("expected_tube_type_code", "")
    tube_info = {}
    if expected_code:
        t_row = _first(supabase.table("tube_types").select("name, cap_colour").eq("code", expected_code).limit(1).execute())
        tube_info = t_row

    # Ordered tests
    ordered_tests = []
    sample_tests = _rows(supabase.table("sample_tests").select("booking_test_id").eq("sample_id", sample["id"]).execute())
    bt_ids = [st["booking_test_id"] for st in sample_tests if st.get("booking_test_id")]
    if bt_ids:
        b_tests = _rows(supabase.table("booking_tests").select("home_service_id").in_("id", bt_ids).execute())
        hs_ids = [bt["home_service_id"] for bt in b_tests if bt.get("home_service_id")]
        if hs_ids:
            h_svcs = _rows(supabase.table("home_services").select("name").in_("id", hs_ids).execute())
            ordered_tests = [s["name"] for s in h_svcs if s.get("name")]

    pc_name = None
    if sample.get("processing_center_id"):
        pc_row = _first(supabase.table("processing_centers").select("name, code").eq("id", sample["processing_center_id"]).limit(1).execute())
        pc_name = pc_row.get("name") or pc_row.get("code")

    # CASE 1: VALID BARCODE
    return {
        "case": "VALID",
        "valid": True,
        "message": "Barcode Scanned Successfully",
        "barcode": raw_barcode,
        "sample_id": sample["id"],
        "booking_id": booking_id,
        "patient_id": patient_id,
        "patient_name": patient_name,
        "expected_tube_code": expected_code,
        "expected_tube_name": tube_info.get("name", expected_code),
        "expected_cap_colour": tube_info.get("cap_colour", ""),
        "ordered_tests": ordered_tests,
        "collection_address": booking.get("address", ""),
        "collection_status": sample.get("status", "pending_collection"),
        "collected_at": None,
        "processing_center_name": pc_name,
        "allowed_actions": ["confirm_collection", "rescan_tube", "scan_again"],
    }


class ConfirmSampleCollectionRequest(BaseModel):
    sample_id: str
    barcode: str
    rescan_barcode: Optional[str] = None  # Re-scan confirmation barcode for chain of custody
    lat: Optional[float] = None
    lng: Optional[float] = None
    device_id: Optional[str] = None
    device_model: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    idempotency_key: Optional[str] = None


ConfirmCollectionRequest = ConfirmSampleCollectionRequest


@router.post("/confirm-sample-collection")
@router.post("/confirm-sample-link")
@router.post("/confirm-collection")
async def confirm_sample_collection(
    body: ConfirmSampleCollectionRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """
    Persists collection status ONLY upon explicit phlebotomist confirmation.
    Validates barcode format, enforces re-scan confirmation match, locks barcode,
    captures extended device metadata, and updates sample status to 'collected'.
    """
    _require_phlebo(user)
    phlebo_id = user.get("sub", "")
    raw_barcode = _validate_barcode_format(body.barcode)

    # 1. Re-scan Confirmation Match Guard
    if body.rescan_barcode:
        rescan_clean = _validate_barcode_format(body.rescan_barcode)
        if rescan_clean != raw_barcode:
            raise HTTPException(
                400,
                f"Rescanned barcode '{rescan_clean}' does not match verified barcode '{raw_barcode}'. Please re-scan the correct tube label.",
            )

    sample = _first(
        supabase.table("samples")
        .select("*")
        .eq("id", body.sample_id)
        .limit(1)
        .execute()
    )
    if not sample:
        raise HTTPException(404, "Sample not found.")

    # Prevent collection if booking is cancelled
    if sample.get("booking_id"):
        booking = _first(supabase.table("bookings").select("status").eq("id", sample["booking_id"]).limit(1).execute())
        if booking.get("status") == "cancelled":
            raise HTTPException(400, "Cannot collect sample for a cancelled booking.")

    # Idempotency check: if already collected with same barcode by same phlebo, return success
    if sample.get("status") == "collected" and sample.get("barcode") == raw_barcode:
        patient_name = "Patient"
        if sample.get("patient_id"):
            p_row = _first(supabase.table("users").select("full_name").eq("id", sample["patient_id"]).limit(1).execute())
            patient_name = p_row.get("full_name", "Patient")
        return {
            "success": True,
            "message": "Sample Linked Successfully",
            "sample_id": sample["id"],
            "barcode": raw_barcode,
            "patient_name": patient_name,
            "status": "collected",
            "barcode_locked": True,
            "collected_at": sample.get("collected_at") or _now_iso(),
        }

    # Validate canonical sample FSM status transition
    try:
        validate_sample_transition(sample.get("status", ""), "collected")
    except ValueError as e:
        raise HTTPException(409, str(e))

    # Prevent barcode reuse if barcode is linked to ANOTHER sample
    if raw_barcode:
        other_sample = _first(
            supabase.table("samples")
            .select("id")
            .eq("barcode", raw_barcode)
            .neq("id", body.sample_id)
            .limit(1)
            .execute()
        )
        if other_sample:
            raise HTTPException(409, f"Barcode {raw_barcode} is already assigned to another sample.")

    now_ts = _now_iso()

    # Update sample record atomically (locking barcode to prevent reassignment)
    update_data = {
        "status": "collected",
        "barcode": raw_barcode,
        "collected_at": now_ts,
        "phlebotomist_user_id": phlebo_id,
        "barcode_locked": True,
        "barcode_locked_at": now_ts,
    }
    if body.lat is not None:
        update_data["lat"] = body.lat
    if body.lng is not None:
        update_data["lng"] = body.lng

    try:
        supabase.table("samples").update(update_data).eq("id", body.sample_id).execute()
    except Exception as e:
        if "23505" in str(e) or "duplicate key" in str(e).lower() or "unique constraint" in str(e).lower():
            raise HTTPException(409, f"Barcode '{raw_barcode}' is already registered to another sample.")
        # Fall back if barcode_locked columns do not exist in database table schema yet
        update_data.pop("barcode_locked", None)
        update_data.pop("barcode_locked_at", None)
        try:
            supabase.table("samples").update(update_data).eq("id", body.sample_id).execute()
        except Exception as retry_err:
            if "23505" in str(retry_err) or "duplicate key" in str(retry_err).lower() or "unique constraint" in str(retry_err).lower():
                raise HTTPException(409, f"Barcode '{raw_barcode}' is already registered to another sample.")
            raise retry_err

    # Extended device metadata for custody log
    device_info_str = ""
    if body.device_id or body.device_model or body.app_version:
        device_info_str = f" [Device: {body.device_model or body.device_id or 'unknown'}, OS: {body.os_version or 'unknown'}, App: {body.app_version or 'unknown'}]"

    # Custody log event (failures propagate to guarantee atomicity)
    supabase.table("sample_events").insert({
        "id": str(uuid.uuid4()),
        "sample_id": body.sample_id,
        "event": "sample_collected",
        "actor_id": phlebo_id,
        "actor_role": "phlebotomist",
        "lat": body.lat,
        "lng": body.lng,
        "notes": f"Sample collection confirmed with barcode {raw_barcode}{device_info_str}",
        "created_at": now_ts,
    }).execute()

    # Auto-decrement stock best-effort
    tube_code = sample.get("tube_type_code") or sample.get("expected_tube_type_code")
    if tube_code:
        decrement_for_collection(phlebo_id, tube_code)

    # Audit Log with extended device details
    patient_name = "Patient"
    if sample.get("patient_id"):
        p_row = _first(supabase.table("users").select("full_name").eq("id", sample["patient_id"]).limit(1).execute())
        patient_name = p_row.get("full_name", "Patient")

    try:
        AuditService.log_from_request(
            action="sample.collection_confirmed",
            entity_type="sample",
            entity_id=body.sample_id,
            actor_id=phlebo_id,
            details={
                "barcode": raw_barcode,
                "booking_id": sample.get("booking_id"),
                "patient_id": sample.get("patient_id"),
                "barcode_locked": True,
                "device_id": body.device_id,
                "device_model": body.device_model,
                "os_version": body.os_version,
                "app_version": body.app_version,
            },
            request=request,
        )
    except Exception as e:
        logger.error(f"Audit log write failed: {e}")

    return {
        "success": True,
        "message": "Sample Linked Successfully",
        "sample_id": body.sample_id,
        "barcode": raw_barcode,
        "patient_name": patient_name,
        "status": "collected",
        "barcode_locked": True,
        "collected_at": now_ts,
    }


confirm_collection = confirm_sample_collection





# ─── Collection kit requirements (dashboard widget) ───────────────────────

@router.get("/kit-requirements/{booking_id}")
async def get_kit_requirements(
    booking_id: str,
    user: dict = Depends(get_current_user),
):
    """What the collector must physically carry for this booking.

    Grouped by container, each with its cap colour, additive, draw volume and
    the tests riding in it, plus the per-collection consumables. This is the
    dashboard widget: a collector who has just been offered "Complete Blood
    Count" needs to know it is one 3 ml lavender EDTA, not go and look it up.

    Deliberately carries NO patient identity — the widget renders on an offer
    the collector has not accepted yet, and identity is released only after
    the doorstep OTP.
    """
    _require_phlebo(user)

    samples = _rows(
        supabase.table("samples")
        .select("id, expected_tube_type_code, status")
        .eq("booking_id", booking_id)
        .execute()
    )
    if not samples:
        return {
            "booking_id": booking_id,
            "tubes": [],
            "consumables": [],
            "total_tubes": 0,
            "note": "No tubes provisioned for this booking yet.",
        }

    tube_map = {
        t["code"]: t for t in _rows(
            supabase.table("tube_types")
            .select("code, name, cap_colour, additive, typical_volume_ml")
            .execute()
        )
    }

    # sample -> test names, so the collector can tie a tube to what it is for.
    sample_ids = [s["id"] for s in samples]
    tests_by_sample: Dict[str, List[str]] = {}
    st_rows = _rows(
        supabase.table("sample_tests")
        .select("sample_id, booking_test_id")
        .in_("sample_id", sample_ids)
        .execute()
    )
    bt_ids = list({r["booking_test_id"] for r in st_rows if r.get("booking_test_id")})
    if bt_ids:
        booking_tests = _rows(
            supabase.table("booking_tests")
            .select("id, home_service_id")
            .in_("id", bt_ids)
            .execute()
        )
        hs_ids = list({b["home_service_id"] for b in booking_tests
                       if b.get("home_service_id")})
        hs_map = {}
        if hs_ids:
            hs_map = {
                h["id"]: h for h in _rows(
                    supabase.table("home_services")
                    .select("id, name, fasting_required, fasting_hours")
                    .in_("id", hs_ids).execute()
                )
            }
        bt_to_service = {
            b["id"]: hs_map.get(b.get("home_service_id", ""), {})
            for b in booking_tests
        }
        for r in st_rows:
            svc = bt_to_service.get(r.get("booking_test_id", ""), {})
            if svc.get("name"):
                tests_by_sample.setdefault(r["sample_id"], []).append(svc["name"])

    # Group the physical tubes by type.
    grouped: Dict[str, dict] = {}
    for s in samples:
        code = s.get("expected_tube_type_code") or ""
        if not code:
            continue
        info = tube_map.get(code, {})
        entry = grouped.setdefault(code, {
            "tube_type_code": code,
            "name": info.get("name", code),
            "cap_colour": info.get("cap_colour", ""),
            "additive": info.get("additive", ""),
            "volume_ml": info.get("typical_volume_ml"),
            "count": 0,
            "tests": [],
            "collected": 0,
        })
        entry["count"] += 1
        if s.get("status") not in ("pending_collection", "cancelled"):
            entry["collected"] += 1
        for name in tests_by_sample.get(s["id"], []):
            if name not in entry["tests"]:
                entry["tests"].append(name)

    tubes = sorted(grouped.values(), key=lambda t: (-t["count"], t["name"]))

    # Consumables are per-collection, not per-tube, and come from the same kit
    # catalogue the stock counter decrements against — so the widget can never
    # list an item the collector has no stock line for.
    consumables = _rows(
        supabase.table("kit_items")
        .select("code, name, category")
        .eq("category", "consumable")
        .eq("is_active", True)
        .execute()
    )

    untubed = [s["id"] for s in samples if not s.get("expected_tube_type_code")]

    return {
        "booking_id": booking_id,
        "tubes": tubes,
        "total_tubes": sum(t["count"] for t in tubes),
        "consumables": [
            {"code": c["code"], "name": c["name"]} for c in consumables
        ],
        # Surfaced rather than hidden: a sample with no tube type means the
        # test has no home_service_tubes row, and the collector needs to know
        # to call the centre instead of guessing an additive.
        "unmapped_sample_count": len(untubed),
    }
