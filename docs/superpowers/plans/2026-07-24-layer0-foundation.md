# Layer 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the marketplace foundation — a unified `users.id`-canonical data model, a tiered verification pipeline with an admin-review authority, verified-only search, and the bundled security/correctness hardening — on the CallMedex FastAPI + Supabase codebase.

**Architecture:** Additive marketplace layer (Approach 1). All marketplace tables key off `provider_user_id → users.id`. A `provider_directory` SQL view is the single search surface. Pure decision/matching/IP/payment logic is extracted into small, unit-tested modules; the verification service and routers orchestrate them. One clean migration (no real data to preserve).

**Tech Stack:** Python 3 / FastAPI 0.115, Supabase (Postgres + PostgREST + Storage), Google Gemini Vision (OCR), pytest + pytest-asyncio (new, for pure-logic TDD), Razorpay, Geoapify (geocoding, already used client-side).

## Global Constraints

- Provider identity is **always `users.id`** in every marketplace table and API. Never a bare/ambiguous UUID.
- The `documents` table has **only** these columns: `id, user_id, document_type, file_url, file_name, verification_status, verification_notes, verified_at, uploaded_at`. **Never** insert `metadata` or `created_at` into `documents`.
- Verification config flags: `VERIFICATION_AUTO_APPROVE` (default `true`), `GOV_REGISTRY_MODE` (`mock`|`off`|`live`, default `mock`). Gov result is **advisory only** unless mode is `live`.
- No endpoint or middleware may return `str(exception)` in a response body. Log server-side with `request_id`; return a generic message.
- Search returns **only** rows with `verification_status='verified' AND is_listed=true`, sourced from the `provider_directory` view.
- All new SQL is idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP ... IF EXISTS`, `CREATE OR REPLACE VIEW`).
- Commit after every task. Branch: `feature/layer0-foundation`.
- Backend commands run from the `backend/` directory unless noted.

---

## File Structure

**Create:**
- `database/layer0_foundation.sql` — the migration (new tables, FK, drops, view).
- `database/layer0_seed.sql` — demo providers for QA.
- `database/verify_layer0.py` — script asserting the migration produced the expected tables/view.
- `backend/requirements-dev.txt` — `pytest`, `pytest-asyncio`.
- `backend/pytest.ini` — pytest config.
- `backend/tests/__init__.py`
- `backend/tests/conftest.py` — shared fixtures.
- `backend/tests/test_strict_match.py`
- `backend/tests/test_verification_decision.py`
- `backend/tests/test_ip_resolution.py`
- `backend/tests/test_payment_verify.py`
- `backend/tests/test_cors_config.py`
- `backend/app/services/storage.py` — Supabase Storage upload helper.
- `backend/app/services/verification_decision.py` — pure matcher + decision engine.
- `backend/app/routers/admin_verification.py` — admin queue + decide endpoints.

**Modify:**
- `backend/app/config.py` — new flags + allowlist + storage bucket.
- `backend/app/services/verification.py` — rewrite pipeline (storage, decision engine, `verification_reviews`, mirror, documents-column fix).
- `backend/app/services/payment.py` — fail-closed + amount check.
- `backend/app/services/fhir.py` — fix `documents` insert columns.
- `backend/app/services/dispatch_engine.py` — fix `get_live_tracking` crash.
- `backend/app/services/telemedicine.py` — real `uuid4` dispatch id.
- `backend/app/models/schemas.py` — dedupe `SlotResponse`; add search/verification response schemas.
- `backend/app/middleware/security.py` — no `str(e)` leak; neutralize `sanitize_input`.
- `backend/app/middleware/rate_limiter.py` — trusted-proxy IP resolution.
- `backend/app/main.py` — CORS allowlist; exception handler (no leak, no 200-downgrade); register admin_verification router.
- `backend/app/routers/provider_management.py` — search via `provider_directory`; fix `search_packages`.
- `backend/app/routers/verification.py` — surface new statuses.
- `frontend/src/app/search/page.tsx` — remove client-side band-aid.

---

## Task 1: Database migration + seed + verify script

**Files:**
- Create: `database/layer0_foundation.sql`
- Create: `database/layer0_seed.sql`
- Create: `database/verify_layer0.py`

**Interfaces:**
- Produces: tables `provider_settings, provider_branches, provider_services, provider_packages, provider_availability, provider_slots, provider_blocked_dates, verification_reviews`; view `provider_directory`; `bookings.provider_id` FK → `users(id)`.

- [ ] **Step 1: Write `database/layer0_foundation.sql`**

```sql
-- ============================================================================
-- Layer 0 Foundation Migration — unified marketplace model
-- Canonical provider identity = users.id. No real data (demo only) → clean drop/rebuild.
-- Idempotent.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Drop superseded / drifted tables (demo data only) ──────────────────────
DROP VIEW IF EXISTS provider_directory;
DROP TABLE IF EXISTS slots CASCADE;
DROP TABLE IF EXISTS health_packages CASCADE;
DROP TABLE IF EXISTS organization_services CASCADE;
DROP TABLE IF EXISTS doctor_availability CASCADE;
DROP TABLE IF EXISTS doctor_blocked_dates CASCADE;
-- organization_packages / organization_timings never existed; nothing to drop.

