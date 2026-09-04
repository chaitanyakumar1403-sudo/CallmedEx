"""
Three things the patient dashboard was showing that were not true.

1. The medicine cabinet's pill count never moved. `remaining_pills` was
   written once at creation and read back verbatim, so a prescription entered
   months ago still reported "10/10, 5 days supply" and the refill radar could
   never fire.

2. Sample rails for finished and cancelled tubes rendered as "Pending
   Collection". STAGE_MAP had no entry for cancelled/completed/delivered/
   processing/failed and the lookup fell back to pending_collection, so old
   tests sat on the dashboard forever looking like live collections.

3. Cancelling a booking cascaded to dispatch_requests but not to samples, so
   the tubes stayed pending_collection: still on the patient's rail, still
   counted in the centre's expected intake, still scannable at the doorstep.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.routers.patient_samples import STAGE_MAP, ACTIVE_SAMPLE_STATUSES
from app.routers.patient_sos import _project_supply
from app.services.samples import ALLOWED_SAMPLE_TRANSITIONS


def _days_ago(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


# ── 1. Medicine cabinet burn-down ────────────────────────────────────────────

def test_supply_burns_down_with_elapsed_days():
    """The reported symptom: entered days ago, still showing the full count."""
    med = _project_supply({
        "total_pills": 10, "remaining_pills": 10, "pills_per_day": 2,
        "last_counted_at": _days_ago(3),
    })
    assert med["remaining_pills"] == 4      # 10 - 2/day * 3 days
    assert med["days_left"] == 2
    assert med["needs_refill"] is True
    assert med["counted_remaining_pills"] == 10   # stored row untouched


def test_supply_never_goes_negative():
    med = _project_supply({
        "total_pills": 10, "remaining_pills": 10, "pills_per_day": 2,
        "last_counted_at": _days_ago(400),
    })
    assert med["remaining_pills"] == 0
    assert med["days_left"] == 0
    assert med["out_of_stock"] is True


def test_a_fresh_entry_is_not_burnt_down():
    med = _project_supply({
        "total_pills": 30, "remaining_pills": 30, "pills_per_day": 1,
        "last_counted_at": datetime.now(timezone.utc).isoformat(),
    })
    assert med["remaining_pills"] == 30
    assert med["days_left"] == 30
    assert med["needs_refill"] is False


def test_a_zero_dose_is_left_alone_rather_than_dividing_by_zero():
    med = _project_supply({
        "total_pills": 10, "remaining_pills": 10, "pills_per_day": 0,
        "last_counted_at": _days_ago(30),
    })
    assert med["remaining_pills"] == 10
    assert med["days_left"] is None
    assert med["needs_refill"] is False


def test_an_unparseable_anchor_does_not_wipe_the_count():
    med = _project_supply({
        "total_pills": 10, "remaining_pills": 8, "pills_per_day": 2,
        "last_counted_at": "not-a-date",
    })
    assert med["remaining_pills"] == 8


# ── 2. Sample stage mapping ──────────────────────────────────────────────────

def test_every_sample_status_has_its_own_stage():
    """A status missing from STAGE_MAP used to render as 'Pending Collection'."""
    known = set(ALLOWED_SAMPLE_TRANSITIONS) | {
        s for targets in ALLOWED_SAMPLE_TRANSITIONS.values() for s in targets
    }
    missing = known - set(STAGE_MAP)
    assert not missing, f"statuses with no patient-facing stage: {sorted(missing)}"


def test_terminal_statuses_are_labelled_as_themselves():
    assert STAGE_MAP["cancelled"]["label"] == "Cancelled"
    assert STAGE_MAP["completed"]["label"] == "Completed"
    assert STAGE_MAP["cancelled"]["stage"] != "pending_collection"
    assert STAGE_MAP["completed"]["stage"] != "pending_collection"


@pytest.mark.parametrize("status", ["cancelled", "completed", "delivered",
                                    "rejected", "failed"])
def test_finished_work_is_off_the_live_rail(status):
    """The rail tracks work in flight; history belongs in the reports list."""
    assert status not in ACTIVE_SAMPLE_STATUSES


@pytest.mark.parametrize("status", ["pending_collection", "collected",
                                    "in_transit", "received", "verified"])
def test_work_in_flight_stays_on_the_rail(status):
    assert status in ACTIVE_SAMPLE_STATUSES


# ── 3. Cancellation is a legal move for an uncollected tube ──────────────────

def test_an_uncollected_tube_may_be_cancelled():
    assert "cancelled" in ALLOWED_SAMPLE_TRANSITIONS["pending_collection"]


def test_a_received_tube_cannot_be_cancelled_by_the_app():
    """It is a physical specimen on someone's bench by then."""
    assert "cancelled" not in ALLOWED_SAMPLE_TRANSITIONS["received"]
