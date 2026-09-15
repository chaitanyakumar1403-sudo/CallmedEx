"""
e-Prescription prescriber identity.

The registration number printed on a prescription must come from the
provider's own record — never from the request body, and never a placeholder.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException


def _fake_supabase(rows):
    def table(name):
        q = MagicMock()
        q.select.return_value = q
        q.eq.return_value = q
        q.limit.return_value = q
        row = rows.get(name)
        q.execute.return_value = MagicMock(data=[row] if row else [])
        return q

    sb = MagicMock()
    sb.table.side_effect = table
    return sb


def _request(**overrides):
    from app.routers.telemedicine import SendRxEmailRequest

    body = {
        "patient_email": "patient@example.invalid",
        "patient_name": "Test Patient",
        "diagnosis": "J06.9",
        "medicines": [{"name": "Paracetamol", "dose": "650mg"}],
        "doctor_reg_number": "CLIENT-FAKE-123",
    }
    body.update(overrides)
    return SendRxEmailRequest(**body)


@pytest.mark.asyncio
async def test_rejects_when_no_registration_on_file():
    from app.routers import telemedicine

    sb = _fake_supabase({
        "users": {"id": "u1", "full_name": "Asha Rao"},
        "doctors": {"user_id": "u1", "medical_license_number": ""},
    })
    with patch.object(telemedicine, "supabase", sb), \
         patch("app.services.email.EmailService.send_eprescription_email") as send:
        with pytest.raises(HTTPException) as exc:
            await telemedicine.send_rx_email(_request(), {"sub": "u1", "role": "doctor"})
    assert exc.value.status_code == 400
    assert "registration number" in exc.value.detail
    send.assert_not_called()


@pytest.mark.asyncio
async def test_uses_profile_registration_and_ignores_client_value():
    from app.routers import telemedicine

    sb = _fake_supabase({
        "users": {"id": "u1", "full_name": "Asha Rao"},
        "doctors": {"user_id": "u1", "medical_license_number": "APMC-54321", "qualification": "MBBS"},
    })
    with patch.object(telemedicine, "supabase", sb), \
         patch("app.services.email.EmailService.send_eprescription_email") as send:
        res = await telemedicine.send_rx_email(_request(), {"sub": "u1", "role": "doctor"})
    assert res["success"] is True
    kwargs = send.call_args.kwargs
    assert kwargs["doctor_reg_number"] == "APMC-54321"
    assert kwargs["doctor_name"] == "Dr. Asha Rao"
    assert kwargs["doctor_qualification"] == "MBBS"


def test_dietitian_licence_field_is_recognised():
    from app.routers import telemedicine

    sb = _fake_supabase({
        "users": {"id": "u2", "full_name": "Meera"},
        "dietitians": {"user_id": "u2", "dietitian_license_number": "RD-889"},
    })
    with patch.object(telemedicine, "supabase", sb):
        creds = telemedicine._prescriber_credentials("u2", "dietitian")
    assert creds["reg_number"] == "RD-889"
    assert creds["name"] == "Meera"  # no "Dr." prefix for non-doctors
