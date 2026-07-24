from app.services.verification_decision import decide, extract_license_from_ocr

GOOD_OCR = {"is_legible": True, "is_valid_document": True, "extracted_name": "Sai Kumar",
            "license_number": "AB1234", "confidence_score": 0.9}

def test_illegible_auto_rejects():
    ocr = {**GOOD_OCR, "is_legible": False}
    r = decide(ocr, "Sai Kumar", "AB1234", None, True, "mock")
    assert r["decision"] == "auto_reject" and r["final_status"] == "rejected"

def test_license_mismatch_auto_rejects():
    ocr = {**GOOD_OCR, "license_number": "ZZ9999"}
    r = decide(ocr, "Sai Kumar", "AB1234", None, True, "mock")
    assert r["decision"] == "auto_reject"

def test_name_mismatch_goes_to_review_not_reject():
    ocr = {**GOOD_OCR, "extracted_name": "Completely Different"}
    r = decide(ocr, "Sai Kumar", "AB1234", None, True, "mock")
    assert r["decision"] == "needs_review" and r["final_status"] == "under_review"

def test_high_confidence_match_auto_approves_when_enabled():
    r = decide(GOOD_OCR, "Sai Kumar", "AB1234", None, True, "mock")
    assert r["decision"] == "auto_approve" and r["final_status"] == "verified"

def test_match_goes_to_review_when_auto_approve_disabled():
    r = decide(GOOD_OCR, "Sai Kumar", "AB1234", None, False, "mock")
    assert r["decision"] == "needs_review"

def test_low_confidence_goes_to_review():
    ocr = {**GOOD_OCR, "confidence_score": 0.4}
    r = decide(ocr, "Sai Kumar", "AB1234", None, True, "mock")
    assert r["decision"] == "needs_review"

def test_gov_invalid_in_live_mode_auto_rejects():
    gov = {"is_valid": False, "status": "not_found"}
    r = decide(GOOD_OCR, "Sai Kumar", "AB1234", gov, True, "live")
    assert r["decision"] == "auto_reject"

def test_gov_invalid_in_mock_mode_is_advisory_only():
    gov = {"is_valid": False, "status": "not_found"}
    r = decide(GOOD_OCR, "Sai Kumar", "AB1234", gov, True, "mock")
    assert r["decision"] == "auto_approve"

def test_pharmacy_license_extraction():
    ocr = {"drug_license_number": "DL-99", "registration_number": "R1"}
    assert extract_license_from_ocr(ocr, "pharmacy") == "DL-99"
