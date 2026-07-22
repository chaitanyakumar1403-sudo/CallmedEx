"""
Unit & Integration Test Suite for Daily.co Video Consultation & AI E-Prescription Pipeline
"""
import uuid
import pytest
from app.config import settings
from app.services.telemedicine import TelemedicineService

def test_daily_room_generation():
    """Test Daily.co room generation with API key."""
    room = TelemedicineService.generate_daily_room(str(uuid.uuid4()))
    assert room is not None
    assert "room_url" in room
    assert "room_name" in room
    assert room["provider"] in ("daily", "jitsi")
    if room["provider"] == "daily":
        assert "callmedex.daily.co" in room["room_url"]

def test_daily_meeting_token_generation():
    """Test role-specific meeting token generation."""
    room_name = "cmx-test-room-token"
    doc_token = TelemedicineService.generate_daily_meeting_token(room_name, "Dr. Sharma", is_doctor=True)
    pat_token = TelemedicineService.generate_daily_meeting_token(room_name, "Patient Chaitanya", is_doctor=False)

    if settings.DAILY_API_KEY:
        assert doc_token is not None
        assert pat_token is not None
        assert isinstance(doc_token, str)
        assert isinstance(pat_token, str)

def test_ai_eprescription_transcript_processing():
    """Test AI parsing of consultation transcript into generic drug e-prescription."""
    sample_transcript = '''
    Doctor: Good morning, how are you feeling today?
    Patient: Doctor, I have a fever of 101F since yesterday and a severe throat pain when swallowing.
    Doctor: I will prescribe Paracetamol 500mg SOS for fever and Chlorhexidine gargle twice daily for throat infection. Rest well and drink warm water.
    '''
    res = TelemedicineService.process_consultation_transcript(sample_transcript)
    assert res is not None
    assert "summary" in res
    assert "medicines" in res
    assert isinstance(res["medicines"], list)
    assert len(res["medicines"]) > 0

@pytest.mark.asyncio
async def test_pre_intake_and_order_dispatch():
    """Test pre-intake summary and 1-click post-consultation action dispatch."""
    consult_id = str(uuid.uuid4())
    patient_id = str(uuid.uuid4())

    intake = await TelemedicineService.submit_pre_intake(
        consultation_id=consult_id,
        symptoms="High fever and cough",
        duration="2 days",
        pain_score=6
    )
    assert intake["success"] is True
    assert "High fever" in intake["intake_summary"]

    # 1-Click order dispatch test
    pharm_order = await TelemedicineService.order_prescribed_actions(consult_id, patient_id, "pharmacy")
    assert pharm_order["success"] is True
    assert pharm_order["action_type"] == "pharmacy"
