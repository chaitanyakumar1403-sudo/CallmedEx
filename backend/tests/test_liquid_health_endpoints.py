"""
Unit & Integration Tests for Liquid Health Backend Deltas
Tests:
- Specimen Passport Timeline (/api/patient/samples/{id}/timeline)
- Guardian Link Share & Public Tracking (/api/dispatch/track/{id}/share, /api/track/{token})
- Doctor Handoff QR (/api/v1/patient/handoff, /api/v1/handoff/{token})
- Retest Radar (/api/v1/patient/retest-radar)
- Multilingual Report in Your Voice (/api/reports/{id}/summary?lang=hi)
- Generic Savings Ledger (/api/v1/patient/savings)
- Care Circle Management (/api/care-circle/invite, /accept, /members)
- Home Nursing Vitals Log (/api/nurse/visits/{id}/vitals)
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.middleware.auth import get_current_user
from app.services.magic_link import MagicLinkService

client = TestClient(app)

PATIENT_USER = {
    "sub": "patient-uuid-1234",
    "role": "patient",
    "email": "patient@example.com",
    "full_name": "Ravi Kumar",
}

ADMIN_USER = {
    "sub": "admin-uuid-0000",
    "role": "admin",
    "email": "admin@example.com",
    "full_name": "System Admin",
}

NURSE_USER = {
    "sub": "nurse-uuid-5678",
    "role": "nurse",
    "email": "nurse@example.com",
    "full_name": "Sister Mary",
}


@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_user] = lambda: PATIENT_USER
    yield
    app.dependency_overrides.clear()


# ─── 1. Specimen Passport Timeline ──────────────────────────────────────────

def test_specimen_passport_timeline_success():
    mock_sample = {
        "id": "sample-uuid-111",
        "barcode": "CMX-998877",
        "patient_id": "patient-uuid-1234",
        "status": "in_transit",
        "expected_tube_type_code": "EDTA_LAVENDER",
        "is_verified": True,
        "verification_details": {
            "patient_identity_match": True,
            "tube_type_match": True,
            "volume_sufficient": True,
            "cold_chain_held": True,
            "sample_quality_intact": True,
        },
        "temperature_celsius": 4.2,
        "created_at": "2026-09-03T05:00:00Z",
    }
    mock_events = [
        {
            "id": "ev-1",
            "sample_id": "sample-uuid-111",
            "event_type": "collected",
            "actor_id": "phlebo-1",
            "actor_role": "phlebotomist",
            "temperature_celsius": 4.5,
            "created_at": "2026-09-03T05:10:00Z",
        },
        {
            "id": "ev-2",
            "sample_id": "sample-uuid-111",
            "event_type": "verified",
            "actor_id": "pc-tech-1",
            "actor_role": "lab_technician",
            "temperature_celsius": 4.2,
            "created_at": "2026-09-03T05:40:00Z",
        },
    ]

    with patch("app.routers.patient_samples.supabase") as mock_sb:
        # Mock sample fetch
        mock_sample_exec = MagicMock()
        mock_sample_exec.execute.return_value = MagicMock(data=[mock_sample])
        mock_events_exec = MagicMock()
        mock_events_exec.execute.return_value = MagicMock(data=mock_events)

        def mock_table(name):
            t = MagicMock()
            if name == "samples":
                t.select.return_value.eq.return_value.limit.return_value = mock_sample_exec
            elif name == "sample_events":
                t.select.return_value.eq.return_value.order.return_value = mock_events_exec
            elif name == "users":
                t.select.return_value.in_.return_value.execute.return_value = MagicMock(data=[
                    {"id": "phlebo-1", "full_name": "Arun Sharma"},
                    {"id": "pc-tech-1", "full_name": "Pooja Hegde"},
                ])
            return t

        mock_sb.table.side_effect = mock_table

        res = client.get("/api/patient/samples/sample-uuid-111/timeline")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["barcode"] == "CMX-998877"
        assert len(data["events"]) == 2
        # Verify first name privacy enforcement
        assert data["events"][0]["actorName"] == "Arun"
        assert data["events"][1]["actorName"] == "Pooja"
        assert data["events"][1]["verification"] is not None
        assert len(data["events"][1]["verification"]) == 5


# ─── 2. Guardian Link Share & Public Tracking ───────────────────────────────

def test_guardian_link_share_and_public_track():
    mock_booking = {"id": "booking-uuid-777", "patient_id": "patient-uuid-1234", "status": "confirmed"}
    mock_dispatch = {
        "id": "disp-uuid-888",
        "status": "in_progress",
        "assigned_provider_id": "prov-uuid-999",
        "scheduled_time": "2026-09-03T06:00:00Z",
        "completed_at": None,
        "updated_at": "2026-09-03T06:15:00Z",
    }

    with patch("app.routers.dispatch.supabase") as mock_sb:
        mock_sb.table("bookings").select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[mock_booking])

        # Step A: Share Guardian Link
        res = client.post("/api/dispatch/track/booking-uuid-777/share")
        assert res.status_code == 200
        share_data = res.json()
        assert share_data["success"] is True
        token = share_data["token"]
        assert token is not None

        # Step B: Public Tracking without Auth
        mock_disp_exec = MagicMock()
        mock_disp_exec.execute.return_value = MagicMock(data=[mock_dispatch])

        def mock_track_table(name):
            t = MagicMock()
            if name == "dispatch_requests":
                t.select.return_value.eq.return_value.order.return_value.limit.return_value = mock_disp_exec
            elif name == "users":
                t.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[
                    {"full_name": "Suresh Raina"}
                ])
            elif name == "provider_locations":
                t.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[
                    {"current_lat": 17.385044, "current_lng": 78.486671}
                ])
            return t

        mock_sb.table.side_effect = mock_track_table

        # Call public alias
        track_res = client.get(f"/api/track/{token}")
        assert track_res.status_code == 200
        track_data = track_res.json()
        assert track_data["success"] is True
        # Leak guard checks
        assert track_data["provider"]["first_name"] == "Suresh"
        assert track_data["coarse_lat"] == 17.39  # Rounded to 2 decimals
        assert "Ravi Kumar" not in track_res.text
        assert "address" not in track_data


# ─── 3. Doctor Handoff QR & Public Viewer ───────────────────────────────────

def test_doctor_handoff_flow():
    # Step A: Create handoff packet
    with patch("app.routers.patient_handoff.supabase") as mock_sb:
        mock_sb.table("consent_records").insert.return_value.execute.return_value = MagicMock(data=[{}])

        create_res = client.post("/api/v1/patient/handoff", json={"scopes": ["medications", "vitals"]})
        assert create_res.status_code == 200
        handoff_data = create_res.json()
        token = handoff_data["token"]
        assert token is not None

        # Step B: Public Doctor Access (JSON)
        def mock_handoff_tables(name):
            t = MagicMock()
            if name == "users":
                t.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[
                    {"full_name": "Ravi Kumar", "gender": "male", "date_of_birth": "1990-05-14"}
                ])
            elif name == "patient_medications":
                t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[
                    {"medicine_name": "Metformin 500mg", "dosage": "1 tablet", "pills_per_day": 2}
                ])
            elif name == "patient_biomarkers":
                t.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[
                    {"observation_code": "HBA1C", "observation_name": "HbA1c", "value_number": 6.8, "unit": "%", "recorded_at": "2026-08-15T00:00:00Z"}
                ])
            elif name == "doctor_briefings":
                t.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
            return t

        mock_sb.table.side_effect = mock_handoff_tables

        pub_res = client.get(f"/api/v1/handoff/{token}")
        assert pub_res.status_code == 200
        pub_json = pub_res.json()
        assert pub_json["success"] is True
        assert pub_json["patient"]["name"] == "Ravi Kumar"
        assert pub_json["fhir_bundle"]["resourceType"] == "Bundle"
        assert len(pub_json["medications"]) == 1

        # Step C: HTML Render for Clinic Browser
        html_res = client.get(f"/api/v1/handoff/{token}?format=html")
        assert html_res.status_code == 200
        assert "<title>CallMedex Doctor Handoff" in html_res.text
        assert "Metformin 500mg" in html_res.text


# ─── 4. Retest Radar ────────────────────────────────────────────────────────

def test_retest_radar():
    with patch("app.routers.patient_handoff.supabase") as mock_sb:
        mock_bm = [
            {"observation_code": "VITAMIN_D", "observation_name": "Vitamin D 25-OH", "value_number": 18.2, "unit": "ng/mL", "recorded_at": "2026-05-01T00:00:00Z"}
        ]
        mock_rules = [
            {"biomarker_type": "VITAMIN_D", "interval_days": 90, "clinical_rationale": "Monitor Vitamin D after 90 days."}
        ]

        def mock_radar_tables(name):
            t = MagicMock()
            if name == "patient_biomarkers":
                t.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=mock_bm)
            elif name == "biomarker_retest_rules":
                t.select.return_value.execute.return_value = MagicMock(data=mock_rules)
            return t

        mock_sb.table.side_effect = mock_radar_tables

        radar_res = client.get("/api/v1/patient/retest-radar")
        assert radar_res.status_code == 200
        r_data = radar_res.json()
        assert r_data["success"] is True
        assert len(r_data["recommendations"]) == 1
        assert r_data["recommendations"][0]["biomarker_code"] == "VITAMIN_D"
        assert r_data["recommendations"][0]["is_due"] is True


# ─── 5. Multilingual Summary ───────────────────────────────────────────────

def test_multilingual_summary():
    mock_analysis = {
        "id": "analysis-101",
        "patient_id": "patient-uuid-1234",
        "plain_language_summary": "Your blood sugar and hemoglobin levels are within normal limits.",
        "summary_translations": {},
    }

    with patch("app.routers.ai_reports.supabase") as mock_sb:
        mock_sb.table("ai_report_analyses").select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[mock_analysis])
        mock_sb.table("ai_report_analyses").update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        res = client.get("/api/reports/analysis-101/summary?lang=hi")
        assert res.status_code == 200
        hi_data = res.json()
        assert hi_data["success"] is True
        assert hi_data["language"] == "hi"
        assert "हिंदी" in hi_data["language_name"]
        assert "आपकी स्वास्थ्य रिपोर्ट का सारांश" in hi_data["summary"]


# ─── 6. Generic Savings Ledger ─────────────────────────────────────────────

def test_generic_savings_ledger():
    mock_orders = [
        {
            "id": "order-1",
            "created_at": "2026-09-01T10:00:00Z",
            "total_amount": 150.0,
            "items": [
                {"name": "Paracetamol 500mg Generic", "price": 10.0, "branded_mrp": 35.0, "quantity": 2},
                {"name": "Atorvastatin 10mg Generic", "price": 40.0, "branded_mrp": 120.0, "quantity": 1},
            ],
            "status": "delivered",
        }
    ]

    with patch("app.routers.pharmacy_orders.supabase") as mock_sb:
        mock_exec = MagicMock()
        mock_exec.execute.return_value = MagicMock(data=mock_orders)
        mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value = mock_exec

        res = client.get("/api/v1/patient/savings")
        assert res.status_code == 200
        sav_data = res.json()
        assert sav_data["success"] is True
        # item 1: (35-10)*2 = 50, item 2: (120-40)*1 = 80 => total 130
        assert sav_data["lifetime_saved"] == 130.0
        assert sav_data["last_order_saved"] == 130.0
        assert sav_data["orders_count"] == 1


# ─── 7. Care Circle Management ──────────────────────────────────────────────

def test_care_circle_invite_and_list():
    with patch("app.routers.care_circle.supabase") as mock_sb:
        mock_sb.table("users").select.return_value.ilike.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        mock_sb.table("care_circle_members").insert.return_value.execute.return_value = MagicMock(data=[{"id": "cc-mem-1"}])
        mock_sb.table("consent_records").insert.return_value.execute.return_value = MagicMock(data=[])

        # Invite
        inv_res = client.post("/api/care-circle/invite", json={
            "phone": "9876543210",
            "full_name": "Anita Kumar",
            "relationship": "Spouse",
            "scopes": ["book_pay", "view_reports"]
        })
        assert inv_res.status_code == 200
        inv_data = inv_res.json()
        assert inv_data["success"] is True
        token = inv_data["invite_token"]

        # Accept
        mock_sb.table("care_circle_members").select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[
            {"id": "cc-mem-1", "patient_id": "patient-uuid-1234", "relationship": "Spouse", "scopes": ["book_pay", "view_reports"]}
        ])
        mock_sb.table("care_circle_members").update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        acc_res = client.post("/api/care-circle/accept", json={"invite_token": token})
        assert acc_res.status_code == 200
        assert acc_res.json()["success"] is True


# ─── 8. Home Nursing Vitals Log ────────────────────────────────────────────

def test_nurse_visit_vitals_log():
    app.dependency_overrides[get_current_user] = lambda: NURSE_USER

    with patch("app.routers.nurse_visits.supabase") as mock_sb:
        mock_booking = {
            "id": "nursing-book-1",
            "patient_id": "patient-uuid-1234",
            "assigned_nurse_id": "nurse-uuid-5678",
            "status": "in_progress",
        }
        mock_sb.table("bookings").select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[mock_booking])
        mock_sb.table("nurse_visit_logs").insert.return_value.execute.return_value = MagicMock(data=[{"id": "nv-log-1"}])
        mock_sb.table("patient_biomarkers").insert.return_value.execute.return_value = MagicMock(data=[])

        log_res = client.post("/api/nurse/visits/nursing-book-1/vitals", json={
            "vitals": {"bp_systolic": 120, "bp_diastolic": 80, "spo2": 98, "heart_rate": 72},
            "wound_care_notes": "Clean dressing applied to right elbow; no signs of infection.",
        })
        assert log_res.status_code == 200
        assert log_res.json()["success"] is True
