"""
Tests for Patient Dashboard Upgrade Plan
Verifies:
  1. Feature flags configuration.
  2. Biomarkers matrix & Risk Compass endpoint.
  3. AI Doctor Briefing compiler endpoint.
  4. Emergency SOS dispatch trigger endpoint.
  5. Patient medicine cabinet GET & POST endpoints.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.routers import patient_health, patient_sos


def _mock_user():
    return {"sub": str(uuid.uuid4()), "role": "patient", "full_name": "Test Patient"}


# ── 1. Feature Flags Verification ──────────────────────────────────────────

def test_feature_flags_exist():
    assert hasattr(settings, "ENABLE_PREVENTIVE_BIOMARKERS")
    assert hasattr(settings, "ENABLE_DOCTOR_BRIEFING")
    assert hasattr(settings, "ENABLE_FAMILY_SWIPER")
    assert hasattr(settings, "ENABLE_EMERGENCY_SOS")
    assert hasattr(settings, "ENABLE_SMART_MEDICINE_CABINET")
    assert hasattr(settings, "ENABLE_PHLEBO_RADAR")
    assert settings.ENABLE_PREVENTIVE_BIOMARKERS is True


# ── 2. Biomarkers Matrix Endpoint Test ─────────────────────────────────────

@pytest.mark.asyncio
async def test_get_biomarker_matrix_fallback():
    """A patient with no rows in patient_biomarkers gets a clean empty state,
    not fabricated readings — CallMedex reports real data only."""
    user = _mock_user()
    result = await patient_health.get_biomarker_matrix(user=user)

    assert "patient_id" in result
    assert result["patient_id"] == user["sub"]
    assert result["biomarkers"] == []
    assert result["risk_compass"] is None


def test_build_risk_compass_computes_real_trend_direction_not_fabricated():
    """risk_compass must reflect the actual readings, not a canned score —
    CallMedex has no doctor-reviewed clinical risk model, so it must never
    claim one (see CLAUDE.md Clinical Liability Firewall)."""
    rows = [
        {  # most recent (rows arrive ordered by recorded_at desc)
            "observation_code": "HBA1C", "observation_name": "HbA1c",
            "value_number": 5.9, "unit": "%", "recorded_at": "2026-07-20T00:00:00Z",
        },
        {
            "observation_code": "HBA1C", "observation_name": "HbA1c",
            "value_number": 5.7, "unit": "%", "recorded_at": "2026-05-15T00:00:00Z",
        },
    ]

    compass = patient_health._build_risk_compass(rows)

    assert compass["total_readings"] == 2
    assert compass["distinct_biomarkers"] == 1
    trend = compass["trends"][0]
    assert trend["direction"] == "up"
    assert trend["latest_value"] == 5.9
    # No invented percentages anywhere in the payload.
    assert "cardiovascular_risk" not in compass
    assert "overall_score" not in compass


# ── 3. Doctor Briefing Endpoint Test ────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_doctor_briefing_fallback():
    """A patient with no biomarker/medication rows gets an honest 'no data'
    briefing, not fabricated anomalies — see CLAUDE.md Clinical Liability Firewall."""
    user = _mock_user()
    req = patient_health.DoctorBriefingRequest(specialty_type="Cardiology")

    result = await patient_health.generate_doctor_briefing(payload=req, user=user)

    assert result["status"] == "success"
    briefing = result["briefing"]
    assert briefing["specialty_type"] == "Cardiology"
    assert briefing["patient_id"] == user["sub"]
    assert briefing["chief_anomalies"] == []
    assert briefing["active_medications_count"] == 0
    assert briefing["recommended_focus_points"] == [
        "No lab or medication data on file yet — request updated records before this consultation."
    ]


def test_build_doctor_briefing_content_reflects_real_trends_not_fabricated():
    biomarker_rows = [
        {"observation_code": "HBA1C", "observation_name": "HbA1c", "value_number": 5.9,
         "unit": "%", "recorded_at": "2026-07-20T00:00:00Z"},
        {"observation_code": "HBA1C", "observation_name": "HbA1c", "value_number": 5.7,
         "unit": "%", "recorded_at": "2026-05-15T00:00:00Z"},
    ]
    medication_rows = [{"medicine_name": "Aspirin 75mg"}]

    briefing = patient_health._build_doctor_briefing_content(
        "patient-1", "Cardiology", biomarker_rows, medication_rows
    )

    assert briefing["active_medications_count"] == 1
    assert briefing["recent_report_count"] == 2
    assert "HbA1c trending up" in briefing["chief_anomalies"][0]
    assert any("HbA1c" in fp for fp in briefing["recommended_focus_points"])
    assert any("1 active medication" in fp for fp in briefing["recommended_focus_points"])


# ── 4. Emergency SOS Trigger Test ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_trigger_emergency_sos():
    user = _mock_user()
    payload = patient_sos.SOSTriggerPayload(lat=12.9716, lng=77.5946, notes="Test SOS alert")
    
    result = await patient_sos.trigger_emergency_sos(payload=payload, user=user)
    
    assert result["status"] == "dispatched"
    assert "alert_id" in result
    assert result["location"]["lat"] == 12.9716
    assert result["location"]["lng"] == 77.5946
    assert result["contacts_notified"] >= 1


# ── 5. Medications Endpoints Test ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_patient_medications_fallback():
    """A patient with no rows in patient_medications gets an empty cabinet,
    not fabricated prescriptions."""
    user = _mock_user()
    result = await patient_sos.get_patient_medications(user=user)

    assert "patient_id" in result
    assert result["patient_id"] == user["sub"]
    assert result["medications"] == []


@pytest.mark.asyncio
async def test_add_patient_medication():
    user = _mock_user()
    payload = patient_sos.MedicationIn(
        medicine_name="Aspirin 75mg",
        dosage="1 tablet morning after breakfast",
        total_pills=30,
        remaining_pills=28,
        pills_per_day=1,
        refill_date="2026-09-01"
    )
    
    result = await patient_sos.add_patient_medication(payload=payload, user=user)
    
    assert result["status"] == "created"
    med = result["medication"]
    assert med["medicine_name"] == "Aspirin 75mg"
    assert med["patient_id"] == user["sub"]
