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
    user = _mock_user()
    result = await patient_health.get_biomarker_matrix(user=user)
    
    assert "patient_id" in result
    assert result["patient_id"] == user["sub"]
    assert "biomarkers" in result
    assert len(result["biomarkers"]) > 0
    assert "risk_compass" in result
    assert result["risk_compass"]["overall_score"] == 88


# ── 3. Doctor Briefing Endpoint Test ────────────────────────────────────────

@pytest.mark.asyncio
async def test_generate_doctor_briefing():
    user = _mock_user()
    req = patient_health.DoctorBriefingRequest(specialty_type="Cardiology")
    
    result = await patient_health.generate_doctor_briefing(payload=req, user=user)
    
    assert result["status"] == "success"
    briefing = result["briefing"]
    assert briefing["specialty_type"] == "Cardiology"
    assert briefing["patient_id"] == user["sub"]
    assert len(briefing["chief_anomalies"]) > 0
    assert len(briefing["recommended_focus_points"]) > 0


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
    user = _mock_user()
    result = await patient_sos.get_patient_medications(user=user)
    
    assert "patient_id" in result
    assert result["patient_id"] == user["sub"]
    assert "medications" in result
    assert len(result["medications"]) >= 3


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
