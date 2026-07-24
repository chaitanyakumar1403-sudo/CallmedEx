from app.services.verification_decision import license_match, names_match

def test_license_exact_match_ignores_case_and_punctuation():
    assert license_match("AB-1234", "ab1234") is True

def test_license_substring_is_NOT_a_match():
    # The old bug: "AB12" matched "AB1299999". Must be False now.
    assert license_match("AB12", "AB1299999") is False
    assert license_match("AB1299999", "AB12") is False

def test_license_empty_is_not_a_match():
    assert license_match("", "AB12") is False

def test_names_match_ignores_honorific_and_spacing():
    assert names_match("Dr. Sai Kumar", "sai  kumar") is True

def test_names_substring_is_not_a_match():
    assert names_match("Ann", "Anne Smith") is False
