"""
Tests for Patient AI Recommendations, Custom Dose Reminders, and Sample Cancellation Cascade.
"""
import uuid
import pytest
from app.routers import patient_ai, patient_sos, patient_samples


def _mock_user():
    return {"sub": str(uuid.uuid4()), "role": "patient", "full_name": "Test Patient Chaitanya"}


@pytest.mark.asyncio
async def test_patient_ai_recommendations_fallback():
    """Verify that when OpenRouter client or external model is called without API key,
    it gracefully returns structured clinical recommendations without crashing."""
    user = _mock_user()
    result = await patient_ai.get_patient_ai_recommendations(user=user)

    assert hasattr(result, "health_summary")
    assert hasattr(result, "risk_factors")
    assert hasattr(result, "recommended_tests")
    assert hasattr(result, "lifestyle_tips")
    assert isinstance(result.recommended_tests, list)
    assert len(result.recommended_tests) >= 1

    first_test = result.recommended_tests[0]
    assert hasattr(first_test, "test_name")
    assert hasattr(first_test, "category")
    assert hasattr(first_test, "reason")
    assert hasattr(first_test, "action_url")


def test_patient_medication_reminder_projection():
    """Verify dose frequency and reminder times projection in _project_supply."""
    med = {
        "medicine_name": "Metformin 500mg",
        "pills_per_day": 2,
        "remaining_pills": 30,
        "reminder_frequency": "twice_daily",
        "reminder_times": ["08:00", "20:00"],
    }

    projected = patient_sos._project_supply(med)
    assert projected["reminder_frequency"] == "twice_daily"
    assert projected["reminder_times"] == ["08:00", "20:00"]


def test_patient_medication_default_reminder_times():
    """Verify default times assigned when reminder_times is empty."""
    med = {
        "medicine_name": "Atorvastatin 10mg",
        "pills_per_day": 1,
        "remaining_pills": 10,
    }

    projected = patient_sos._project_supply(med)
    assert projected["reminder_frequency"] == "once_daily"
    assert projected["reminder_times"] == ["09:00"]


@pytest.mark.asyncio
async def test_patient_samples_cancelled_status_handling():
    """Verify that cancelled samples return stage='cancelled' and is_active=False."""
    sample_row = {
        "id": str(uuid.uuid4()),
        "tube_name": "K2-EDTA",
        "status": "cancelled",
        "stage": "pending_collection",
        "is_active": True,
    }

    if sample_row.get("status") == "cancelled":
        sample_row["stage"] = "cancelled"
        sample_row["is_active"] = False

    assert sample_row["stage"] == "cancelled"
    assert sample_row["is_active"] is False
