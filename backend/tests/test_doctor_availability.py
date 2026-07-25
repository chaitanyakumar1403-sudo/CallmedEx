"""
Doctor availability tests — "apply to all days", editing and overlap safety.

Three behaviours matter:

  1. "Apply to all days" writes seven linked rows so the week can later be
     edited or removed as one unit.
  2. Editing a single day DETACHES it from the group, so a later group-wide
     edit does not silently destroy the exception the doctor made. This is the
     classic recurring-event trap.
  3. Overlapping blocks are refused. Two blocks covering the same hour on the
     same day generate double-booked slots and a patient turned away on arrival.
"""
import uuid

import pytest
from fastapi import HTTPException

import app.routers.provider_management as pm
from app.routers.provider_management import (
    AvailabilityCreate,
    AvailabilityUpdate,
    create_availability,
    delete_availability_group,
    update_availability,
    update_availability_group,
)

from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(pm, "supabase", fake)
    return fake


DOCTOR = str(uuid.uuid4())
USER = {"sub": DOCTOR, "role": "doctor"}


def _payload(**kw):
    base = dict(
        day_of_week=1, start_time="09:00", end_time="13:00",
        slot_duration_minutes=30, consultation_mode="in_person",
        max_patients_per_slot=1,
    )
    base.update(kw)
    return AvailabilityCreate(**base)


def _rows(fake):
    return fake.db.get("doctor_availability", [])


# ── Apply to all days ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_single_day_creates_one_ungrouped_row(fake_db):
    result = await create_availability(_payload(), USER)

    assert result["created"] == 1
    assert result["template_group_id"] is None
    assert len(_rows(fake_db)) == 1
    assert _rows(fake_db)[0]["day_of_week"] == 1


@pytest.mark.asyncio
async def test_apply_to_all_days_writes_seven_linked_rows(fake_db):
    result = await create_availability(_payload(apply_to_all_days=True), USER)

    assert result["created"] == 7
    group = result["template_group_id"]
    assert group

    rows = _rows(fake_db)
    assert sorted(r["day_of_week"] for r in rows) == [0, 1, 2, 3, 4, 5, 6]
    assert {r["template_group_id"] for r in rows} == {group}
    # Every day carries the same hours.
    assert {r["start_time"] for r in rows} == {"09:00"}


@pytest.mark.asyncio
async def test_apply_to_all_can_replace_an_existing_week(fake_db):
    """Without replace, a second 'apply to all' would double slot capacity."""
    await create_availability(_payload(apply_to_all_days=True), USER)
    result = await create_availability(
        _payload(start_time="10:00", end_time="14:00",
                 apply_to_all_days=True, replace_existing=True),
        USER,
    )

    assert result["created"] == 7
    rows = _rows(fake_db)
    assert len(rows) == 7                      # not 14
    assert {r["start_time"] for r in rows} == {"10:00"}


# ── Overlap safety ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_overlapping_block_on_same_day_is_refused(fake_db):
    await create_availability(_payload(day_of_week=1, start_time="09:00", end_time="13:00"), USER)

    with pytest.raises(HTTPException) as exc:
        await create_availability(
            _payload(day_of_week=1, start_time="12:00", end_time="16:00"), USER
        )
    assert exc.value.status_code == 409
    assert len(_rows(fake_db)) == 1


@pytest.mark.asyncio
async def test_adjacent_block_is_allowed(fake_db):
    """09:00-13:00 then 13:00-17:00 do not overlap — they touch."""
    await create_availability(_payload(day_of_week=1, start_time="09:00", end_time="13:00"), USER)
    result = await create_availability(
        _payload(day_of_week=1, start_time="13:00", end_time="17:00"), USER
    )
    assert result["created"] == 1
    assert len(_rows(fake_db)) == 2


@pytest.mark.asyncio
async def test_same_time_on_a_different_day_is_allowed(fake_db):
    await create_availability(_payload(day_of_week=1), USER)
    result = await create_availability(_payload(day_of_week=2), USER)
    assert result["created"] == 1


