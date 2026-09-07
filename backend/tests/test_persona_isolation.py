import pytest
from app.utils.personas import is_test_persona
from app.database import supabase


def test_is_test_persona_rule_evaluation():
    # 1. Internal domain
    assert is_test_persona({"email": "doctor.chaitanyakumarf11@callmedex.internal"}) is True
    assert is_test_persona({"email": "nurse.test@internal.callmedex.com"}) is True

    # 2. Registrant role
    assert is_test_persona({"email": "custom@gmail.com", "registrant_role": "master_persona"}) is True
    assert is_test_persona({"email": "custom@gmail.com", "registrant_role": "test_persona"}) is True
    assert is_test_persona({"email": "custom@gmail.com", "registrant_role": "sandbox"}) is True

    # 3. Owner email link (for non-admin personas)
    assert is_test_persona({"email": "custom@gmail.com", "owner_email": "chaitanyakumarf11@gmail.com", "role": "doctor"}) is True
    assert is_test_persona({"email": "custom@gmail.com", "owner_email": "chaitanyakumarf11@gmail.com", "role": "phlebotomist"}) is True

    # 4. Master Admin itself should NOT be treated as a hidden persona
    assert is_test_persona({"email": "chaitanyakumarf11@gmail.com", "role": "admin"}) is False
    assert is_test_persona({"email": "chaitanyakumarf11@gmail.com", "owner_email": "chaitanyakumarf11@gmail.com", "role": "admin"}) is False

    # 5. Real public user
    assert is_test_persona({"email": "realpatient@gmail.com", "role": "patient", "registrant_role": "patient"}) is False
    assert is_test_persona({"email": "realdoctor@apollo.com", "role": "doctor", "registrant_role": "doctor"}) is False


@pytest.mark.asyncio
async def test_doctor_search_excludes_test_personas():
    from app.routers.provider_management import search_doctors

    res = await search_doctors()
    doctors = res.get("doctors", [])

    for d in doctors:
        doc_name = d.get("name", "")
        doc_email = d.get("email", "") or ""
        assert "Latchireddi" not in doc_name, f"Master test doctor leaked into public doctor search: {d}"
        assert not doc_email.endswith("@callmedex.internal"), f"Internal email leaked: {doc_email}"


@pytest.mark.asyncio
async def test_provider_search_excludes_test_personas():
    from app.routers.provider_management import search_providers

    res = await search_providers(type="doctor")
    providers = res.get("providers", [])

    for p in providers:
        name = p.get("display_name", "")
        email = p.get("email", "") or ""
        assert "Latchireddi" not in name, f"Test doctor leaked in provider directory: {p}"
        assert not email.endswith("@callmedex.internal"), f"Internal email leaked in provider directory: {p}"


@pytest.mark.asyncio
async def test_telemed_available_doctors_excludes_test_personas():
    from app.services.telemedicine import TelemedicineService

    doctors = await TelemedicineService.get_available_doctors()
    for d in doctors:
        name = d.get("name", "")
        assert "Latchireddi" not in name, f"Test doctor leaked in telemed available doctors: {d}"


@pytest.mark.asyncio
async def test_dispatch_engine_excludes_test_phlebotomists():
    from app.services.dispatch_engine import UniversalDispatchEngine

    # Vizag coordinates where Rajesh Verma was pinned (17.7280, 83.3080)
    candidates = await UniversalDispatchEngine.find_nearby_providers(17.7280, 83.3080, "phlebotomist", radius_km=50.0)

    for c in candidates:
        name = c.get("name", "") or c.get("full_name", "")
        email = c.get("email", "") or ""
        assert "Rajesh Verma" not in name, f"Test phlebotomist leaked into dispatch candidates: {c}"
        assert not email.endswith("@callmedex.internal"), f"Internal email leaked into dispatch: {c}"


@pytest.mark.asyncio
async def test_pharmacy_search_excludes_test_pharmacy():
    from app.routers.pharmacy_orders import search_pharmacies

    res = await search_pharmacies(city="Visakhapatnam")
    pharmacies = res.get("pharmacies", [])

    for p in pharmacies:
        name = p.get("pharmacy_name", "")
        assert "CallMedex Prime Pharmacy" not in name, f"Test pharmacy leaked in public pharmacy search: {p}"


@pytest.mark.asyncio
async def test_master_admin_auth_and_persona_login():
    from app.routers.auth import login, UserLogin

    # 1. Login directly as Master Admin
    admin_login = await login(UserLogin(email="chaitanyakumarf11@gmail.com", password="Callmedex@123", role="admin"))
    assert admin_login.user["role"] == "admin"
    assert admin_login.access_token is not None

    # 2. Login as Doctor persona using master credentials
    doc_login = await login(UserLogin(email="chaitanyakumarf11@gmail.com", password="Callmedex@123", role="doctor"))
    assert doc_login.user["role"] == "doctor"
    assert doc_login.access_token is not None

    # 3. Login as Pharmacy persona using master credentials
    pharm_login = await login(UserLogin(email="chaitanyakumarf11@gmail.com", password="Callmedex@123", role="pharmacy"))
    assert pharm_login.user["role"] == "pharmacy"
    assert pharm_login.access_token is not None