-- ── provider_settings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_settings (
    provider_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    home_service_enabled BOOLEAN DEFAULT false,
    home_radius_km REAL DEFAULT 10.0,
    commission_pct NUMERIC(5,2) DEFAULT 15.00,
    is_listed BOOLEAN DEFAULT true,
    accepts_online_payment BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── provider_branches ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    phone TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_branches_provider ON provider_branches(provider_user_id);

-- ── provider_services ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES provider_branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'lab_test',
    base_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    home_available BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_services_provider ON provider_services(provider_user_id);

-- ── provider_packages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    included_service_ids UUID[] DEFAULT '{}',
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    home_available BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'approved' CHECK (status IN ('draft','pending','approved','rejected')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_packages_provider ON provider_packages(provider_user_id);

-- ── provider_availability (recurring template) ─────────────────────────────
CREATE TABLE IF NOT EXISTS provider_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES provider_branches(id) ON DELETE SET NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_minutes INT DEFAULT 30,
    capacity_per_slot INT DEFAULT 1,
    mode TEXT DEFAULT 'lab_visit' CHECK (mode IN ('lab_visit','home')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_availability_provider ON provider_availability(provider_user_id);

-- ── provider_slots (concrete, capacity-tracked) ────────────────────────────
CREATE TABLE IF NOT EXISTS provider_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES provider_branches(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INT DEFAULT 1,
    booked_count INT DEFAULT 0,
    mode TEXT DEFAULT 'lab_visit' CHECK (mode IN ('lab_visit','home')),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_slots_provider_date ON provider_slots(provider_user_id, date);

-- ── provider_blocked_dates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_blocked_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES provider_branches(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_blocked_provider ON provider_blocked_dates(provider_user_id);

-- ── verification_reviews (authority record) ────────────────────────────────
CREATE TABLE IF NOT EXISTS verification_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    ai_result JSONB DEFAULT '{}',
    ai_decision TEXT CHECK (ai_decision IN ('auto_approve','auto_reject','needs_review')),
    gov_result JSONB DEFAULT '{}',
    final_status TEXT NOT NULL DEFAULT 'under_review'
        CHECK (final_status IN ('verified','rejected','under_review')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_verification_reviews_status ON verification_reviews(final_status);
CREATE INDEX IF NOT EXISTS idx_verification_reviews_provider ON verification_reviews(provider_user_id);

-- ── Normalize bookings.provider_id → real FK on users(id) ──────────────────
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_provider_id_fkey;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_provider_id_fkey
  FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE SET NULL;

-- ── provider_directory view (single search surface) ────────────────────────
CREATE OR REPLACE VIEW provider_directory AS
SELECT
    u.id AS provider_user_id,
    'organization' AS provider_type,
    o.organization_name AS display_name,
    o.organization_type AS subtype,
    u.city, u.state,
    NULL::double precision AS lat,
    NULL::double precision AS lng,
    5.0::real AS rating,
    o.verification_status,
    COALESCE(ps.is_listed, true) AS is_listed,
    COALESCE(ps.home_service_enabled, false) AS home_service_enabled
FROM organizations o
JOIN users u ON u.id = o.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(o.organization_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'doctor', u.full_name, d.specialization,
    u.city, u.state, NULL, NULL, d.rating, d.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, false)
FROM doctors d
JOIN users u ON u.id = d.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(u.full_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'pharmacy', ph.pharmacy_name, ph.pharmacy_type,
    u.city, u.state, NULL, NULL, 5.0, ph.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, ph.home_delivery)
FROM pharmacies ph
JOIN users u ON u.id = ph.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(ph.pharmacy_name), ''), '') <> '';
```

- [ ] **Step 2: Write `database/layer0_seed.sql`** (demo providers; assumes a demo org user exists — insert one)

```sql
-- Demo data for Layer 0 QA. Idempotent-ish via fixed UUIDs.
INSERT INTO users (id, full_name, email, mobile, password_hash, role, city, state)
VALUES
 ('11111111-1111-1111-1111-111111111111','Vizag Diagnostics Center','demo-org1@callmedex.test','9000000001','x','organization','Visakhapatnam','AP'),
 ('22222222-2222-2222-2222-222222222222','Pending Labs','demo-org2@callmedex.test','9000000002','x','organization','Visakhapatnam','AP')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, user_id, organization_name, organization_type, verification_status)
VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Vizag Diagnostics Center','diagnostic_center','verified'),
 ('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','Pending Labs','diagnostic_center','pending')
ON CONFLICT (id) DO NOTHING;

INSERT INTO provider_settings (provider_user_id, home_service_enabled, is_listed)
VALUES ('11111111-1111-1111-1111-111111111111', true, true)
ON CONFLICT (provider_user_id) DO NOTHING;

INSERT INTO provider_services (provider_user_id, name, category, base_price, home_available)
VALUES ('11111111-1111-1111-1111-111111111111','CBC','lab_test',299,true)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Write `database/verify_layer0.py`** (asserts objects exist via the backend Supabase client)

```python
"""Verify Layer 0 migration applied. Run: python database/verify_layer0.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.database import supabase

TABLES = ["provider_settings","provider_branches","provider_services","provider_packages",
          "provider_availability","provider_slots","provider_blocked_dates","verification_reviews"]

def main():
    assert supabase, "Supabase not configured (.env)"
    for t in TABLES:
        supabase.table(t).select("*").limit(1).execute()
        print(f"OK table {t}")
    rows = supabase.table("provider_directory").select("*").eq("verification_status","verified").execute()
    names = [r["display_name"] for r in rows.data]
    assert all(n and n.strip() for n in names), "directory returned a nameless row"
    print(f"OK provider_directory ({len(names)} verified rows), no nameless rows")

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Apply the migration to dev Supabase**

Run the SQL in the Supabase SQL editor (or via `psql`): paste `database/layer0_foundation.sql` then `database/layer0_seed.sql`.
Expected: no errors; both statements complete.

- [ ] **Step 5: Verify**

Run: `python database/verify_layer0.py`
Expected: prints `OK table ...` for all 8 tables and `OK provider_directory (... verified rows), no nameless rows`.

- [ ] **Step 6: Commit**

```bash
git add database/layer0_foundation.sql database/layer0_seed.sql database/verify_layer0.py
git commit -m "feat(db): Layer 0 unified marketplace schema, directory view, seed + verify script"
```

---

## Task 2: pytest harness + config flags

**Files:**
- Create: `backend/requirements-dev.txt`, `backend/pytest.ini`, `backend/tests/__init__.py`, `backend/tests/conftest.py`
- Modify: `backend/app/config.py`

**Interfaces:**
- Produces: `settings.VERIFICATION_AUTO_APPROVE: bool`, `settings.GOV_REGISTRY_MODE: str`, `settings.TRUSTED_PROXY_COUNT: int`, `settings.ALLOWED_ORIGINS: list[str]`, `settings.VERIFICATION_BUCKET: str`.

- [ ] **Step 1: Create `backend/requirements-dev.txt`**

```
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

- [ ] **Step 2: Create `backend/pytest.ini`**

```ini
[pytest]
testpaths = tests
asyncio_mode = auto
python_files = test_*.py
```

- [ ] **Step 3: Create `backend/tests/__init__.py`** (empty file)

- [ ] **Step 4: Create `backend/tests/conftest.py`**

```python
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))  # make `app` importable
```

- [ ] **Step 5: Add flags to `backend/app/config.py`** (inside `class Settings`, after the AI section)

```python
    # ─── Layer 0: Marketplace foundation flags ────────────────────────
    VERIFICATION_AUTO_APPROVE: bool = os.getenv("VERIFICATION_AUTO_APPROVE", "true").lower() in ("true", "1", "yes")
    GOV_REGISTRY_MODE: str = os.getenv("GOV_REGISTRY_MODE", "mock")  # mock | off | live
    TRUSTED_PROXY_COUNT: int = int(os.getenv("TRUSTED_PROXY_COUNT", "0"))
    ALLOWED_ORIGINS: list = [
        o.strip() for o in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://localhost:3001,https://callmedex-v1.vercel.app"
        ).split(",") if o.strip()
    ]
    VERIFICATION_BUCKET: str = os.getenv("VERIFICATION_BUCKET", "verification-docs")
```

- [ ] **Step 6: Install dev deps and confirm pytest runs**

Run: `pip install -r requirements-dev.txt && pytest -q`
Expected: pytest runs and reports `no tests ran` (0 collected) without import errors.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements-dev.txt backend/pytest.ini backend/tests/__init__.py backend/tests/conftest.py backend/app/config.py
git commit -m "chore: pytest harness + Layer 0 config flags"
```

---

## Task 3: Strict matcher (pure, TDD)

**Files:**
- Create: `backend/app/services/verification_decision.py`
- Test: `backend/tests/test_strict_match.py`

**Interfaces:**
- Produces: `normalize_identifier(s: str) -> str`; `license_match(stored: str, extracted: str) -> bool`; `names_match(stored: str, extracted: str, threshold: float = 0.85) -> bool`.

- [ ] **Step 1: Write the failing test `backend/tests/test_strict_match.py`**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_strict_match.py -v`
Expected: FAIL with `ModuleNotFoundError` / `ImportError` (module not created yet).

- [ ] **Step 3: Implement `backend/app/services/verification_decision.py`** (matcher portion)

```python
"""Pure verification matching + decision logic. No I/O — unit-tested."""
import re
from difflib import SequenceMatcher

_HONORIFIC_RE = re.compile(r"\b(m/s|ms|dr|mr|mrs|prof)\b\.?", re.IGNORECASE)

def normalize_identifier(s: str) -> str:
    if not s:
        return ""
    s = _HONORIFIC_RE.sub("", s.lower())
    return re.sub(r"[^a-z0-9]", "", s)

def license_match(stored: str, extracted: str) -> bool:
    a, b = normalize_identifier(stored), normalize_identifier(extracted)
    return bool(a) and bool(b) and a == b

def names_match(stored: str, extracted: str, threshold: float = 0.85) -> bool:
    a, b = normalize_identifier(stored), normalize_identifier(extracted)
    if not a or not b:
        return False
    if a == b:
        return True
    return SequenceMatcher(None, a, b).ratio() >= threshold
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_strict_match.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/verification_decision.py backend/tests/test_strict_match.py
git commit -m "feat(verify): strict license/name matcher (fixes substring-match weakness)"
```

---

## Task 4: Verification decision engine (pure, TDD)

**Files:**
- Modify: `backend/app/services/verification_decision.py`
- Test: `backend/tests/test_verification_decision.py`

**Interfaces:**
- Consumes: `license_match`, `names_match` (Task 3).
- Produces: `extract_license_from_ocr(ocr: dict, role: str) -> str`; `decide(ocr: dict, stored_name: str, stored_license: str, gov: dict | None, auto_approve_enabled: bool, gov_mode: str, confidence_floor: float = 0.75) -> dict`. Return dict keys: `decision` (`auto_approve|auto_reject|needs_review`), `final_status` (`verified|rejected|under_review`), `reason` (str), `checks` (list[dict]).

- [ ] **Step 1: Write the failing test `backend/tests/test_verification_decision.py`**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_verification_decision.py -v`
Expected: FAIL with `ImportError: cannot import name 'decide'`.

- [ ] **Step 3: Append implementation to `backend/app/services/verification_decision.py`**

```python
def extract_license_from_ocr(ocr: dict, role: str) -> str:
    if role == "pharmacy":
        return (ocr.get("drug_license_number") or ocr.get("registration_number") or "").strip()
    if role == "phlebotomist":
        return (ocr.get("certification_number") or "").strip()
    return (ocr.get("license_number") or "").strip()

def _chk(name, passed, detail):
    return {"check": name, "passed": passed, "detail": detail}

def decide(ocr: dict, stored_name: str, stored_license: str, gov: dict | None,
           auto_approve_enabled: bool, gov_mode: str, confidence_floor: float = 0.75) -> dict:
    checks = []
    if not ocr.get("is_legible", False):
        return {"decision": "auto_reject", "final_status": "rejected",
                "reason": "Document is not legible.", "checks": [_chk("legibility", False, "unreadable")]}
    checks.append(_chk("legibility", True, "readable"))

    if not ocr.get("is_valid_document", False):
        return {"decision": "auto_reject", "final_status": "rejected",
                "reason": "Not a valid certificate.", "checks": checks + [_chk("doc_type", False, "invalid")]}
    checks.append(_chk("doc_type", True, "valid"))

    extracted_license = extract_license_from_ocr(ocr, ocr.get("_role", "")) or (ocr.get("license_number") or "")
    if not license_match(stored_license, extracted_license):
        return {"decision": "auto_reject", "final_status": "rejected",
                "reason": "License/registration number does not match.",
                "checks": checks + [_chk("license_match", False, f"{stored_license} != {extracted_license}")]}
    checks.append(_chk("license_match", True, "match"))

    if not names_match(stored_name, ocr.get("extracted_name") or ""):
        return {"decision": "needs_review", "final_status": "under_review",
                "reason": "Name needs manual review.",
                "checks": checks + [_chk("name_match", False, "differs")]}
    checks.append(_chk("name_match", True, "match"))

    if gov_mode == "live" and gov is not None and not gov.get("is_valid", False):
        return {"decision": "auto_reject", "final_status": "rejected",
                "reason": "Not found in government registry.",
                "checks": checks + [_chk("gov_registry", False, gov.get("status", "not_found"))]}

    if float(ocr.get("confidence_score") or 0) < confidence_floor:
        return {"decision": "needs_review", "final_status": "under_review",
                "reason": "Low extraction confidence — manual review.",
                "checks": checks + [_chk("confidence", False, str(ocr.get("confidence_score")))]}
    checks.append(_chk("confidence", True, str(ocr.get("confidence_score"))))

    if auto_approve_enabled:
        return {"decision": "auto_approve", "final_status": "verified",
                "reason": "All checks passed.", "checks": checks}
    return {"decision": "needs_review", "final_status": "under_review",
            "reason": "Auto-approve disabled — pending admin.", "checks": checks}
```

Note: `decide` reads role via `ocr["_role"]` when present; the caller (Task 6) sets `ocr["_role"] = role` before calling so pharmacy/phlebotomist license fields resolve. The `extract_license_from_ocr` unit test calls it directly with the role arg.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_verification_decision.py -v`
Expected: PASS (9 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/verification_decision.py backend/tests/test_verification_decision.py
git commit -m "feat(verify): tiered decision engine (auto-approve/reject/needs-review)"
```

---

## Task 5: Supabase Storage upload helper

**Files:**
- Create: `backend/app/services/storage.py`

**Interfaces:**
- Produces: `StorageService.upload_verification_doc(user_id: str, file_bytes: bytes, ext: str) -> str` returning the stored object path (or "" on failure); `StorageService.signed_url(path: str, expires: int = 3600) -> str`.

- [ ] **Step 1: Implement `backend/app/services/storage.py`**

```python
"""Supabase Storage helper for verification documents (private bucket)."""
import uuid
import logging
from app.database import supabase
from app.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    @staticmethod
    def upload_verification_doc(user_id: str, file_bytes: bytes, ext: str) -> str:
        """Upload to private bucket; return object path, or '' on failure."""
        if not supabase:
            return ""
        path = f"{user_id}/{uuid.uuid4().hex}.{ext.lstrip('.')}"
        try:
            supabase.storage.from_(settings.VERIFICATION_BUCKET).upload(
                path, file_bytes,
                {"contentType": "application/octet-stream", "upsert": "false"},
            )
            return path
        except Exception as e:
            logger.error(f"Storage upload failed: {e}")
            return ""

    @staticmethod
    def signed_url(path: str, expires: int = 3600) -> str:
        if not supabase or not path:
            return ""
        try:
            res = supabase.storage.from_(settings.VERIFICATION_BUCKET).create_signed_url(path, expires)
            return res.get("signedURL") or res.get("signedUrl") or ""
        except Exception as e:
            logger.error(f"Signed URL failed: {e}")
            return ""
```

- [ ] **Step 2: Create the private bucket in Supabase**

In the Supabase dashboard → Storage → create a bucket named `verification-docs`, **Private**.
Expected: bucket exists, not public.

- [ ] **Step 3: Smoke-test the helper**

Run: `python -c "import sys; sys.path.insert(0,'backend'); from app.services.storage import StorageService; p=StorageService.upload_verification_doc('11111111-1111-1111-1111-111111111111', b'%PDF-1.4 test'*100, 'pdf'); print('path=',p); print('url=',StorageService.signed_url(p)[:60])"`
Expected: prints a non-empty `path=` and a non-empty `url=` beginning with `http`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/storage.py
git commit -m "feat(verify): Supabase Storage helper for verification docs"
```

---

## Task 6: Rewrite verification service (orchestration)

**Files:**
- Modify: `backend/app/services/verification.py`
- Modify: `backend/app/routers/verification.py`

**Interfaces:**
- Consumes: `AIOCRService.extract_certificate_data` (existing); `verification_decision.decide/extract_license_from_ocr` (Tasks 3-4); `StorageService.upload_verification_doc` (Task 5); `GovRegistryAPI._run_gov_check` (existing via `_run_gov_check`).
- Produces: `VerificationService.run_full_verification(user_id, role, file_bytes, mime_type) -> dict` with keys `success, status, message, checks, source`; writes a `documents` row (real columns only) and a `verification_reviews` row; mirrors `verification_status` onto the role table.

- [ ] **Step 1: Replace `run_full_verification` and `_finalize` in `backend/app/services/verification.py`**

Replace the body of `run_full_verification` (lines ~81-276) and `_finalize` (lines ~450-503) with the version below. Keep `VERIFICATION_RULES`, `get_provider_profile`, `_get_user_record`, `_run_gov_check`, and the structural verifiers as-is. Add imports at top: `from app.services.verification_decision import decide, extract_license_from_ocr` and `from app.services.storage import StorageService` and `from app.config import settings`.

```python
    @staticmethod
    async def run_full_verification(user_id, role, file_bytes, mime_type):
        rules = VerificationService.VERIFICATION_RULES.get(role)
        if not rules:
            return {"success": False, "status": "error", "message": f"No rules for role: {role}"}

        profile = await VerificationService.get_provider_profile(user_id, role)
        user_record = await VerificationService._get_user_record(user_id)
        if not profile:
            return {"success": False, "status": "error", "message": f"No {role} profile found"}

        stored_name = ((user_record or {}).get("full_name") if rules["name_field"] == "full_name"
                       else profile.get(rules["name_field"]) or "").strip()
        stored_license = (profile.get(rules["license_field"]) or "").strip()

        # Stage 0: store the document
        ext = "pdf" if "pdf" in mime_type.lower() else mime_type.split("/")[-1]
        doc_path = StorageService.upload_verification_doc(user_id, file_bytes, ext)

        # Stage 1: OCR (retry once on transient failure → under_review, never unfair reject)
        try:
            ocr = AIOCRService.extract_certificate_data(file_bytes, mime_type, role)
        except ValueError as e:
            logger.error(f"[VERIFY] OCR failed for {user_id}: {e}")
            return await VerificationService._finalize(
                user_id, role, doc_path, "under_review", "needs_review",
                {"error": "ocr_unavailable"}, None,
                "Automated check unavailable — under manual review.",
                [{"check": "ai_ocr", "passed": False, "detail": "OCR service error"}])

        ocr["_role"] = role  # so decide() resolves pharmacy/phleb license fields

        # Stage 3: gov check only when we have license + name matched enough to bother
        gov = None
        if settings.GOV_REGISTRY_MODE in ("mock", "live"):
            gov = await VerificationService._run_gov_check(role, profile, stored_name, stored_license)

        # Stage 3: decision
        result = decide(ocr, stored_name, stored_license, gov,
                        settings.VERIFICATION_AUTO_APPROVE, settings.GOV_REGISTRY_MODE)

        return await VerificationService._finalize(
            user_id, role, doc_path, result["final_status"], result["decision"],
            ocr, gov, result["reason"], result["checks"])

    @staticmethod
    async def _finalize(user_id, role, doc_path, final_status, ai_decision,
                        ocr_data, gov_data, reason, checks):
        rules = VerificationService.VERIFICATION_RULES[role]
        now = datetime.now(timezone.utc).isoformat()
        db_status = {"verified": "verified", "rejected": "rejected"}.get(final_status, "pending")

        document_id = str(uuid.uuid4())
        if supabase:
            # documents row — REAL COLUMNS ONLY (no metadata/created_at)
            supabase.table("documents").insert({
                "id": document_id,
                "user_id": user_id,
                "document_type": f"{role}_license",
                "file_url": doc_path or "",
                "file_name": f"{role}_verification.{('pdf' if doc_path.endswith('pdf') else 'img')}",
                "verification_status": db_status,
                "verification_notes": json.dumps({"reason": reason, "checks": checks}),
                "uploaded_at": now,
            }).execute()

            # authority record
            supabase.table("verification_reviews").insert({
                "id": str(uuid.uuid4()),
                "provider_user_id": user_id,
                "role": role,
                "document_id": document_id,
                "ai_result": ocr_data or {},
                "ai_decision": ai_decision,
                "gov_result": gov_data or {},
                "final_status": final_status,
                "created_at": now,
                "decided_at": now if final_status != "under_review" else None,
            }).execute()

            # mirror onto role table (only when a definitive decision)
            if final_status in ("verified", "rejected"):
                supabase.table(rules["table"]).update(
                    {"verification_status": db_status}
                ).eq("user_id", user_id).execute()

        return {"success": final_status == "verified", "status": final_status,
                "message": reason, "checks": checks, "source": rules["verification_source"]}
```

- [ ] **Step 2: Fix `upload_document` columns in the same file** (lines ~618-643): change the insert dict to real columns only.

```python
        doc_data = {
            "id": doc_id,
            "user_id": user_id,
            "document_type": document_type,
            "file_url": file_url,
            "file_name": (metadata or {}).get("file_name", ""),
            "verification_status": "pending",
            "uploaded_at": now,
        }
```
(Remove the `"metadata"` and `"created_at"` keys entirely.)

- [ ] **Step 3: Manual pipeline smoke test** (auto-approve path) with a legible demo doctor + matching license.

Run (with server running and a doctor JWT in `$TOKEN`):
`curl -s -H "Authorization: Bearer $TOKEN" -F "file=@sample_license.jpg" http://localhost:8000/api/verification/verify-document`
Expected: JSON `success` reflects the tier; no `PGRST204`; a `documents` row and a `verification_reviews` row appear in Supabase.

- [ ] **Step 4: Confirm no PGRST204 regression**

Run: `python database/verify_layer0.py` then check `verification_reviews` has a row:
`python -c "import sys;sys.path.insert(0,'backend');from app.database import supabase;print(supabase.table('verification_reviews').select('id',count='exact').execute().count)"`
Expected: prints an integer ≥ 1, no exception.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/verification.py backend/app/routers/verification.py
git commit -m "feat(verify): rebuild pipeline — storage, decision engine, reviews authority, documents-column fix"
```

---

## Task 7: Admin verification dashboard (authority endpoints)

**Files:**
- Create: `backend/app/routers/admin_verification.py`
- Modify: `backend/app/main.py` (register router)

**Interfaces:**
- Consumes: `get_current_user` (existing); `StorageService.signed_url` (Task 5); `NotificationEngine.send_multi` (existing); role-table names from `VerificationService.VERIFICATION_RULES`.
- Produces: `GET /api/admin/verifications?status=` (queue); `POST /api/admin/verifications/{review_id}/decide`.

- [ ] **Step 1: Implement `backend/app/routers/admin_verification.py`**

```python
"""Admin verification review — the authority over provider verification."""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.middleware.auth import get_current_user
from app.database import supabase
from app.services.storage import StorageService
from app.services.notification_engine import NotificationEngine
from app.services.verification import VerificationService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/verifications", tags=["Admin Verification"])

def _require_admin(user: dict):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

class DecideRequest(BaseModel):
    decision: str  # 'approve' | 'reject'
    reason: str = ""

@router.get("")
async def list_reviews(status: str = "under_review", current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    if not supabase:
        return {"success": True, "reviews": []}
    rows = (supabase.table("verification_reviews").select("*")
            .eq("final_status", status).order("created_at", desc=True).limit(100).execute()).data or []
    out = []
    for r in rows:
        doc_url = ""
        if r.get("document_id"):
            d = supabase.table("documents").select("file_url").eq("id", r["document_id"]).execute()
            if d.data:
                doc_url = StorageService.signed_url(d.data[0].get("file_url", ""))
        out.append({**r, "document_signed_url": doc_url})
    return {"success": True, "reviews": out}

@router.post("/{review_id}/decide")
async def decide_review(review_id: str, req: DecideRequest, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    if req.decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="decision must be 'approve' or 'reject'")
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    rev = supabase.table("verification_reviews").select("*").eq("id", review_id).execute()
    if not rev.data:
        raise HTTPException(status_code=404, detail="Review not found")
    review = rev.data[0]
    final_status = "verified" if req.decision == "approve" else "rejected"
    now = datetime.now(timezone.utc).isoformat()

    supabase.table("verification_reviews").update({
        "final_status": final_status, "reviewed_by": current_user["sub"],
        "review_reason": req.reason, "decided_at": now,
    }).eq("id", review_id).execute()

    rules = VerificationService.VERIFICATION_RULES.get(review["role"])
    if rules:
        supabase.table(rules["table"]).update(
            {"verification_status": final_status}
        ).eq("user_id", review["provider_user_id"]).execute()

    msg = ("Your account has been verified. You are now live on CallMedex."
           if final_status == "verified"
           else f"Your verification was not approved. Reason: {req.reason or 'documents did not meet requirements'}.")
    await NotificationEngine.send_multi(review["provider_user_id"], ["in_app", "email"],
                                        "Verification update", msg)
    return {"success": True, "final_status": final_status}
```

- [ ] **Step 2: Register the router in `backend/app/main.py`** (after `provider_management` include)

```python
from app.routers import admin_verification
app.include_router(admin_verification.router)
```

- [ ] **Step 3: Smoke test with an admin JWT**

Run: `curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8000/api/admin/verifications?status=under_review"`
Expected: `{"success": true, "reviews": [...]}` including `document_signed_url` for rows with a document.

Then decide one:
`curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"decision":"approve","reason":"looks good"}' http://localhost:8000/api/admin/verifications/<review_id>/decide`
Expected: `{"success": true, "final_status": "verified"}`; the provider's role-table `verification_status` flips to `verified`; a notification row appears.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/admin_verification.py backend/app/main.py
git commit -m "feat(verify): admin verification queue + decide authority endpoints"
```

---

## Task 8: Verified-only search via provider_directory

**Files:**
- Modify: `backend/app/routers/provider_management.py` (`search_organizations`, `search_packages`; add `search_providers`)
- Modify: `frontend/src/app/search/page.tsx` (remove band-aid)

**Interfaces:**
- Produces: `GET /api/search/providers` with query params `type, city, home_service, q, limit`; returns `{success, providers: [{provider_user_id, display_name, provider_type, subtype, city, rating, home_service_enabled, min_price, verification_status}]}`.

- [ ] **Step 1: Add `search_providers` to `provider_management.py`** (near the other `/search` routes)

```python
@router.get("/search/providers")
async def search_providers(
    type: Optional[str] = None,
    city: Optional[str] = None,
    home_service: Optional[bool] = None,
    q: Optional[str] = None,
    limit: int = Query(50, le=100),
):
    """Marketplace search — verified + listed providers only, from provider_directory."""
    if not supabase:
        return {"success": True, "providers": []}
    try:
        query = (supabase.table("provider_directory").select("*")
                 .eq("verification_status", "verified").eq("is_listed", True))
        if type:
            t = "diagnostic_center" if type in ("lab", "diagnostic") else type
            query = query.eq("subtype", t) if t in ("diagnostic_center", "hospital", "clinic", "poly_clinic") else query.eq("provider_type", t)
        if home_service is True:
            query = query.eq("home_service_enabled", True)
        rows = query.limit(100).execute().data or []

        out = []
        for r in rows:
            if city and city.strip().lower() not in f"{r.get('city','')} {r.get('state','')}".lower():
                continue
            if q and q.strip().lower() not in f"{r.get('display_name','')} {r.get('subtype','')} {r.get('city','')}".lower():
                continue
            # min price rollup
            min_price = None
            svc = (supabase.table("provider_services").select("base_price")
                   .eq("provider_user_id", r["provider_user_id"]).eq("is_active", True)
                   .order("base_price").limit(1).execute()).data
            if svc:
                min_price = float(svc[0]["base_price"])
            out.append({**r, "min_price": min_price})
            if len(out) >= limit:
                break
        return {"success": True, "providers": out}
    except Exception as e:
        logger.error(f"search_providers error: {e}")
        return {"success": True, "providers": []}
```

- [ ] **Step 2: Rewrite `search_organizations` to read the directory** (replace its body, lines ~1042-1148)

```python
@router.get("/search/organizations")
async def search_organizations(org_type: Optional[str] = None, city: Optional[str] = None,
                               q: Optional[str] = None, limit: int = 50):
    """Back-compat wrapper → verified orgs from provider_directory."""
    res = await search_providers(type=org_type or "organization", city=city, q=q, limit=limit)
    orgs = [{
        "id": p["provider_user_id"], "user_id": p["provider_user_id"],
        "name": p["display_name"], "organization_name": p["display_name"],
        "type": p["subtype"], "organization_type": p["subtype"],
        "city": p.get("city", ""), "state": p.get("state", ""),
        "verification_status": p["verification_status"], "min_price": p.get("min_price"),
    } for p in res["providers"] if p["provider_type"] == "organization" or (org_type and org_type != "doctor")]
    return {"success": True, "organizations": orgs}
```

- [ ] **Step 3: Fix `search_packages`** (replace `organization_packages` → `provider_packages`, lines ~1151-1175)

```python
@router.get("/search/packages")
async def search_packages(limit: int = Query(50, le=100)):
    if not supabase:
        return {"success": True, "packages": []}
    try:
        result = (supabase.table("provider_packages").select("*")
                  .eq("is_active", True).eq("status", "approved").limit(limit).execute())
        return {"success": True, "packages": result.data or []}
    except Exception as e:
        logger.error(f"Error fetching packages: {e}")
        return {"success": True, "packages": []}
```

- [ ] **Step 4: Remove the frontend band-aid in `frontend/src/app/search/page.tsx`**

Revert the uncommitted `.filter(...)` change: the count and map go back to plain `results.length` / `results.map(...)`, since the API can no longer return nameless rows. Restore the original naming fallback line:

```tsx
          <h2 style={{ fontSize: "1.2rem", color: "#334155", marginBottom: "20px" }}>
            {results.length} {results.length === 1 ? "Result" : "Results"} Found
          </h2>
          <div style={{ display: "grid", gap: "20px" }}>
            {results.map((org) => {
              const orgName = (org.organization_name || org.name || "").trim() || `${(org.organization_type || org.type || "Healthcare").replace(/_/g, " ").toUpperCase()} Facility`;
```

- [ ] **Step 5: Verify verified-only invariant against dev data**

Run: `curl -s "http://localhost:8000/api/provider-management/search/organizations?org_type=diagnostic_center" | python -c "import sys,json;d=json.load(sys.stdin);print([o['name'] for o in d['organizations']])"`
Expected: prints `['Vizag Diagnostics Center']` — the seeded `Pending Labs` (status `pending`) is **absent**.

(Confirm the router prefix in the curl path matches `provider_management`'s actual `APIRouter(prefix=...)`; adjust if different.)

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/provider_management.py frontend/src/app/search/page.tsx
git commit -m "feat(search): verified-only marketplace search via provider_directory; remove client band-aid"
```

---

## Task 9: Hardening — CORS + exception leak

**Files:**
- Test: `backend/tests/test_cors_config.py`
- Modify: `backend/app/main.py`, `backend/app/middleware/security.py`

**Interfaces:**
- Produces: `is_origin_allowed(origin: str, allowlist: list[str]) -> bool` in `backend/app/main.py`.

- [ ] **Step 1: Write failing test `backend/tests/test_cors_config.py`**

```python
from app.main import is_origin_allowed

def test_allowed_origin_passes():
    assert is_origin_allowed("http://localhost:3000", ["http://localhost:3000"]) is True

def test_arbitrary_origin_rejected():
    assert is_origin_allowed("https://evil.example.com", ["http://localhost:3000"]) is False

def test_empty_origin_rejected():
    assert is_origin_allowed("", ["http://localhost:3000"]) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_cors_config.py -v`
Expected: FAIL (`cannot import name 'is_origin_allowed'`).

- [ ] **Step 3: Edit `backend/app/main.py`** — add helper, replace CORS block, fix exception handlers.

Add helper near top:
```python
def is_origin_allowed(origin: str, allowlist: list) -> bool:
    return bool(origin) and origin in allowlist
```
Replace the `ALLOWED_ORIGINS = [...]` block and `add_middleware(CORSMiddleware, ...)` with:
```python
ALLOWED_ORIGINS = settings.ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-RateLimit-Remaining", "X-RateLimit-Limit", "X-RateLimit-Reset", "Retry-After"],
)
```
(Delete `allow_origin_regex=r"https?://.*"` and the hardcoded `.append(...)` origins — move any needed prod origins into the `ALLOWED_ORIGINS` env var.)

Fix `global_exception_handler`: return status 500 with a generic body and `request_id`; **do not** downgrade DB errors to 200 and **do not** include `str(exc)`:
```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(f"[{request_id}] Unhandled exception on {request.url.path}")
    return JSONResponse(status_code=500, content={
        "success": False, "message": "An unexpected error occurred.", "request_id": request_id})
```

- [ ] **Step 4: Edit `backend/app/middleware/security.py`** — remove `str(e)` from the 500 branch (lines ~67-80):

```python
        except Exception as e:
            logger.error(f"[{request_id}] Unhandled error: {e}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": "An internal error occurred.", "request_id": request_id},
            )
```
(Remove the reflected `Access-Control-Allow-Origin: origin` headers — CORS is owned by `CORSMiddleware`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_cors_config.py -v`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add backend/tests/test_cors_config.py backend/app/main.py backend/app/middleware/security.py
git commit -m "fix(security): explicit CORS allowlist; stop leaking exception text"
```

---

## Task 10: Hardening — rate-limit IP resolution (TDD)

**Files:**
- Test: `backend/tests/test_ip_resolution.py`
- Modify: `backend/app/middleware/rate_limiter.py`

**Interfaces:**
- Produces: `resolve_client_ip(xff: str | None, direct_ip: str, trusted_proxy_count: int) -> str`.

- [ ] **Step 1: Write failing test `backend/tests/test_ip_resolution.py`**

```python
from app.middleware.rate_limiter import resolve_client_ip

def test_no_trusted_proxy_ignores_xff():
    # spoof attempt: client sends XFF=127.0.0.1 to dodge limits; must be ignored
    assert resolve_client_ip("127.0.0.1", "203.0.113.9", 0) == "203.0.113.9"

def test_one_trusted_proxy_takes_second_from_right():
    assert resolve_client_ip("203.0.113.9, 10.0.0.1", "10.0.0.1", 1) == "203.0.113.9"

def test_missing_xff_uses_direct():
    assert resolve_client_ip(None, "203.0.113.9", 1) == "203.0.113.9"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_ip_resolution.py -v`
Expected: FAIL (`cannot import name 'resolve_client_ip'`).

- [ ] **Step 3: Edit `backend/app/middleware/rate_limiter.py`** — add the function and use it in `_get_client_ip`.

```python
def resolve_client_ip(xff, direct_ip: str, trusted_proxy_count: int) -> str:
    if trusted_proxy_count <= 0 or not xff:
        return direct_ip
    parts = [p.strip() for p in xff.split(",") if p.strip()]
    idx = len(parts) - trusted_proxy_count
    return parts[idx - 1] if 0 < idx <= len(parts) else direct_ip
```
Change `_get_client_ip` to:
```python
def _get_client_ip(request: Request) -> str:
    from app.config import settings
    direct = request.client.host if request.client else "unknown"
    return resolve_client_ip(request.headers.get("x-forwarded-for"), direct, settings.TRUSTED_PROXY_COUNT)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_ip_resolution.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_ip_resolution.py backend/app/middleware/rate_limiter.py
git commit -m "fix(security): trusted-proxy-aware client IP (closes XFF rate-limit bypass)"
```

---

## Task 11: Hardening — payment fail-closed + amount (TDD)

**Files:**
- Test: `backend/tests/test_payment_verify.py`
- Modify: `backend/app/services/payment.py`

**Interfaces:**
- Produces: `signature_is_valid(order_id: str, payment_id: str, signature: str, secret: str) -> bool`; `amounts_match(order_amount, paid_amount) -> bool` in `payment.py`.

- [ ] **Step 1: Write failing test `backend/tests/test_payment_verify.py`**

```python
import hmac, hashlib
from app.services.payment import PaymentService

def _sig(order, pay, secret):
    return hmac.new(secret.encode(), f"{order}|{pay}".encode(), hashlib.sha256).hexdigest()

def test_valid_signature_true():
    assert PaymentService.signature_is_valid("o1", "p1", _sig("o1","p1","sek"), "sek") is True

def test_tampered_signature_false():
    assert PaymentService.signature_is_valid("o1", "p1", "deadbeef", "sek") is False

def test_amounts_match_exact():
    assert PaymentService.amounts_match(200.0, 200.0) is True

def test_amounts_mismatch():
    assert PaymentService.amounts_match(200.0, 1.0) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_payment_verify.py -v`
Expected: FAIL (`AttributeError: signature_is_valid`).

- [ ] **Step 3: Edit `backend/app/services/payment.py`** — add the two static helpers and make `verify_payment` fail-closed.

Add helpers to the `PaymentService` class:
```python
    @staticmethod
    def signature_is_valid(order_id, payment_id, signature, secret) -> bool:
        if not (order_id and payment_id and signature and secret):
            return False
        expected = hmac.new(secret.encode("utf-8"), f"{order_id}|{payment_id}".encode("utf-8"), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    @staticmethod
    def amounts_match(order_amount, paid_amount) -> bool:
        try:
            return abs(float(order_amount) - float(paid_amount)) < 0.01
        except (TypeError, ValueError):
            return False
```
In `verify_payment`, before the DB update, **fail closed**:
```python
        if not settings.RAZORPAY_KEY_SECRET or not PaymentService.signature_is_valid(
            razorpay_order_id, razorpay_payment_id, razorpay_signature, settings.RAZORPAY_KEY_SECRET
        ):
            logger.warning(f"Payment signature invalid/missing for {razorpay_order_id}")
            return {"verified": False, "error": "Invalid payment signature"}
        # amount check: stored order amount (rupees) vs Razorpay-captured amount (paise→rupees)
        stored_amount = None
        if supabase:
            row = supabase.table("payments").select("amount").eq("razorpay_order_id", razorpay_order_id).execute()
            if row.data:
                stored_amount = row.data[0]["amount"]
        try:
            captured = client.payment.fetch(razorpay_payment_id)
            captured_rupees = float(captured.get("amount", 0)) / 100.0
        except Exception as e:
            logger.error(f"Could not fetch payment for amount check: {e}")
            return {"verified": False, "error": "Could not confirm payment amount"}
        if stored_amount is not None and not PaymentService.amounts_match(stored_amount, captured_rupees):
            logger.warning(f"Amount mismatch on {razorpay_order_id}: stored {stored_amount} vs captured {captured_rupees}")
            return {"verified": False, "error": "Amount mismatch"}
```
(Remove the old "continue with db update" fallback and the final `return {"verified": True, ...}` unconditional path — only return verified after a passing signature check.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_payment_verify.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_payment_verify.py backend/app/services/payment.py
git commit -m "fix(payments): fail-closed signature verification + amount check"
```

---

## Task 12: Hardening — small correctness fixes

**Files:**
- Modify: `backend/app/services/fhir.py`, `backend/app/services/dispatch_engine.py`, `backend/app/services/telemedicine.py`, `backend/app/models/schemas.py`, `backend/app/middleware/security.py`

- [ ] **Step 1: Fix `fhir.py` documents insert** (lines ~328-337) — real columns only:

```python
        if supabase:
            supabase.table("documents").insert({
                "id": push_id,
                "user_id": push_record.get("patient_user_id", "") or "",
                "document_type": "abdm_fhir_push",
                "file_url": "",
                "file_name": "fhir_push.json",
                "verification_status": "verified",
                "verification_notes": json.dumps(push_record),
                "uploaded_at": now,
            }).execute()
```
(Ensure `import json` is present in `fhir.py`; remove the `"metadata"` and `"created_at"` keys.)

- [ ] **Step 2: Fix `dispatch_engine.get_live_tracking`** — delete the stray reassignment.

In `get_live_tracking`, **remove** the line `dispatch = result.data[0]` that appears *after* the `if not dispatch: return {...}` guard (≈ line 626). The `dispatch` variable is already correctly set by the Supabase-or-local lookup above; the reassignment crashes on the local/DB-miss path.

- [ ] **Step 3: Fix `telemedicine.order_prescribed_actions` dispatch id** (line ~559):

```python
        dispatch_id = str(uuid.uuid4())
```
(Replace `f"disp_{str(uuid.uuid4())[:8]}"` so it satisfies the `dispatch_requests.id` UUID column.)

- [ ] **Step 4: Dedupe `SlotResponse` in `schemas.py`** — the second definition (the patient-response one, ~line 329) is renamed to `SlotAllotmentResponse`, and the first (slot listing) keeps the name `SlotResponse`. Update the import alias in `bookings.py` (`SlotResponse as SlotResponseSchema`) to import `SlotAllotmentResponse as SlotResponseSchema`.

```python
class SlotAllotmentResponse(BaseModel):
    """Patient responds to an allotted slot."""
    accepted: bool
    reason: Optional[str] = None
```

- [ ] **Step 5: Neutralize `sanitize_input` mangling in `security.py`** — stop regex-deleting SQL/XSS substrings from legitimate text; keep only null-byte stripping and trimming:

```python
def sanitize_input(value: str) -> str:
    if not isinstance(value, str):
        return value
    return value.replace("\x00", "").strip()
```
(Leave `sanitize_dict` calling this; the SQL/XSS pattern lists can be deleted.)

- [ ] **Step 6: Run the full unit suite to confirm nothing regressed**

Run: `pytest -q`
Expected: all tests from Tasks 3, 4, 9, 10, 11 pass (green).

- [ ] **Step 7: Confirm the app still imports**

Run: `python -c "import sys;sys.path.insert(0,'backend');import app.main; print('import OK')"`
Expected: prints `import OK` (no ImportError from the `SlotResponse` rename).

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/fhir.py backend/app/services/dispatch_engine.py backend/app/services/telemedicine.py backend/app/models/schemas.py backend/app/middleware/security.py
git commit -m "fix: documents columns (fhir), live-tracking crash, dispatch uuid, dedupe SlotResponse, neutralize sanitizer"
```

---

## Task 13: Reconcile legacy scripts + final integration pass

**Files:**
- Modify: legacy `test_*.py` scripts referencing dropped tables (`slots`, `health_packages`, `organization_services`); `backend/app/routers/bookings.py` (`get_org_services_for_booking` uses `organization_services`/`organization_packages`).

- [ ] **Step 1: Update `bookings.py::get_org_services_for_booking`** — point at new tables: `provider_services` (filter `provider_user_id`), `provider_packages` (filter `provider_user_id`, `status='approved'`), and `provider_availability` for timings. Keep the graceful try/except structure; only the table names + filter columns change (`organization_id` → `provider_user_id`).

- [ ] **Step 2: Grep for any remaining references to dropped tables**

Run: `grep -rn "health_packages\|organization_services\|\"slots\"\|table('slots')\|doctor_availability" backend/app`
Expected: no results (or only in comments). Fix any hits by mapping to the new tables per Section 4.3 of the spec.

- [ ] **Step 3: Full backend import + unit suite + migration verify**

Run: `pytest -q && python database/verify_layer0.py`
Expected: all unit tests pass; verify script prints all-OK.

- [ ] **Step 4: Manual end-to-end smoke (server running)**

1. Sign up a doctor → upload a matching legible license → `verify-document` returns `verified` (auto-approve path).
2. `GET /api/provider-management/search/providers?type=doctor` → the doctor appears; an unverified one does not.
3. Sign up an org, leave it pending → it is **absent** from search; it appears in `GET /api/admin/verifications?status=under_review`; admin approves → it now appears in search.
Expected: all three behave as described.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/bookings.py
git commit -m "refactor(bookings): point org service/package/timing reads at new provider_* tables"
```

---

## Self-Review Notes (completed by plan author)

- **Spec coverage:** §4 data model → Task 1; §5 verification (storage/OCR/match/decision/reviews/admin/errors) → Tasks 3-7; §6 search → Task 8; §7 hardening items 1-9 → Tasks 9-12; §8 testing → tests in Tasks 3,4,9,10,11 + verify scripts + Task 13 e2e. All spec sections mapped.
- **Deferred (per spec §1/§9), intentionally not in this plan:** MOU-token fix, DPDP consent, localStorage→cookie.
- **Type consistency:** `decide()` return keys (`decision/final_status/reason/checks`) consumed identically in Task 6; `verification_reviews.final_status` enum matches migration CHECK; `resolve_client_ip`, `signature_is_valid`, `is_origin_allowed`, `StorageService.*` names match between definition and use.
- **Known limitation (queued follow-up):** no test database — DB/storage/HTTP paths are covered by scripted smoke tests, not automated integration tests. Standing up an ephemeral Supabase/testcontainers harness is a recommended follow-up.
