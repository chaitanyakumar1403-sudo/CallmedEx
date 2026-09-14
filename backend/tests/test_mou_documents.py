"""
Partner MOUs are the original .docx agreements, shown and sent word for word.

The dashboard, acceptance page and email used to show a paraphrased stub: the
originals sat in a gitignored folder outside the Docker context, so production
never had them. These tests pin the originals, the role → document mapping,
and that every surface carries the full text and the untouched file.
"""
import hashlib
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.main import app
from app.routers import auth as auth_router
from app.routers.auth import MOU_REQUIRED_ROLES
from app.services import legal as legal_service
from app.services.email import ALGORITHM, EMAIL_TOKEN_SECRET, EmailService
from app.services.mou_loader import DOCUMENTS, MOU_DIR, document_keys_for, original_file, render_document

client = TestClient(app)


@pytest.mark.parametrize("key", sorted(DOCUMENTS))
def test_every_original_renders_with_all_of_its_text(key):
    # render_document raises if the HTML's text differs from the document's own
    # text by a single character — this is the word-for-word guarantee.
    doc = render_document(key)
    data = (MOU_DIR / DOCUMENTS[key].filename).read_bytes()
    assert doc["sha256"] == hashlib.sha256(data).hexdigest()
    assert original_file(key) == (data, DOCUMENTS[key].filename)
    assert doc["html"] and doc["text"] and doc["title"]


def test_every_file_in_the_folder_is_assigned_to_a_role():
    shipped = {p.name for p in MOU_DIR.glob("*.docx") if not p.name.startswith("~$")}
    assert shipped == {d.filename for d in DOCUMENTS.values()}


def test_role_and_subtype_mapping():
    assert document_keys_for("doctor") == ("doctor_onboarding", "doctor_terms")
    assert document_keys_for("nurse") == ("nurse_onboarding", "nursing_home_services_terms")
    assert document_keys_for("physiotherapist") == ("physiotherapist_onboarding", "physiotherapy_terms")
    assert document_keys_for("dietitian") == ("dietitian_terms", "dietetic_services_terms")
    assert document_keys_for("dentist") == ("dental_clinics_terms",)
    assert document_keys_for("staff") == ("logistic_person_terms",)
    assert document_keys_for("phlebotomist", phleb_type="part_time") == ("phlebotomist_part_time",)
    assert document_keys_for("phlebotomist", phleb_type="full_time") == ("phlebotomist_full_time",)
    assert document_keys_for("phlebotomist") == ("phlebotomist_full_time",)
    diagnostic = ("diagnostic_services_agreement", "diagnostic_services_terms", "ecg_xray_pft_audiometry_terms")
    for org_type in ("diagnostic_center", "clinic", "polyclinic", "hospital", None):
        assert document_keys_for("organization", organization_type=org_type) == diagnostic
    assert document_keys_for("organization", organization_type="dental_clinic") == ("dental_clinics_terms",)
    assert document_keys_for("organization", organization_type="physiotherapy_center") == ("physiotherapy_terms",)
    assert document_keys_for("organization", organization_type="nursing_home") == ("nursing_home_services_terms",)
    assert document_keys_for("pharmacy") == ()
    for role in MOU_REQUIRED_ROLES:
        if role.value != "pharmacy":
            assert document_keys_for(role.value), f"{role.value} has no original agreement"


def test_word_list_numbers_and_bullets_are_reproduced():
    # Word keeps these numbers in numbering.xml, not in the text; a plain
    # extraction silently drops every one of them.
    phlebo = render_document("phlebotomist_full_time")["text"]
    assert "3. App Login and Logout Procedure\n1. The phlebotomist must:\n    a. Login personally using authorized credentials." in phlebo
    nurse = render_document("nurse_onboarding")["text"]
    assert "• Dashboard Functions: The Nurse uses this portal to:" in nurse
    assert "    o Configure service schedules, duty shifts, and geographic service radiuses." in nurse
    assert "<strong>4 hours prior notice</strong>" in render_document("nurse_onboarding")["html"]


def test_clauses_missing_from_the_old_stub_are_present():
    agreement = render_document("diagnostic_services_agreement")["text"]
    for clause in (
        "Either party may terminate this agreement by giving thirty (30) days’ written notice.",
        "CALL MEDEX functions only as a digital marketing and appointment facilitation platform.",
        "competent courts at Visakhapatnam, Andhra Pradesh.",
        "ANNEXURE – A",
    ):
        assert clause in agreement


