"""
Test Suite for Platform-Wide Dietitian & Physiotherapist Integration,
Master Scope of Services Catalogs, 80/20 Commercial Split, and Legal MOUs.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.schemas import UserRole, ScopeOfServiceItem
from app.services.legal import LegalService, ROLE_MOU_MAP, FALLBACK_MOU
from app.services.scope_catalogs import (
    get_master_catalog_for_role,
    compute_commercial_split,
    sanitize_selected_scope,
    DIETITIAN_MASTER_CATALOG,
    PHYSIOTHERAPIST_MASTER_CATALOG,
)
from app.services.payment import PLATFORM_COMMISSION_RATE, PaymentService
from app.routers.auth import ROLE_TABLE_MAP

client = TestClient(app)


def test_dietitian_and_physiotherapist_roles_and_table_mapping():
    """Verify role enums exist and map to their respective database tables."""
    assert UserRole.DIETITIAN == "dietitian"
    assert UserRole.PHYSIOTHERAPIST == "physiotherapist"
    assert ROLE_TABLE_MAP[UserRole.DIETITIAN] == "dietitians"
    assert ROLE_TABLE_MAP[UserRole.PHYSIOTHERAPIST] == "physiotherapists"


def test_mou_legal_documents_configured_for_new_roles():
    """Verify legal documents exist for dietitian and physiotherapist."""
    assert "dietitian" in ROLE_MOU_MAP
    assert "physiotherapist" in ROLE_MOU_MAP

    diet_doc = LegalService.get_active_document("dietitian")
    assert diet_doc is not None
    assert "Dietetic" in diet_doc["title"]
    assert "80/20" in diet_doc["content_text"]

    physio_doc = LegalService.get_active_document("physiotherapist")
    assert physio_doc is not None
    assert "Physiotherapy" in physio_doc["title"]
    assert "80/20" in physio_doc["content_text"]


def test_80_20_commercial_split_calculation():
    """Verify strict 80% provider remuneration and 20% platform fee calculation."""
    # Benchmark Teleconsult: ₹400 -> ₹320 Provider, ₹80 Platform
    split_400 = compute_commercial_split(400.0)
    assert split_400["custom_price"] == 400.0
    assert split_400["platform_fee_amount"] == 80.0
    assert split_400["provider_share_amount"] == 320.0

    # Benchmark Home Visit: ₹800 -> ₹640 Provider, ₹160 Platform
    split_800 = compute_commercial_split(800.0)
    assert split_800["custom_price"] == 800.0
    assert split_800["platform_fee_amount"] == 160.0
    assert split_800["provider_share_amount"] == 640.0

    # Custom rate: ₹1500 -> ₹1200 Provider, ₹300 Platform
    split_1500 = compute_commercial_split(1500.0)
    assert split_1500["custom_price"] == 1500.0
    assert split_1500["platform_fee_amount"] == 300.0
    assert split_1500["provider_share_amount"] == 1200.0

    # Global payment commission rate invariant
    assert PLATFORM_COMMISSION_RATE == 0.20


def test_scope_catalogs_non_empty_and_structured():
    """Verify master scope catalogs contain valid items with category, modality, and price."""
    diet_catalog = get_master_catalog_for_role("dietitian")
    assert len(diet_catalog) >= 10
    for item in diet_catalog:
        assert "id" in item
        assert "service_name" in item
        assert "benchmark_price" in item
        assert item["benchmark_price"] > 0
        assert item["provider_share_amount"] == round(item["benchmark_price"] * 0.8, 2)
        assert item["platform_fee_amount"] == round(item["benchmark_price"] * 0.2, 2)

    physio_catalog = get_master_catalog_for_role("physiotherapist")
    assert len(physio_catalog) >= 10
    for item in physio_catalog:
        assert "id" in item
        assert "service_name" in item
        assert item["benchmark_price"] > 0
        assert item["provider_share_amount"] == round(item["benchmark_price"] * 0.8, 2)
        assert item["platform_fee_amount"] == round(item["benchmark_price"] * 0.2, 2)


def test_scope_sanitization_preserves_custom_prices():
    """Verify custom pricing entered by provider during MOU acceptance is recalculated cleanly."""
    custom_inputs = [
        {
            "id": "diet_tele_consult",
            "service_name": "Dietitian Online Teleconsultation (Dietary Recall & Meal Plan)",
            "category": "Consultation",
            "modality": "online",
            "benchmark_price": 400.0,
            "custom_price": 600.0,  # Provider sets ₹600
            "is_active": True,
        }
    ]
    sanitized = sanitize_selected_scope("dietitian", custom_inputs)
    assert len(sanitized) == 1
    item = sanitized[0]
    assert item["custom_price"] == 600.0
    assert item["platform_fee_amount"] == 120.0  # 20%
    assert item["provider_share_amount"] == 480.0  # 80%


def test_get_role_catalog_api_endpoint():
    """Verify GET /api/providers/catalog/{role} returns catalog and 80/20 split."""
    res_diet = client.get("/api/providers/catalog/dietitian")
    assert res_diet.status_code == 200
    data_diet = res_diet.json()
    assert data_diet["success"] is True
    assert data_diet["data"]["role"] == "dietitian"
    assert len(data_diet["data"]["catalog"]) >= 10
    assert data_diet["data"]["commercial_split"]["provider_share_pct"] == 80.0
    assert data_diet["data"]["commercial_split"]["platform_fee_pct"] == 20.0

    res_pt = client.get("/api/providers/catalog/physiotherapist")
    assert res_pt.status_code == 200
    data_pt = res_pt.json()
    assert data_pt["success"] is True
    assert data_pt["data"]["role"] == "physiotherapist"
    assert len(data_pt["data"]["catalog"]) >= 10


def test_search_returns_nothing_when_no_real_provider_is_registered():
    """This endpoint used to fall back to a hardcoded roster of invented
    specialists ("Dr. Rajesh Varma, MPT", "Dt. Ananya Sharma, RD") whenever the
    table was empty, so a patient could book a consultation with — and pay for —
    a person who does not exist. Empty must mean empty."""
    for role in ("dietitian", "physiotherapist"):
        res = client.get(f"/api/providers/search?role={role}")
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        names = [p["full_name"] for p in body["data"]["providers"]]
        for invented in ("Rajesh Varma", "Ananya Sharma", "Sneha Hegde", "Priya Nair"):
            assert not any(invented in n for n in names), f"fabricated provider {invented!r} returned"


def test_search_returns_real_verified_providers(monkeypatch):
    """A genuinely registered, verified provider is returned with their own
    fees and no invented rating."""
    import app.routers.provider_scope as ps

    row = {
        "id": "pt-row-1",
        "user_id": "usr-pt-1",
        "specializations": ["Orthopedic Rehab"],
        "qualification": "MPT",
        "years_of_experience": 5,
        "consultation_fee": 550.0,
        "home_visit_fee": 900.0,
        "rating": None,
        "total_reviews": 0,
        "available_for_online": True,
        "available_for_home_visit": True,
        "clinic_center_name": "Test Physio Centre",
        "scope_of_services": [{"service": "Gait training"}],
        "users": {
            "full_name": "Test Physio",
            "city": "Visakhapatnam",
            "state": "Andhra Pradesh",
            "district": "Visakhapatnam",
            "mobile": "9000000000",
        },
    }

    class _Res:
        data = [row]

    class _Q:
        def select(self, *a, **k):
            return self

        def eq(self, *a, **k):
            return self

        def execute(self):
            return _Res()

    class _DB:
        def table(self, _name):
            return _Q()

    monkeypatch.setattr(ps, "supabase", _DB())

    body = client.get("/api/providers/search?role=physiotherapist").json()
    providers = body["data"]["providers"]
    assert len(providers) == 1
    p = providers[0]
    assert p["full_name"] == "Test Physio"
    assert p["consultation_fee"] == 550.0
    # Unrated stays unrated — no manufactured 4.9.
    assert p["rating"] is None
    assert p["district"] == "Visakhapatnam"

    # District filter is actually applied (it used to be accepted and ignored).
    filtered = client.get(
        "/api/providers/search?role=physiotherapist&district=Krishna"
    ).json()
    assert filtered["data"]["providers"] == []


def test_payment_service_order_split_calculation():
    """Verify PaymentService.create_order calculates 20% platform fee and 80% provider payout."""
    try:
        order = PaymentService.create_order(
            amount=1000.0,
            booking_id="test_b_101",
            patient_id="test_p_101",
            provider_id="test_prov_101",
        )
        assert order["amount"] == 1000.0
        assert order["platform_fee"] == 200.0  # 20% of 1000
        assert order["provider_payout"] == 800.0  # 80% of 1000
    except ValueError as e:
        # If live gateway not configured and dev mock disabled, ValueError is raised cleanly
        assert "Payment gateway" in str(e) or "not configured" in str(e)
