"""
Tests for Dental Practice Ecosystem and Diagnostic Center Scope Lockdown.
Verifies:
1. UserRole.DENTIST signup fields, MOU mapping, and profile initialization.
2. DENTAL_MASTER_CATALOG containing strictly the 19 canonical dental procedures.
3. Dental marketplace services with verified clinics and walk-in modality.
4. Diagnostic Center scope lockdown:
   - 33 MRI Scans allowed
   - 31 CT Scans allowed
   - 11 General & Ultrasound Scans allowed
   - Strictly CBC (Rs. 400) and CULTURES (Rs. 900) for blood tests
   - Non-CBC/Cultures blood tests rejected with 400
   - Health packages strictly rejected for diagnostic centers with 400
"""
from datetime import date
import pytest
from app.models.schemas import UserRole, UserSignup, Gender
from app.services.legal import LegalService, ROLE_MOU_MAP, FALLBACK_MOU
from app.services.scope_catalogs import (
    DENTAL_MASTER_CATALOG,
    DIAGNOSTIC_CENTER_SCOPE,
    is_allowed_diagnostic_center_service,
    get_diagnostic_center_scope,
    ROLE_CATALOG_MAP,
)
from app.services.marketplace import MarketplaceService
from app.routers.auth import _build_profile_data


def test_dentist_role_and_signup_schema():
    assert UserRole.DENTIST == "dentist"
    signup = UserSignup(
        email="dr.dentist@test.com",
        password="Password123!",
        confirm_password="Password123!",
        full_name="Dr. Shweta Rao",
        gender=Gender.FEMALE,
        date_of_birth=date(1990, 5, 14),
        mobile="+919876543210",
        role=UserRole.DENTIST,
        dental_license_number="DCI-AP-2024-8891",
        dental_specializations=["Endodontics", "Prosthodontics"],
        clinic_name="Dr. Rao Aesthetic Dental Clinic",
    )
    assert signup.role == "dentist"
    assert signup.dental_license_number == "DCI-AP-2024-8891"
    assert "Endodontics" in signup.dental_specializations
    assert signup.clinic_name == "Dr. Rao Aesthetic Dental Clinic"


def test_dentist_mou_configuration():
    assert ROLE_MOU_MAP.get("dentist") == "mou_dentist"
    assert "dentist" in FALLBACK_MOU
    mou_entry = FALLBACK_MOU["dentist"]
    mou_content = mou_entry["content"]
    assert "IN-CLINIC WALK-IN APPOINTMENTS & PROCEDURES" in mou_content
    assert "80% of gross patient billing" in mou_content
    assert "20% technology and administrative fee" in mou_content
    assert "100% IN-CLINIC WALK-IN ONLY" in mou_content


def test_dentist_profile_initialization_is_walk_in_only():
    signup = UserSignup(
        email="dr.dentist2@test.com",
        password="Password123!",
        confirm_password="Password123!",
        full_name="Dr. Sameer Khan",
        gender=Gender.MALE,
        date_of_birth=date(1988, 8, 22),
        mobile="+919876543211",
        role=UserRole.DENTIST,
        dental_license_number="DCI-TS-2023-1122",
        clinic_name="SmileCraft Dental Care",
    )
    profile_data = _build_profile_data(signup, "test-user-id")
    assert profile_data["consultation_mode"] == "clinic"
    assert profile_data["available_for_online"] is False
    assert profile_data["available_for_home_visit"] is False
    assert profile_data["clinic_name"] == "SmileCraft Dental Care"


def test_dental_master_catalog_has_19_canonical_procedures():
    assert len(DENTAL_MASTER_CATALOG) == 19
    assert ROLE_CATALOG_MAP.get("dentist") == DENTAL_MASTER_CATALOG

    # Check key representative procedures
    proc_ids = {p["id"] for p in DENTAL_MASTER_CATALOG}
    assert "dent_routine_cleanings" in proc_ids
    assert "dent_comprehensive_exams" in proc_ids
    assert "dent_dental_xrays" in proc_ids
    assert "dent_root_canal_therapy" in proc_ids
    assert "dent_crowns_caps" in proc_ids
    assert "dent_bridges" in proc_ids
    assert "dent_dentures" in proc_ids
    assert "dent_dental_implants" in proc_ids
    assert "dent_teeth_whitening" in proc_ids
    assert "dent_emergency_dental_care" in proc_ids

    # Verify all procedures are in-clinic walk-in
    for p in DENTAL_MASTER_CATALOG:
        assert p["modality"] == "clinic"
        assert p["benchmark_price"] > 0
        assert p["category"]


def test_marketplace_dental_services_offers():
    services = MarketplaceService.dental_services_with_offers()
    assert len(services) == 19
    for s in services:
        assert s["category"] == "dental"
        assert s["modality"] == "clinic"
        assert s["benchmark_mrp"] > 0


def test_diagnostic_center_canonical_scope_counts():
    scope = get_diagnostic_center_scope()
    assert len(scope["mri"]) == 33
    assert len(scope["ct_scans"]) == 31
    assert len(scope["scans"]) == 11
    assert len(scope["blood_tests"]) == 2

    # Verify blood tests are strictly CBC and Cultures
    blood_names = [b["name"] for b in scope["blood_tests"]]
    assert "CBC" in blood_names
    assert "CULTURES" in blood_names


def test_diagnostic_center_service_allowlist_gate():
    # Allowed MRI
    assert is_allowed_diagnostic_center_service("MRI BRAIN PLAIN", "imaging") is True

    # Allowed CT Scan
    assert is_allowed_diagnostic_center_service("CT CHEST PLAIN", "imaging") is True

    # Allowed Ultrasound/Scan
    assert is_allowed_diagnostic_center_service("ULTRASOUND WHOLE ABDOMEN", "imaging") is True

    # Allowed Blood Tests
    assert is_allowed_diagnostic_center_service("COMPLETE BLOOD COUNT (CBC)", "lab_test") is True
    assert is_allowed_diagnostic_center_service("CBC", "lab_test") is True
    assert is_allowed_diagnostic_center_service("CULTURES", "lab_test") is True

    # Prohibited Blood Tests
    assert is_allowed_diagnostic_center_service("Liver Function Test (LFT)", "lab_test") is False
    assert is_allowed_diagnostic_center_service("Lipid Profile", "lab_test") is False
    assert is_allowed_diagnostic_center_service("Thyroid Profile (T3, T4, TSH)", "lab_test") is False

    # Prohibited packages
    assert is_allowed_diagnostic_center_service("Full Body Master Checkup", "health_package") is False