def _signup_token(role, profile, email="mou-test-nobody@example.invalid"):
    payload = {
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "type": "mou_acceptance",
        "role": role,
        "signup_data": {"user_data": {"id": "u-1", "email": email, "full_name": "Test", "role": role},
                        "profile_data": profile},
    }
    return jwt.encode(payload, EMAIL_TOKEN_SECRET, algorithm=ALGORITHM)


def test_preview_serves_the_part_time_phlebotomist_their_own_agreement(monkeypatch):
    monkeypatch.setattr(auth_router, "_get_user_by_email", lambda email: None)
    token = _signup_token("phlebotomist", {"phleb_type": "part_time"})
    body = client.get("/api/auth/mou/preview", params={"token": token}).json()
    assert [d["filename"] for d in body["documents"]] == ["PART TIME PHLEBO (1).docx"]
    assert body["documents"][0]["html"] == render_document("phlebotomist_part_time")["html"]
    assert body["document"]["content_text"] == render_document("phlebotomist_part_time")["text"]


def test_accept_refuses_an_agreement_that_changed_after_the_page_loaded(monkeypatch):
    monkeypatch.setattr(auth_router, "_get_user_by_email", lambda email: None)
    created = []
    monkeypatch.setattr(auth_router, "_create_user", lambda data: created.append(data))
    token = _signup_token("nurse", {})
    r = client.post("/api/auth/accept-mou", json={"token": token, "document_hashes": ["stale"]})
    assert r.status_code == 409
    assert created == []


def test_signup_download_is_the_original_file_and_scoped_to_the_signup():
    token = _signup_token("organization", {"organization_type": "dental_clinic"})
    ok = client.get("/api/auth/mou/documents/dental_clinics_terms/download", params={"token": token})
    assert ok.status_code == 200
    assert ok.content == original_file("dental_clinics_terms")[0]
    denied = client.get("/api/auth/mou/documents/doctor_terms/download", params={"token": token})
    assert denied.status_code == 404


def test_mou_email_carries_full_agreements_and_attaches_originals(monkeypatch):
    sent = {}

    def fake_send(to_email, subject, html_content, text_content, attachments=None):
        sent.update(html=html_content, text=text_content, attachments=attachments)
        return True

    monkeypatch.setattr(EmailService, "_send_real_email", staticmethod(fake_send))
    payload = {"user_data": {"full_name": "Dr Test", "email": "x@example.invalid"}, "profile_data": {}}
    token = EmailService.send_mou_email_for_role("x@example.invalid", "doctor", payload)

    assert jwt.decode(token, EMAIL_TOKEN_SECRET, algorithms=[ALGORITHM])["type"] == "mou_acceptance"
    for key in ("doctor_onboarding", "doctor_terms"):
        doc = render_document(key)
        assert doc["html"] in sent["html"]
        assert doc["text"] in sent["text"]
    assert sent["attachments"] == [original_file("doctor_onboarding"), original_file("doctor_terms")]


def test_acceptance_record_fingerprints_the_accepted_originals(monkeypatch):
    monkeypatch.setattr(legal_service, "supabase", None)
    docs = legal_service.LegalService.get_partner_mou("staff")["documents"]
    record = legal_service.LegalService.record_acceptance(
        user_id="u-1", token="raw.jwt.token", document_id=None, documents=docs,
        ip_address="203.0.113.7", user_agent="pytest",
    )
    assert record["status"] == "accepted"
    assert record["mou_token"] == hashlib.sha256(b"raw.jwt.token").hexdigest()
    assert record["device_info"]["documents"] == [{
        "key": "logistic_person_terms", "filename": "LOGISTIC PERSON.docx",
        "title": docs[0]["title"], "sha256": docs[0]["sha256"],
    }]


def test_pharmacy_keeps_its_platform_text_until_an_original_exists(monkeypatch):
    monkeypatch.setattr(legal_service, "supabase", None)
    mou = legal_service.LegalService.get_partner_mou("pharmacy")
    assert mou["documents"] == []
    assert mou["document"]["content_text"]
