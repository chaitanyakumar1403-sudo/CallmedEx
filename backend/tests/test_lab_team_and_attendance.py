"""
Lab team-up + attendance gate tests.

Two invariants worth protecting:

  1. An affiliation is two-sided. Neither a centre nor a collector can create a
     working link on its own — the party that did NOT open the request must
     accept before `home_lab_org_user_id` is set.
  2. A missed attendance selfie holds PAYMENT, never dispatch. Earnings keep
     accruing to the ledger; only the transfer freezes.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

import app.services.attendance as attendance_mod
import app.services.lab_team as lab_team_mod
import app.services.samples as samples_mod
import app.services.wallet as wallet_mod
from app.services.attendance import IST, AttendanceService
from app.services.lab_team import LabTeamService
from app.services.samples import SampleService
from app.services.wallet import WalletService

from tests.test_sample_lifecycle import FakeSupabase  # reuse the in-memory stand-in


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    for mod in (wallet_mod, samples_mod, lab_team_mod, attendance_mod):
        monkeypatch.setattr(mod, "supabase", fake)
    return fake


def _seed_user(fake, user_id, role, name="Someone", email=None, mobile=None):
    fake.db.setdefault("users", []).append({
        "id": user_id, "role": role, "full_name": name,
        "email": email or f"{user_id[:8]}@test.local",
        "mobile": mobile or "9000000000", "city": "Visakhapatnam",
    })


def _seed_org(fake, user_id, name, verification_status="verified"):
    _seed_user(fake, user_id, "organization", name)
    fake.db.setdefault("organizations", []).append({
        "user_id": user_id, "organization_name": name,
        "organization_type": "diagnostic_center",
        "verification_status": verification_status,
    })


def _seed_phlebo(fake, user_id, name="Collector", email=None, mobile=None):
    _seed_user(fake, user_id, "phlebotomist", name, email, mobile)
    fake.db.setdefault("phlebotomists", []).append({
        "user_id": user_id, "per_collection_rate": 150,
        "phleb_type": "part_time", "home_lab_org_user_id": None,
        "verification_status": "verified",
    })


def _home_lab(fake, phlebo_id):
    row = next(p for p in fake.db["phlebotomists"] if p["user_id"] == phlebo_id)
    return row.get("home_lab_org_user_id")


# ── Affiliation is two-sided ─────────────────────────────────────────────────

def test_invite_alone_does_not_link(fake_db):
    """A pending invitation must not set the handover default."""
    org, phlebo = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_org(fake_db, org, "Vizag Diagnostics")
    _seed_phlebo(fake_db, phlebo)

    res = LabTeamService.request_link(org, phlebo, "organization", org)
    assert res["success"] and res["awaiting"] == "phlebotomist"
    assert _home_lab(fake_db, phlebo) is None


def test_collector_acceptance_completes_the_link(fake_db):
    org, phlebo = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_org(fake_db, org, "Vizag Diagnostics")
    _seed_phlebo(fake_db, phlebo)

    invite = LabTeamService.request_link(org, phlebo, "organization", org)
    res = LabTeamService.respond(invite["link_id"], phlebo, accept=True)

    assert res["success"] and res["accepted"]
    assert res["org_name"] == "Vizag Diagnostics"
    assert _home_lab(fake_db, phlebo) == org
    # And the collector's handover default now resolves.
    assert SampleService.get_home_lab(phlebo)["home_lab_name"] == "Vizag Diagnostics"


def test_inviter_cannot_accept_on_the_other_partys_behalf(fake_db):
    """The whole point of a two-sided link."""
    org, phlebo = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_org(fake_db, org, "Vizag Diagnostics")
    _seed_phlebo(fake_db, phlebo)

    invite = LabTeamService.request_link(org, phlebo, "organization", org)
    res = LabTeamService.respond(invite["link_id"], org, accept=True)

    assert not res["success"]
    assert "not yours to answer" in res["message"]
    assert _home_lab(fake_db, phlebo) is None


def test_collector_application_needs_centre_approval(fake_db):
    """The reverse direction: a collector cannot self-claim a lab."""
    org, phlebo = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_org(fake_db, org, "Apollo Diagnostics")
    _seed_phlebo(fake_db, phlebo)

    applied = LabTeamService.request_link(org, phlebo, "phlebotomist", phlebo)
    assert applied["awaiting"] == "organization"
    assert _home_lab(fake_db, phlebo) is None

    # The collector answering their own application is refused.
    self_answer = LabTeamService.respond(applied["link_id"], phlebo, accept=True)
    assert not self_answer["success"]
    assert _home_lab(fake_db, phlebo) is None

    # The centre accepting completes it.
    approved = LabTeamService.respond(applied["link_id"], org, accept=True)
    assert approved["success"] and _home_lab(fake_db, phlebo) == org


def test_decline_leaves_no_link(fake_db):
    org, phlebo = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_org(fake_db, org, "Vizag Diagnostics")
    _seed_phlebo(fake_db, phlebo)

    invite = LabTeamService.request_link(org, phlebo, "organization", org)
    res = LabTeamService.respond(invite["link_id"], phlebo, accept=False, note="Too far")

    assert res["success"] and res["accepted"] is False
    assert _home_lab(fake_db, phlebo) is None


def test_duplicate_invite_does_not_stack(fake_db):
    org, phlebo = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_org(fake_db, org, "Vizag Diagnostics")
    _seed_phlebo(fake_db, phlebo)

    LabTeamService.request_link(org, phlebo, "organization", org)
    again = LabTeamService.request_link(org, phlebo, "organization", org)

    assert again["success"] and again["already"]
    assert len(fake_db.db["lab_phlebotomist_links"]) == 1


def test_unverified_centre_cannot_recruit(fake_db):
    org, phlebo = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_org(fake_db, org, "Pending Labs", verification_status="pending")
    _seed_phlebo(fake_db, phlebo)

    res = LabTeamService.request_link(org, phlebo, "organization", org)
    assert not res["success"] and "not verified" in res["message"]


def test_non_collector_cannot_be_invited(fake_db):
    org, doctor = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_org(fake_db, org, "Vizag Diagnostics")
    _seed_user(fake_db, doctor, "doctor", "Dr Rao")

    res = LabTeamService.request_link(org, doctor, "organization", org)
    assert not res["success"] and "not a collector" in res["message"]


def test_revoke_clears_the_handover_default(fake_db):
    org, phlebo = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_org(fake_db, org, "Vizag Diagnostics")
    _seed_phlebo(fake_db, phlebo)

    invite = LabTeamService.request_link(org, phlebo, "organization", org)
    LabTeamService.respond(invite["link_id"], phlebo, accept=True)
    assert _home_lab(fake_db, phlebo) == org

    # Either side may walk away; only forming the link needs agreement.
    res = LabTeamService.revoke(invite["link_id"], phlebo)
    assert res["success"]
    assert _home_lab(fake_db, phlebo) is None


def test_lookup_by_email_and_mobile(fake_db):
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, "Arjun", email="arjun@lab.test", mobile="9876543210")

    assert LabTeamService.find_phlebotomist("arjun@lab.test")["id"] == phlebo
    assert LabTeamService.find_phlebotomist("9876543210")["id"] == phlebo
    assert LabTeamService.find_phlebotomist("nobody@nowhere.test") == {}


def test_org_roster_separates_team_from_pending(fake_db):
    org, joined, invited, applicant = (str(uuid.uuid4()) for _ in range(4))
    _seed_org(fake_db, org, "Vizag Diagnostics")
    for p in (joined, invited, applicant):
        _seed_phlebo(fake_db, p)

    accepted = LabTeamService.request_link(org, joined, "organization", org)
    LabTeamService.respond(accepted["link_id"], joined, accept=True)
    LabTeamService.request_link(org, invited, "organization", org)
    LabTeamService.request_link(org, applicant, "phlebotomist", applicant)

    view = LabTeamService.list_for_org(org)
    assert [m["phlebotomist_user_id"] for m in view["team"]] == [joined]
    assert [m["phlebotomist_user_id"] for m in view["sent"]] == [invited]
    assert [m["phlebotomist_user_id"] for m in view["incoming"]] == [applicant]


# ── Attendance gate ──────────────────────────────────────────────────────────

def _at(hour, minute):
    """A fixed IST datetime for deadline arithmetic."""
    return datetime(2026, 7, 25, hour, minute, tzinfo=IST)


def test_deadline_comparison(fake_db):
    assert AttendanceService._is_late(_at(5, 0), "05:15") is False
    assert AttendanceService._is_late(_at(5, 15), "05:15") is False
    assert AttendanceService._is_late(_at(5, 16), "05:15") is True
    # A malformed setting must not crash the gate; it falls back to 05:15.
    assert AttendanceService._is_late(_at(6, 0), "not-a-time") is True


def test_sweep_holds_only_non_submitters(fake_db, monkeypatch):
    present, absent = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_phlebo(fake_db, present)
    _seed_phlebo(fake_db, absent)

    AttendanceService.submit(present, "http://x/selfie.jpg")
    result = AttendanceService.sweep_missed()

    assert result["held"] == 1
    assert WalletService.ensure_wallet(absent)["on_hold"] is True
    assert not WalletService.ensure_wallet(present).get("on_hold")


def test_hold_freezes_payout_but_not_accrual(fake_db):
    """The core design decision: money is held, earning continues."""
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo)

    AttendanceService.sweep_missed()
    assert WalletService.ensure_wallet(phlebo)["on_hold"] is True

    # A verified collection still credits while the payout is frozen.
    WalletService.credit(phlebo, 150, "collection_payout", sample_id=str(uuid.uuid4()))
    assert WalletService.recompute_balance(phlebo) == 150.0
    assert WalletService.ensure_wallet(phlebo)["on_hold"] is True


def test_on_time_submission_lifts_an_attendance_hold(fake_db, monkeypatch):
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo)

    AttendanceService.sweep_missed()
    assert WalletService.ensure_wallet(phlebo)["on_hold"] is True

    # Pretend it is 05:00 IST, before the cut-off.
    monkeypatch.setattr(AttendanceService, "_is_late", staticmethod(lambda *_: False))
    res = AttendanceService.submit(phlebo, "http://x/selfie.jpg")

    assert res["success"] and res["hold_released"] is True
    assert WalletService.ensure_wallet(phlebo)["on_hold"] is False


def test_submission_does_not_lift_an_unrelated_hold(fake_db, monkeypatch):
    """A complaint hold must survive a selfie."""
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo)
    WalletService.set_hold(phlebo, True, "Patient complaint under investigation")

    monkeypatch.setattr(AttendanceService, "_is_late", staticmethod(lambda *_: False))
    res = AttendanceService.submit(phlebo, "http://x/selfie.jpg")

    assert res["success"] and res["hold_released"] is False
    assert WalletService.ensure_wallet(phlebo)["on_hold"] is True


def test_late_submission_is_recorded_but_keeps_the_hold(fake_db, monkeypatch):
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo)
    AttendanceService.sweep_missed()

    monkeypatch.setattr(AttendanceService, "_is_late", staticmethod(lambda *_: True))
    res = AttendanceService.submit(phlebo, "http://x/selfie.jpg")

    assert res["success"] and res["is_late"] is True
    assert res["hold_released"] is False
    assert WalletService.ensure_wallet(phlebo)["on_hold"] is True


def test_sweep_is_idempotent(fake_db):
    """Beat retries must not stack duplicate absence rows."""
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo)

    AttendanceService.sweep_missed()
    second = AttendanceService.sweep_missed()

    # The second pass sees the row from the first and skips.
    assert second["held"] == 0


def test_selfie_is_required(fake_db):
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo)
    assert not AttendanceService.submit(phlebo, "   ")["success"]


def test_today_card_reports_hold_state(fake_db):
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo)

    before = AttendanceService.today(phlebo)
    assert before["submitted"] is False and before["status"] == "not_submitted"

    AttendanceService.sweep_missed()
    after = AttendanceService.today(phlebo)
    assert after["status"] == "missed"
    assert after["on_hold"] is True