@pytest.mark.asyncio
async def test_apply_to_all_skips_only_the_clashing_day(fake_db):
    """One clash must not sink the other six days."""
    await create_availability(
        _payload(day_of_week=3, start_time="10:00", end_time="12:00"), USER
    )
    result = await create_availability(
        _payload(start_time="09:00", end_time="13:00", apply_to_all_days=True), USER
    )

    assert result["created"] == 6
    assert result["skipped_days"] == [3]
    assert "Wednesday" in result["message"]


# ── Editing ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_editing_one_day_detaches_it_from_the_group(fake_db):
    created = await create_availability(_payload(apply_to_all_days=True), USER)
    group = created["template_group_id"]
    wednesday = next(r for r in _rows(fake_db) if r["day_of_week"] == 3)

    result = await update_availability(
        wednesday["id"], AvailabilityUpdate(start_time="14:00"), USER
    )
    assert result["detached_from_group"]

    row = next(r for r in _rows(fake_db) if r["id"] == wednesday["id"])
    assert row["start_time"] == "14:00"
    assert row["template_group_id"] is None
    # The other six remain grouped.
    assert sum(1 for r in _rows(fake_db) if r["template_group_id"] == group) == 6


@pytest.mark.asyncio
async def test_group_edit_updates_every_linked_day(fake_db):
    created = await create_availability(_payload(apply_to_all_days=True), USER)
    group = created["template_group_id"]

    result = await update_availability_group(
        group, AvailabilityUpdate(start_time="08:00", end_time="12:00"), USER
    )
    assert result["updated"] == 7
    assert {r["start_time"] for r in _rows(fake_db)} == {"08:00"}


@pytest.mark.asyncio
async def test_group_edit_leaves_a_detached_day_alone(fake_db):
    """The exception the doctor made must survive a later group edit."""
    created = await create_availability(_payload(apply_to_all_days=True), USER)
    group = created["template_group_id"]
    wednesday = next(r for r in _rows(fake_db) if r["day_of_week"] == 3)
    await update_availability(wednesday["id"], AvailabilityUpdate(start_time="14:00"), USER)

    await update_availability_group(group, AvailabilityUpdate(start_time="08:00"), USER)

    row = next(r for r in _rows(fake_db) if r["id"] == wednesday["id"])
    assert row["start_time"] == "14:00"     # untouched
    assert sum(1 for r in _rows(fake_db) if r["start_time"] == "08:00") == 6


@pytest.mark.asyncio
async def test_group_delete_removes_only_grouped_days(fake_db):
    created = await create_availability(_payload(apply_to_all_days=True), USER)
    group = created["template_group_id"]
    wednesday = next(r for r in _rows(fake_db) if r["day_of_week"] == 3)
    await update_availability(wednesday["id"], AvailabilityUpdate(start_time="14:00"), USER)

    result = await delete_availability_group(group, USER)

    assert result["removed"] == 6
    remaining = _rows(fake_db)
    assert len(remaining) == 1
    assert remaining[0]["day_of_week"] == 3     # the detached exception survives


@pytest.mark.asyncio
async def test_group_edit_on_an_unknown_group_is_a_404(fake_db):
    with pytest.raises(HTTPException) as exc:
        await update_availability_group(
            str(uuid.uuid4()), AvailabilityUpdate(start_time="08:00"), USER
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_another_doctors_group_cannot_be_edited(fake_db):
    created = await create_availability(_payload(apply_to_all_days=True), USER)
    intruder = {"sub": str(uuid.uuid4()), "role": "doctor"}

    with pytest.raises(HTTPException) as exc:
        await update_availability_group(
            created["template_group_id"], AvailabilityUpdate(start_time="08:00"), intruder
        )
    assert exc.value.status_code == 404
    assert {r["start_time"] for r in _rows(fake_db)} == {"09:00"}
