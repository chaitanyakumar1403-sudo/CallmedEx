# Processing Center Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Processing Center layer — entity, auth, city assignment, CallMedex-owned home-service catalog, family-aware sample lifecycle, batches, chain of custody and advance rostering — so a patient books a blood test from CallMedex and never sees a centre or a laboratory.

**Architecture:** One idempotent SQL migration built up section by section across tasks. New backend services under `app/services/`, a PC-scoped auth dependency under `app/middleware/`, and new routers registered in `app/main.py`. The existing `samples` / `sample_events` / `sample_handovers` tables are extended in place so the phlebo wallet payout keeps working. No UI in this plan.

**Tech Stack:** Python 3 / FastAPI, Supabase (Postgres) via `app.database.supabase`, Celery (`app/workers/celery_app.py`), pytest with `asyncio_mode = auto`.

**Spec:** `docs/superpowers/specs/2026-07-28-processing-center-foundation-design.md`

## Global Constraints

- **One migration file:** `database/task1_processing_center_foundation.sql`. Every task appends its own section to this same file. The whole file must stay re-runnable top to bottom.
- **Migration conventions**, matching `database/phase1_sample_lifecycle.sql`: wrapped in `BEGIN;` / `COMMIT;`, `IF NOT EXISTS` on every object, `SET search_path = ''` on every new function, an explicit deny-all RLS policy on every new table, and `NOTIFY pgrst, 'reload schema';` as the final statement after `COMMIT`.
- **No fabricated seed data.** Consistent with commits `c5d0fb3` and `68ea5eb`: no fictitious partner laboratory name, no fake staff account, no pre-verified status. Centres seed at `status = 'onboarding'` with `partner_lab_name = ''`.
- **Patient payloads never contain** `processing_center_id`, `processing_center`, `partner_lab_name`, `laboratory_name`, `laboratory_org_id`, or a centre `code`. Task 17 enforces this with automated guards.
- **Tests** live in `backend/tests/`, run from `backend/`, and use `FakeSupabase` imported from `tests.test_sample_lifecycle`.
- **Run tests with:** `cd backend && python -m pytest tests/<file> -v`
- **Table naming:** the catalog table is `home_services`, never `blood_tests`. Task 1 seeds only `service_kind = 'blood_test'`.
- **Currency** is INR, stored `NUMERIC(10,2)`. Distances are kilometres, `NUMERIC(6,2)`.
- **Timezone** for all operational cutoffs is `Asia/Kolkata`.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `database/task1_processing_center_foundation.sql` | The single migration, built up across tasks |
| `backend/app/middleware/pc_auth.py` | `get_current_pc_staff`, `require_pc_admin` |
| `backend/app/services/processing_center.py` | Centre resolution, coverage, booking assignment |
| `backend/app/services/tube_derivation.py` | Pure catalog→tube grouping, no DB |
| `backend/app/services/roster.py` | Advance next-day assignment pass, decline/reassign |
| `backend/app/routers/processing_center_admin.py` | Admin: centres, staff, areas |
| `backend/app/routers/home_services.py` | Admin catalog CRUD + patient search + coverage |
| `backend/app/routers/family_members.py` | Patient family member CRUD |
| `backend/app/routers/roster.py` | Centre roster + phlebo advance job list |
| `backend/tests/test_processing_center.py` | Resolver, coverage, assignment |
| `backend/tests/test_tube_derivation.py` | Pure unit tests |
| `backend/tests/test_home_services_catalog.py` | Catalog, pricing, deletion rule |
| `backend/tests/test_sample_verification.py` | Lifecycle transitions, batches, custody |
| `backend/tests/test_roster.py` | Advance rostering |
| `backend/tests/test_patient_payload_leaks.py` | Leak guards |

**Modified:**

| File | Change |
|---|---|
| `database/schema.sql`, `database/complete_supabase_schema.sql` | `users.role` CHECK gains `processing_center` |
| `backend/app/services/dispatch_engine.py` | Centre filter on candidates; urgent centre-wide fan-out |
| `backend/app/services/samples.py` | Barcode binding, verification, batching |
| `backend/app/main.py` | Register four new routers |
| `backend/tests/test_sample_lifecycle.py` | `FakeSupabase` barcode-uniqueness fix for nullable barcodes |

---

## Task 1: Processing centres, staff and serviceable areas

**Files:**
- Create: `database/task1_processing_center_foundation.sql`
- Modify: `database/schema.sql:18`, `database/complete_supabase_schema.sql:18` and `:36`
- Test: `backend/tests/test_processing_center.py`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `processing_centers`, `processing_center_staff`, `processing_center_areas`, `city_aliases`. The `processing_center` value on the `users.role` CHECK constraint.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_processing_center.py`:

```python
"""
Processing Center foundation tests.

The centre is an internal operational entity. Three things must hold:
  1. A booking always resolves to exactly one centre, deterministically.
  2. A city with no centre is refused BEFORE payment, never after.
  3. No centre or laboratory identity ever reaches a patient.
"""
import re
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "database" / "task1_processing_center_foundation.sql"


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_migration_exists_and_is_transactional():
    sql = _sql()
    assert sql.lstrip().startswith("BEGIN;")
    assert "COMMIT;" in sql
    assert "NOTIFY pgrst, 'reload schema';" in sql


def test_centre_tables_are_created():
    sql = _sql()
    for table in (
        "processing_centers",
        "processing_center_staff",
        "processing_center_areas",
        "city_aliases",
    ):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql, table


def test_every_new_table_has_a_deny_all_rls_policy():
    """The backend uses the service key and bypasses RLS; the frontend has no
    Supabase client at all. Anything reachable by anon is a bug."""
    sql = _sql()
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "Deny all access" in sql
    for table in ("processing_centers", "processing_center_staff",
                  "processing_center_areas", "city_aliases"):
        assert f"'{table}'" in sql, f"{table} missing from the RLS loop"


def test_seed_invents_no_laboratory_and_no_verified_status():
    """Commits c5d0fb3 and 68ea5eb: never seed a fake verified facility."""
    sql = _sql()
    assert "'HYD-01'" in sql and "'VSP-01'" in sql

    # Isolate the seed INSERT and assert on ITS column list and values, so this
    # test can actually fail if someone adds a laboratory name later.
    seed = re.search(
        r"INSERT INTO processing_centers\s*\(([^)]*)\)\s*VALUES(.*?);",
        sql, re.S)
    assert seed, "processing_centers seed INSERT not found"
    columns, values = seed.group(1), seed.group(2)

    assert "partner_lab_name" not in columns, "seed must not name a laboratory"
    assert "partner_lab_reference" not in columns
    assert "'onboarding'" in values, "centres must seed as onboarding"
    for forbidden in ("'active'", "'verified'"):
        assert forbidden not in values, f"seed must not pre-{forbidden.strip(chr(39))}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_processing_center.py -v`
Expected: FAIL — `FileNotFoundError`, the migration does not exist.

- [ ] **Step 3: Create the migration with section 1**

Create `database/task1_processing_center_foundation.sql`:

```sql
-- ============================================================================
-- CallMedex Task 1 — Processing Center Foundation
--
-- Spec: docs/superpowers/specs/2026-07-28-processing-center-foundation-design.md
--
-- The Processing Center is the operational layer between phlebotomists and
-- partner laboratories. The patient books from CallMedex and never sees a
-- centre, a laboratory or a diagnostic centre anywhere in this flow.
--
-- Idempotent — safe to re-run. New functions pin search_path (lint 0011) and
-- every new table gets an explicit deny-all policy (lint 0008): the FastAPI
-- backend uses the service key and bypasses RLS.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PROCESSING CENTRES
--    Created only by a CallMedex admin. There is deliberately no signup route,
--    no MOU flow and no verification pipeline entry for a centre.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS processing_centers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        TEXT NOT NULL UNIQUE,              -- 'HYD-01', 'VSP-01'
    name        TEXT NOT NULL,
    city        TEXT NOT NULL,
    address     TEXT DEFAULT '',
    pincode     TEXT DEFAULT '',
    state       TEXT DEFAULT '',
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,

    -- Internal only. Must never appear in a patient-facing payload.
    partner_lab_name      TEXT DEFAULT '',
    partner_lab_reference TEXT DEFAULT '',

    daily_capacity INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'onboarding'
        CHECK (status IN ('onboarding', 'active', 'paused', 'closed')),

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pc_city   ON processing_centers(city) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_pc_status ON processing_centers(status);

-- Several people work at HYD-01, so the custody actor is the person, not the
-- centre. One shared login would make the chain of custody meaningless.
CREATE TABLE IF NOT EXISTS processing_center_staff (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processing_center_id UUID NOT NULL REFERENCES processing_centers(id) ON DELETE CASCADE,
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pc_role              TEXT NOT NULL CHECK (pc_role IN ('admin', 'technician')),
    is_active            BOOLEAN DEFAULT true,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (processing_center_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pc_staff_user ON processing_center_staff(user_id) WHERE is_active;

-- Serviceable areas. Today one city row per centre reproduces the
-- "one PC per city" rollout; adding HYD-02 later is a row, not a code change.
CREATE TABLE IF NOT EXISTS processing_center_areas (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processing_center_id UUID NOT NULL REFERENCES processing_centers(id) ON DELETE CASCADE,
    city      TEXT,                    -- normalised, lowercase
    pincode   TEXT,                    -- when set, the strongest match
    radius_km NUMERIC(6,2),            -- geo fallback around the centre
    priority  INT NOT NULL DEFAULT 100,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_pc_areas_pincode ON processing_center_areas(pincode) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_pc_areas_city    ON processing_center_areas(city)    WHERE is_active;

-- Without this, 'Vizag' / 'Visakhapatnam' / 'VISAKHAPATNAM' silently fail to
-- resolve and the patient is told their city is unserviced.
CREATE TABLE IF NOT EXISTS city_aliases (
    alias          TEXT PRIMARY KEY,
    canonical_city TEXT NOT NULL
);

INSERT INTO city_aliases (alias, canonical_city) VALUES
 ('vizag',            'visakhapatnam'),
 ('visakhapatnam',    'visakhapatnam'),
 ('vishakhapatnam',   'visakhapatnam'),
 ('hyd',              'hyderabad'),
 ('hyderabad',        'hyderabad'),
 ('secunderabad',     'hyderabad')
ON CONFLICT (alias) DO NOTHING;

-- Centres seed at 'onboarding' with no laboratory name. A real admin activates
-- them and enters the real partner. Nothing here is pre-verified.
INSERT INTO processing_centers (code, name, city, state, status)
VALUES
 ('HYD-01', 'Hyderabad Processing Centre 01',     'hyderabad',     'Telangana',      'onboarding'),
 ('VSP-01', 'Visakhapatnam Processing Centre 01', 'visakhapatnam', 'Andhra Pradesh', 'onboarding')
ON CONFLICT (code) DO NOTHING;

INSERT INTO processing_center_areas (processing_center_id, city, priority)
SELECT pc.id, pc.city, 100
  FROM processing_centers pc
 WHERE pc.code IN ('HYD-01', 'VSP-01')
   AND NOT EXISTS (
        SELECT 1 FROM processing_center_areas a
         WHERE a.processing_center_id = pc.id AND a.city = pc.city
   );

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ROLE
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient','doctor','phlebotomist','organization','staff',
                  'pharmacy','nurse','ambulance','admin','supervisor',
                  'processing_center'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 99. RLS — deny-all by default (lint 0008)
--     This block is appended to as later sections add tables.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    t TEXT;
    new_tables TEXT[] := ARRAY[
        'processing_centers', 'processing_center_staff',
        'processing_center_areas', 'city_aliases'
    ];
BEGIN
    FOREACH t IN ARRAY new_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Deny all access" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Deny all access" ON public.%I '
            'FOR ALL TO public USING (false) WITH CHECK (false)', t);
    END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 4: Update the two canonical schema files**

In `database/schema.sql:18` and `database/complete_supabase_schema.sql:18`, add `'processing_center'` to the inline `role` CHECK list. In `database/complete_supabase_schema.sql:36`, add it to the standalone constraint too. All three lists must match the migration exactly.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_processing_center.py -v`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add database/task1_processing_center_foundation.sql database/schema.sql database/complete_supabase_schema.sql backend/tests/test_processing_center.py
git commit -m "feat(pc): processing centre, staff and serviceable-area tables"
```

---

## Task 2: PC-scoped auth

**Files:**
- Create: `backend/app/middleware/pc_auth.py`
- Test: `backend/tests/test_processing_center.py` (append)

**Interfaces:**
- Consumes: `processing_center_staff` (Task 1), `get_current_user` from `app/middleware/auth.py`.
- Produces:
  - `async def get_current_pc_staff(user: dict) -> dict` returning `{"user_id", "role", "processing_center_id", "pc_role"}`
  - `async def require_pc_admin(staff: dict) -> dict`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_processing_center.py`:

```python
import uuid
import pytest
from fastapi import HTTPException

import app.middleware.pc_auth as pc_auth_mod
from app.middleware.pc_auth import get_current_pc_staff, require_pc_admin
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(pc_auth_mod, "supabase", fake)
    return fake


def _seed_staff(fake, pc_role="technician", is_active=True):
    uid, cid = str(uuid.uuid4()), str(uuid.uuid4())
    fake.db.setdefault("processing_center_staff", []).append({
        "id": str(uuid.uuid4()), "processing_center_id": cid,
        "user_id": uid, "pc_role": pc_role, "is_active": is_active,
    })
    return uid, cid


@pytest.mark.asyncio
async def test_staff_resolves_to_their_centre(fake_db):
    uid, cid = _seed_staff(fake_db)
    staff = await get_current_pc_staff({"sub": uid, "role": "processing_center"})
    assert staff["processing_center_id"] == cid
    assert staff["pc_role"] == "technician"


@pytest.mark.asyncio
async def test_a_non_pc_role_is_rejected(fake_db):
    uid, _ = _seed_staff(fake_db)
    with pytest.raises(HTTPException) as exc:
        await get_current_pc_staff({"sub": uid, "role": "patient"})
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_a_deactivated_staff_member_is_rejected(fake_db):
    uid, _ = _seed_staff(fake_db, is_active=False)
    with pytest.raises(HTTPException) as exc:
        await get_current_pc_staff({"sub": uid, "role": "processing_center"})
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_technician_cannot_pass_the_admin_gate(fake_db):
    uid, cid = _seed_staff(fake_db, pc_role="technician")
    staff = await get_current_pc_staff({"sub": uid, "role": "processing_center"})
    with pytest.raises(HTTPException) as exc:
        await require_pc_admin(staff)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_pc_admin_passes_the_admin_gate(fake_db):
    uid, cid = _seed_staff(fake_db, pc_role="admin")
    staff = await get_current_pc_staff({"sub": uid, "role": "processing_center"})
    assert (await require_pc_admin(staff))["processing_center_id"] == cid
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_processing_center.py -v -k pc_staff or admin_gate`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.middleware.pc_auth'`.

- [ ] **Step 3: Write the implementation**

Create `backend/app/middleware/pc_auth.py`:

```python
"""
Processing Center auth.

A centre id is NEVER taken from a request path or body. It is resolved from the
authenticated user's staff row, so a technician at HYD-01 cannot read or write
VSP-01's samples by editing a URL.
"""
import logging

from fastapi import Depends, HTTPException

from app.database import supabase
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)

DENIED = "Not an active Processing Center staff account."


async def get_current_pc_staff(user: dict = Depends(get_current_user)) -> dict:
    """Resolve the caller to their active processing centre staff row."""
    if user.get("role") != "processing_center":
        raise HTTPException(status_code=403, detail=DENIED)

    user_id = user.get("sub") or user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=403, detail=DENIED)

    result = (
        supabase.table("processing_center_staff")
        .select("processing_center_id, pc_role, is_active")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    rows = getattr(result, "data", None) or []
    if not rows:
        raise HTTPException(status_code=403, detail=DENIED)

    row = rows[0]
    return {
        "user_id": user_id,
        "role": "processing_center",
        "processing_center_id": row["processing_center_id"],
        "pc_role": row["pc_role"],
    }


async def require_pc_admin(staff: dict = Depends(get_current_pc_staff)) -> dict:
    """Catalog and roster writes are centre-admin only; technicians scan and verify."""
    if staff.get("pc_role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="This action requires a Processing Center administrator.",
        )
    return staff
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_processing_center.py -v`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/middleware/pc_auth.py backend/tests/test_processing_center.py
git commit -m "feat(pc): centre-scoped auth dependency"
```

---

## Task 3: Home-service catalog schema

**Files:**
- Modify: `database/task1_processing_center_foundation.sql` (append section 3)
- Test: `backend/tests/test_home_services_catalog.py`

**Interfaces:**
- Consumes: `processing_centers` (Task 1), existing `service_catalog`.
- Produces: tables `tube_types`, `home_services`, `home_service_tubes`, `home_service_city_pricing`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_home_services_catalog.py`:

```python
"""
Home-service catalog tests.

The catalog is CallMedex's. A diagnostic centre publishes walk-in imaging in
provider_services; it does not publish anything a phlebotomist delivers.
"""
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "database" / "task1_processing_center_foundation.sql"


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_catalog_tables_are_created():
    sql = _sql()
    for table in ("tube_types", "home_services",
                  "home_service_tubes", "home_service_city_pricing"):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql, table


def test_the_table_is_home_services_not_blood_tests():
    """service_kind lets ECG and home vitals land as rows, not a migration."""
    sql = _sql()
    assert "CREATE TABLE IF NOT EXISTS blood_tests" not in sql
    assert "service_kind" in sql
    for kind in ("'blood_test'", "'ecg'", "'vitals'"):
        assert kind in sql, kind


def test_all_ten_named_blood_tests_are_seeded():
    sql = _sql()
    for code in ("CBC", "LFT", "KFT", "LIPID", "HBA1C",
                 "THYROID", "VITD", "VITB12", "ESR", "CRP"):
        assert f"'{code}'" in sql, code


def test_five_tube_types_are_seeded():
    sql = _sql()
    for tube in ("edta_lavender", "sst_gold", "citrate_blue",
                 "fluoride_grey", "plain_red"):
        assert f"'{tube}'" in sql, tube


def test_pricing_override_is_keyed_on_centre():
    """CallMedex may price Vizag differently from Hyderabad. The centre may not."""
    sql = _sql()
    assert "UNIQUE (home_service_id, processing_center_id)" in sql
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_home_services_catalog.py -v`
Expected: 5 failed — the tables are not in the migration yet.

- [ ] **Step 3: Append section 3 to the migration**

Insert immediately before the `-- 99. RLS` block in `database/task1_processing_center_foundation.sql`:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 3. HOME-SERVICE CATALOG — owned by CallMedex, not by any centre
--
--    Two service families, deliberately kept apart:
--      home services (here)   blood tests, ECG, vitals — CallMedex prices them,
--                             a phlebotomist delivers them, the patient never
--                             sees a provider.
--      walk-in services       MRI, CT, X-ray — the diagnostic centre publishes
--      (provider_services)    and prices them, and the patient picks a centre.
--                             UNCHANGED by this migration.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tube_types (
    code              TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    cap_colour        TEXT DEFAULT '',
    additive          TEXT DEFAULT '',
    typical_volume_ml NUMERIC(5,2),
    is_active         BOOLEAN DEFAULT true
);

INSERT INTO tube_types (code, name, cap_colour, additive, typical_volume_ml) VALUES
 ('edta_lavender', 'EDTA (Lavender)',   'lavender', 'K2/K3 EDTA',     3.0),
 ('sst_gold',      'SST (Gold)',        'gold',     'Clot activator + gel', 5.0),
 ('citrate_blue',  'Citrate (Blue)',    'blue',     'Sodium citrate', 2.7),
 ('fluoride_grey', 'Fluoride (Grey)',   'grey',     'Sodium fluoride', 2.0),
 ('plain_red',     'Plain (Red)',       'red',      'None',           5.0)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS home_services (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Reuses the existing synonym dictionary so "Haemogram" still finds CBC.
    catalog_id   UUID REFERENCES service_catalog(id) ON DELETE SET NULL,
    code         TEXT NOT NULL UNIQUE,
    service_kind TEXT NOT NULL DEFAULT 'blood_test'
        CHECK (service_kind IN ('blood_test', 'ecg', 'vitals')),
    name        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'blood_test',
    description TEXT DEFAULT '',

    base_price                NUMERIC(10,2) NOT NULL,
    urgent_surcharge_override NUMERIC(10,2),   -- NULL => platform_settings knob

    home_collection_available BOOLEAN DEFAULT true,
    fasting_required          BOOLEAN DEFAULT false,
    fasting_hours             INT DEFAULT 0,
    preparation_instructions  TEXT DEFAULT '',
    estimated_report_hours    INT,

    is_active  BOOLEAN DEFAULT true,           -- the enable/disable switch
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_services_active ON home_services(service_kind) WHERE is_active;

CREATE TABLE IF NOT EXISTS home_service_tubes (
    home_service_id UUID NOT NULL REFERENCES home_services(id) ON DELETE CASCADE,
    tube_type_code  TEXT NOT NULL REFERENCES tube_types(code),
    volume_ml       NUMERIC(5,2),
    PRIMARY KEY (home_service_id, tube_type_code)
);

CREATE TABLE IF NOT EXISTS home_service_city_pricing (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    home_service_id UUID NOT NULL REFERENCES home_services(id) ON DELETE CASCADE,
    processing_center_id UUID NOT NULL REFERENCES processing_centers(id) ON DELETE CASCADE,
    price      NUMERIC(10,2) NOT NULL,
    is_active  BOOLEAN DEFAULT true,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (home_service_id, processing_center_id)
);

-- ESR and CRP are not yet in service_catalog; add them so every home service
-- has a synonym entry to search against.
INSERT INTO service_catalog (name, slug, category, synonyms, home_collection_possible, typical_turnaround_hours) VALUES
 ('ESR', 'esr', 'lab_test', ARRAY['Erythrocyte Sedimentation Rate','Sed Rate'], true, 6),
 ('CRP', 'crp', 'lab_test', ARRAY['C-Reactive Protein','C Reactive Protein'],   true, 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO home_services
    (catalog_id, code, service_kind, name, category, base_price,
     fasting_required, fasting_hours, preparation_instructions, estimated_report_hours)
SELECT sc.id, v.code, 'blood_test', v.name, 'blood_test', v.price,
       v.fasting, v.fasting_hours, v.prep, v.tat
  FROM (VALUES
    ('CBC',     'cbc',             'Complete Blood Count', 350.00, false,  0, '', 6),
    ('LFT',     'lft',             'Liver Function Test',  650.00, true,   8, 'Fast for 8 hours. Water is allowed.', 8),
    ('KFT',     'kft',             'Kidney Function Test', 650.00, true,   8, 'Fast for 8 hours. Water is allowed.', 8),
    ('LIPID',   'lipid-profile',   'Lipid Profile',        600.00, true,  12, 'Fast for 12 hours. Water is allowed.', 8),
    ('HBA1C',   'hba1c',           'HbA1c',                500.00, false,  0, '', 6),
    ('THYROID', 'thyroid-profile', 'Thyroid Profile',      550.00, false,  0, 'Take the sample before any thyroid medication.', 12),
    ('VITD',    'vitamin-d',       'Vitamin D',            1200.00, false, 0, '', 24),
    ('VITB12',  'vitamin-b12',     'Vitamin B12',          1100.00, false, 0, '', 24),
    ('ESR',     'esr',             'ESR',                  200.00, false,  0, '', 6),
    ('CRP',     'crp',             'CRP',                  450.00, false,  0, '', 6)
  ) AS v(code, slug, name, price, fasting, fasting_hours, prep, tat)
  LEFT JOIN service_catalog sc ON sc.slug = v.slug
 WHERE NOT EXISTS (SELECT 1 FROM home_services hs WHERE hs.code = v.code);

INSERT INTO home_service_tubes (home_service_id, tube_type_code, volume_ml)
SELECT hs.id, v.tube, v.vol
  FROM (VALUES
    ('CBC',     'edta_lavender', 3.0),
    ('ESR',     'citrate_blue',  2.7),
    ('HBA1C',   'edta_lavender', 3.0),
    ('LFT',     'sst_gold',      5.0),
    ('KFT',     'sst_gold',      5.0),
    ('LIPID',   'sst_gold',      5.0),
    ('THYROID', 'sst_gold',      5.0),
    ('VITD',    'sst_gold',      5.0),
    ('VITB12',  'sst_gold',      5.0),
    ('CRP',     'sst_gold',      5.0)
  ) AS v(code, tube, vol)
  JOIN home_services hs ON hs.code = v.code
 WHERE NOT EXISTS (
    SELECT 1 FROM home_service_tubes t
     WHERE t.home_service_id = hs.id AND t.tube_type_code = v.tube
 );
```

Then extend the `new_tables` array in the section 99 RLS block to include `'tube_types'`, `'home_services'`, `'home_service_tubes'`, `'home_service_city_pricing'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_home_services_catalog.py tests/test_processing_center.py -v`
Expected: 14 passed.

- [ ] **Step 5: Commit**

```bash
git add database/task1_processing_center_foundation.sql backend/tests/test_home_services_catalog.py
git commit -m "feat(catalog): CallMedex-owned home-service catalog with tube requirements"
```

---

## Task 4: Tube derivation

**Files:**
- Create: `backend/app/services/tube_derivation.py`
- Test: `backend/tests/test_tube_derivation.py`

**Interfaces:**
- Consumes: nothing — a pure function over plain dicts, no database.
- Produces: `def derive_tubes(subject_tests: list[dict]) -> list[dict]`, where each input is `{"booking_test_id": str, "home_service_id": str, "tube_type_codes": list[str]}` and each output is `{"tube_type_code": str, "booking_test_ids": list[str]}`, sorted by `tube_type_code`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_tube_derivation.py`:

```python
"""
Tube derivation.

The barcode goes on a tube, so a sample row IS a tube. Getting this grain wrong
makes "tube type correct?" unanswerable and a partial rejection unrepresentable.
"""
import pytest

from app.services.tube_derivation import derive_tubes


def _t(bt_id, svc_id, tubes):
    return {"booking_test_id": bt_id, "home_service_id": svc_id, "tube_type_codes": tubes}


def test_the_worked_example_from_the_spec():
    """CBC + LFT + KFT for one person => 2 tubes, not 3."""
    tubes = derive_tubes([
        _t("bt1", "cbc", ["edta_lavender"]),
        _t("bt2", "lft", ["sst_gold"]),
        _t("bt3", "kft", ["sst_gold"]),
    ])
    assert len(tubes) == 2
    by_code = {t["tube_type_code"]: t for t in tubes}
    assert by_code["edta_lavender"]["booking_test_ids"] == ["bt1"]
    assert sorted(by_code["sst_gold"]["booking_test_ids"]) == ["bt2", "bt3"]


def test_one_test_needing_two_tubes_contributes_to_both():
    tubes = derive_tubes([_t("bt1", "panel", ["edta_lavender", "sst_gold"])])
    assert len(tubes) == 2
    for t in tubes:
        assert t["booking_test_ids"] == ["bt1"]


def test_no_tests_yields_no_tubes():
    assert derive_tubes([]) == []


def test_a_service_with_no_tube_requirement_is_skipped():
    """An ECG is a home service but draws no blood, so it produces no tube."""
    assert derive_tubes([_t("bt1", "ecg", [])]) == []


def test_output_is_deterministically_ordered():
    """Barcode label print order must not vary run to run."""
    a = derive_tubes([_t("bt1", "x", ["sst_gold"]), _t("bt2", "y", ["citrate_blue"])])
    b = derive_tubes([_t("bt2", "y", ["citrate_blue"]), _t("bt1", "x", ["sst_gold"])])
    assert [t["tube_type_code"] for t in a] == [t["tube_type_code"] for t in b]
    assert [t["tube_type_code"] for t in a] == ["citrate_blue", "sst_gold"]


def test_duplicate_test_lines_do_not_duplicate_a_booking_test_id():
    tubes = derive_tubes([
        _t("bt1", "cbc", ["edta_lavender"]),
        _t("bt1", "cbc", ["edta_lavender"]),
    ])
    assert len(tubes) == 1
    assert tubes[0]["booking_test_ids"] == ["bt1"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_tube_derivation.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.tube_derivation'`.

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/tube_derivation.py`:

```python
"""
Tube derivation — pure, no database.

One sample row per (booking subject x tube type). A patient booking
CBC + LFT + KFT gives two tubes: one lavender EDTA carrying the CBC, one SST
carrying both the LFT and the KFT. That is what actually leaves the house, so
that is what gets a barcode.
"""
from typing import Dict, List


def derive_tubes(subject_tests: List[dict]) -> List[dict]:
    """Group one subject's ordered tests into the physical tubes they require.

    Each entry of `subject_tests` is:
        {"booking_test_id": str, "home_service_id": str, "tube_type_codes": [str]}

    Returns, sorted by tube_type_code so label print order is stable:
        [{"tube_type_code": str, "booking_test_ids": [str]}]
    """
    grouped: Dict[str, List[str]] = {}

    for line in subject_tests:
        booking_test_id = line.get("booking_test_id")
        if not booking_test_id:
            continue
        # A service with no tube requirement (an ECG) draws no blood.
        for code in line.get("tube_type_codes") or []:
            ids = grouped.setdefault(code, [])
            if booking_test_id not in ids:
                ids.append(booking_test_id)

    return [
        {"tube_type_code": code, "booking_test_ids": grouped[code]}
        for code in sorted(grouped)
    ]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_tube_derivation.py -v`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/tube_derivation.py backend/tests/test_tube_derivation.py
git commit -m "feat(samples): pure tube derivation, one sample per subject x tube type"
```

---

## Task 5: Family members, booking subjects and test lines

**Files:**
- Modify: `database/task1_processing_center_foundation.sql` (append section 4)
- Test: `backend/tests/test_home_services_catalog.py` (append)

**Interfaces:**
- Consumes: `home_services` (Task 3), existing `bookings`.
- Produces: tables `family_members`, `booking_subjects`, `booking_tests`; columns `bookings.processing_center_id`, `bookings.booking_kind`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_home_services_catalog.py`:

```python
def test_family_and_booking_tables_are_created():
    sql = _sql()
    for table in ("family_members", "booking_subjects", "booking_tests"):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql, table


def test_bookings_gains_an_explicit_centre_reference():
    sql = _sql()
    assert "ADD COLUMN IF NOT EXISTS processing_center_id" in sql
    assert "booking_kind" in sql


def test_doorstep_addons_are_representable():
    """Spec 3 adds tests at the doorstep; the incentive rules already expect it."""
    sql = _sql()
    assert "'doorstep_addon'" in sql
    assert "added_by" in sql
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_home_services_catalog.py -v`
Expected: 3 failed.

- [ ] **Step 3: Append section 4 to the migration**

Insert before the `-- 99. RLS` block:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 4. FAMILY MEMBERS, BOOKING SUBJECTS AND TEST LINES
--    "Separate barcode, separate sample, separate report" per person falls out
--    of the schema once every subject — including the account holder — is a
--    family_members row.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    relationship    TEXT DEFAULT '',
    gender          TEXT DEFAULT '',
    date_of_birth   DATE,
    mobile          TEXT DEFAULT '',
    abha_number     TEXT DEFAULT '',        -- future per-member ABHA linkage
    is_self         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_members_account ON family_members(account_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_members_self
    ON family_members(account_user_id) WHERE is_self;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS processing_center_id UUID
    REFERENCES processing_centers(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_kind TEXT DEFAULT 'legacy';
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_kind_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_kind_check
    CHECK (booking_kind IN ('legacy', 'home_collection', 'walk_in'));

CREATE INDEX IF NOT EXISTS idx_bookings_pc ON bookings(processing_center_id, status);

CREATE TABLE IF NOT EXISTS booking_subjects (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    UNIQUE (booking_id, family_member_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_subjects_booking ON booking_subjects(booking_id);

CREATE TABLE IF NOT EXISTS booking_tests (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id         UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    booking_subject_id UUID NOT NULL REFERENCES booking_subjects(id) ON DELETE CASCADE,
    home_service_id    UUID NOT NULL REFERENCES home_services(id),
    price_charged      NUMERIC(10,2) NOT NULL,
    urgent_surcharge   NUMERIC(10,2) DEFAULT 0.00,
    source TEXT NOT NULL DEFAULT 'booking'
        CHECK (source IN ('booking', 'doorstep_addon')),
    added_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    added_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (booking_subject_id, home_service_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_tests_subject ON booking_tests(booking_subject_id);
```

Extend the section 99 `new_tables` array with `'family_members'`, `'booking_subjects'`, `'booking_tests'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_home_services_catalog.py -v`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add database/task1_processing_center_foundation.sql backend/tests/test_home_services_catalog.py
git commit -m "feat(bookings): family members, booking subjects and per-subject test lines"
```

---

## Task 6: Sample lifecycle extension, batches and custody

**Files:**
- Modify: `database/task1_processing_center_foundation.sql` (append section 5), `backend/tests/test_sample_lifecycle.py:110-113`
- Test: `backend/tests/test_sample_verification.py`

**Interfaces:**
- Consumes: `processing_centers` (1), `booking_subjects` (5), `tube_types` (3).
- Produces: table `sample_batches`, table `sample_tests`, and the new `samples` columns `processing_center_id`, `booking_subject_id`, `tube_type_code`, `expected_tube_type_code`, `tube_mismatch_ack`, `batch_id`, `verified_at`, `verified_by`, `verification`, `rejection_code`, `sent_to_lab_at`, `lab_reference`, `report_status`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_sample_verification.py`:

```python
"""
Sample lifecycle, batching and chain of custody.

The task ends when a verified sample is handed to the laboratory. Nothing here
knows anything about reports.
"""
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "database" / "task1_processing_center_foundation.sql"


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_samples_gains_every_new_column():
    sql = _sql()
    for col in ("processing_center_id", "booking_subject_id", "tube_type_code",
                "expected_tube_type_code", "tube_mismatch_ack", "batch_id",
                "verified_at", "verified_by", "verification", "rejection_code",
                "sent_to_lab_at", "lab_reference", "report_status"):
        assert col in sql, col


def test_barcode_becomes_nullable_with_a_partial_unique_index():
    """A sample exists from booking time; the barcode is bound at scan."""
    sql = _sql()
    assert "ALTER COLUMN barcode DROP NOT NULL" in sql
    assert "WHERE barcode IS NOT NULL" in sql


def test_the_full_status_chain_is_allowed():
    sql = _sql()
    for status in ("'pending_collection'", "'collected'", "'in_transit'",
                   "'received'", "'verified'", "'rejected'",
                   "'batched'", "'sent_to_lab'"):
        assert status in sql, status


def test_every_rejection_reason_from_the_brief_is_representable():
    sql = _sql()
    for code in ("wrong_tube", "barcode_missing", "label_missing", "broken_tube",
                 "leaking_tube", "hemolyzed", "insufficient_sample", "other"):
        assert f"'{code}'" in sql, code


def test_the_custody_chain_covers_every_event():
    sql = _sql()
    for event in ("'registered'", "'barcode_bound'", "'verified'",
                  "'batched'", "'sent_to_lab'"):
        assert event in sql, event


def test_batches_are_created_and_sealable():
    sql = _sql()
    assert "CREATE TABLE IF NOT EXISTS sample_batches" in sql
    assert "CREATE TABLE IF NOT EXISTS sample_tests" in sql
    for status in ("'open'", "'sealed'", "'sent_to_lab'", "'acknowledged'"):
        assert status in sql, status
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_sample_verification.py -v`
Expected: 6 failed.

- [ ] **Step 3: Append section 5 to the migration**

Insert before the `-- 99. RLS` block. Note the ordering constraint: `sample_batches` must exist before the `ALTER TABLE samples` that references it.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SAMPLE LIFECYCLE — extended in place so the existing phlebo wallet payout
--    (uq_wallet_tx_sample_reason) and tracking endpoints keep working.
-- ═══════════════════════════════════════════════════════════════════════════

-- The centre -> laboratory leg. Created before the samples ALTER that
-- references it.
CREATE TABLE IF NOT EXISTS sample_batches (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_code TEXT NOT NULL UNIQUE,           -- 'HYD-01/2026-07-28/001'
    processing_center_id UUID NOT NULL REFERENCES processing_centers(id) ON DELETE CASCADE,
    laboratory_name   TEXT DEFAULT '',         -- internal only
    laboratory_org_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'sealed', 'sent_to_lab', 'acknowledged', 'cancelled')),
    sample_count INT DEFAULT 0,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    sealed_at    TIMESTAMPTZ,
    sent_at      TIMESTAMPTZ,
    sent_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    courier_reference TEXT DEFAULT '',
    notes        TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_batches_centre ON sample_batches(processing_center_id, status);

ALTER TABLE samples ADD COLUMN IF NOT EXISTS processing_center_id UUID
    REFERENCES processing_centers(id) ON DELETE SET NULL;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS booking_subject_id UUID
    REFERENCES booking_subjects(id) ON DELETE CASCADE;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS tube_type_code TEXT
    REFERENCES tube_types(code);
ALTER TABLE samples ADD COLUMN IF NOT EXISTS expected_tube_type_code TEXT
    REFERENCES tube_types(code);
ALTER TABLE samples ADD COLUMN IF NOT EXISTS tube_mismatch_ack BOOLEAN DEFAULT false;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS batch_id UUID
    REFERENCES sample_batches(id) ON DELETE SET NULL;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS verified_by UUID
    REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS verification JSONB DEFAULT '{}';
ALTER TABLE samples ADD COLUMN IF NOT EXISTS rejection_code TEXT;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS sent_to_lab_at TIMESTAMPTZ;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS lab_reference TEXT DEFAULT '';
ALTER TABLE samples ADD COLUMN IF NOT EXISTS report_status TEXT DEFAULT 'pending';

-- A sample row is created at BOOKING time with its expected tube type, so the
-- centre knows tomorrow's tube count before anything is collected. The barcode
-- is bound when the phlebo scans a physical pre-printed sticker.
ALTER TABLE samples ALTER COLUMN barcode DROP NOT NULL;
ALTER TABLE samples DROP CONSTRAINT IF EXISTS samples_barcode_key;
DROP INDEX IF EXISTS uq_samples_barcode;
CREATE UNIQUE INDEX IF NOT EXISTS uq_samples_barcode
    ON samples(barcode) WHERE barcode IS NOT NULL;

ALTER TABLE samples DROP CONSTRAINT IF EXISTS samples_status_check;
ALTER TABLE samples ADD CONSTRAINT samples_status_check CHECK (status IN (
    'pending_collection', 'collected', 'in_transit', 'received',
    'verified', 'rejected', 'batched', 'sent_to_lab',
    -- reserved for the future report-automation task
    'report_pending', 'report_ready',
    -- retained so pre-existing rows stay valid
    'handover_requested', 'processing'
));

ALTER TABLE samples DROP CONSTRAINT IF EXISTS samples_rejection_code_check;
ALTER TABLE samples ADD CONSTRAINT samples_rejection_code_check CHECK (
    rejection_code IS NULL OR rejection_code IN (
        'wrong_tube', 'barcode_missing', 'label_missing', 'broken_tube',
        'leaking_tube', 'hemolyzed', 'insufficient_sample', 'other'
    )
);

ALTER TABLE samples DROP CONSTRAINT IF EXISTS samples_report_status_check;
ALTER TABLE samples ADD CONSTRAINT samples_report_status_check
    CHECK (report_status IN ('pending', 'fetching', 'ready', 'failed', 'manual'));

CREATE INDEX IF NOT EXISTS idx_samples_centre_status ON samples(processing_center_id, status);
CREATE INDEX IF NOT EXISTS idx_samples_batch         ON samples(batch_id);

-- Which ordered tests ride on which physical tube.
CREATE TABLE IF NOT EXISTS sample_tests (
    sample_id       UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    booking_test_id UUID NOT NULL REFERENCES booking_tests(id) ON DELETE CASCADE,
    PRIMARY KEY (sample_id, booking_test_id)
);

-- ─── Chain of custody ────────────────────────────────────────────────────
-- Append-only. No endpoint updates or deletes a row here.
ALTER TABLE sample_events DROP CONSTRAINT IF EXISTS sample_events_event_check;
ALTER TABLE sample_events ADD CONSTRAINT sample_events_event_check CHECK (event IN (
    'registered', 'assigned', 'collected', 'barcode_bound', 'scanned_transit',
    'in_transit', 'handover_requested', 'received', 'verified', 'rejected',
    'batched', 'sent_to_lab',
    -- retained for pre-existing rows
    'processing_started', 'report_uploaded'
));

ALTER TABLE sample_events ADD COLUMN IF NOT EXISTS location_label TEXT DEFAULT '';
ALTER TABLE sample_events ADD COLUMN IF NOT EXISTS processing_center_id UUID
    REFERENCES processing_centers(id) ON DELETE SET NULL;

-- The inbound phlebo -> centre manifest. Kept separate from sample_batches
-- because the two legs carry different fields: GPS and OTP inbound, courier
-- reference outbound.
ALTER TABLE sample_handovers ADD COLUMN IF NOT EXISTS destination_processing_center_id UUID
    REFERENCES processing_centers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_handovers_pc
    ON sample_handovers(destination_processing_center_id, status);
```

Extend the section 99 `new_tables` array with `'sample_batches'` and `'sample_tests'`.

- [ ] **Step 4: Fix `FakeSupabase` for nullable barcodes**

`backend/tests/test_sample_lifecycle.py:110-113` currently does `r["barcode"] == rec["barcode"]`, which raises `KeyError` as soon as a sample is inserted without a barcode. Replace that block with:

```python
                if self.table_name == "samples":
                    # Barcode is nullable now — bound at scan, not at booking.
                    bc = rec.get("barcode")
                    if bc is not None and any(r.get("barcode") == bc for r in rows):
                        raise Exception('duplicate key value violates unique constraint (23505)')
```

- [ ] **Step 5: Run the full suite to verify nothing regressed**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all pass, including the pre-existing `test_sample_lifecycle.py` and `test_urgent_dispatch.py`.

- [ ] **Step 6: Commit**

```bash
git add database/task1_processing_center_foundation.sql backend/tests/test_sample_verification.py backend/tests/test_sample_lifecycle.py
git commit -m "feat(samples): PC routing, tube typing, verification, batches and full custody chain"
```

---

## Task 7: Centre resolution and coverage

**Files:**
- Create: `backend/app/services/processing_center.py`
- Modify: `database/task1_processing_center_foundation.sql` (append `service_area_requests`)
- Test: `backend/tests/test_processing_center.py` (append)

**Interfaces:**
- Consumes: `processing_centers`, `processing_center_areas`, `city_aliases` (Task 1).
- Produces:
  - `def normalise_city(raw: str) -> str`
  - `def resolve_center(city=None, pincode=None, lat=None, lng=None) -> dict | None` — full centre row
  - `def check_coverage(city=None, pincode=None, lat=None, lng=None) -> dict` — `{"serviceable": bool}` and nothing else
  - `EARTH_KM`, `haversine_km(lat1, lng1, lat2, lng2) -> float`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_processing_center.py`:

```python
import app.services.processing_center as pc_mod
from app.services.processing_center import check_coverage, normalise_city, resolve_center


@pytest.fixture
def pc_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(pc_mod, "supabase", fake)
    return fake


def _seed_centre(fake, code, city, lat=None, lng=None, status="active"):
    cid = str(uuid.uuid4())
    fake.db.setdefault("processing_centers", []).append({
        "id": cid, "code": code, "name": code, "city": city,
        "lat": lat, "lng": lng, "status": status,
        "partner_lab_name": "", "daily_capacity": 0,
    })
    return cid


def _seed_area(fake, cid, city=None, pincode=None, radius_km=None, priority=100, active=True):
    fake.db.setdefault("processing_center_areas", []).append({
        "id": str(uuid.uuid4()), "processing_center_id": cid,
        "city": city, "pincode": pincode, "radius_km": radius_km,
        "priority": priority, "is_active": active,
    })


def _seed_aliases(fake):
    for alias, canon in (("vizag", "visakhapatnam"),
                         ("visakhapatnam", "visakhapatnam"),
                         ("hyderabad", "hyderabad")):
        fake.db.setdefault("city_aliases", []).append(
            {"alias": alias, "canonical_city": canon})


def test_city_normalisation_handles_the_vizag_problem(pc_db):
    _seed_aliases(pc_db)
    for raw in ("Vizag", "VIZAG", "  vizag  ", "Visakhapatnam"):
        assert normalise_city(raw) == "visakhapatnam"


def test_an_unknown_city_normalises_to_itself_lowercased(pc_db):
    _seed_aliases(pc_db)
    assert normalise_city("Rajahmundry") == "rajahmundry"


def test_pincode_beats_city(pc_db):
    _seed_aliases(pc_db)
    a = _seed_centre(pc_db, "HYD-01", "hyderabad")
    b = _seed_centre(pc_db, "HYD-02", "hyderabad")
    _seed_area(pc_db, a, city="hyderabad")
    _seed_area(pc_db, b, pincode="500081")
    assert resolve_center(city="Hyderabad", pincode="500081")["code"] == "HYD-02"


def test_city_beats_geo(pc_db):
    _seed_aliases(pc_db)
    near = _seed_centre(pc_db, "HYD-01", "hyderabad", lat=17.4, lng=78.5)
    far = _seed_centre(pc_db, "VSP-01", "visakhapatnam", lat=17.7, lng=83.2)
    _seed_area(pc_db, far, city="visakhapatnam")
    _seed_area(pc_db, near, radius_km=500)
    got = resolve_center(city="Vizag", lat=17.4, lng=78.5)
    assert got["code"] == "VSP-01"


def test_geo_is_the_last_resort(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad", lat=17.385, lng=78.487)
    _seed_area(pc_db, cid, radius_km=25)
    got = resolve_center(city="Unknownpur", lat=17.40, lng=78.50)
    assert got["code"] == "HYD-01"


def test_a_point_outside_every_radius_resolves_to_nothing(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad", lat=17.385, lng=78.487)
    _seed_area(pc_db, cid, radius_km=25)
    assert resolve_center(city="Unknownpur", lat=19.0, lng=72.8) is None


def test_a_paused_centre_is_never_selected(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad", status="paused")
    _seed_area(pc_db, cid, city="hyderabad")
    assert resolve_center(city="Hyderabad") is None


def test_an_inactive_area_row_is_never_selected(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad", active=False)
    assert resolve_center(city="Hyderabad") is None


def test_two_centres_in_one_city_resolve_deterministically(pc_db):
    """Proves HYD-02 needs no code change — only a row."""
    _seed_aliases(pc_db)
    a = _seed_centre(pc_db, "HYD-01", "hyderabad")
    b = _seed_centre(pc_db, "HYD-02", "hyderabad")
    _seed_area(pc_db, a, city="hyderabad", priority=200)
    _seed_area(pc_db, b, city="hyderabad", priority=50)
    assert resolve_center(city="Hyderabad")["code"] == "HYD-02"
    assert resolve_center(city="Hyderabad")["code"] == "HYD-02"


def test_coverage_leaks_nothing_but_a_boolean(pc_db):
    """This is the seam where a leak would be easiest, so it is a separate
    function from resolve_center on purpose."""
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad")
    assert check_coverage(city="Hyderabad") == {"serviceable": True}
    assert check_coverage(city="Rajahmundry") == {"serviceable": False}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_processing_center.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.processing_center'`.

- [ ] **Step 3: Append `service_area_requests` to the migration**

Insert before the `-- 99. RLS` block:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 6. COVERAGE DEMAND CAPTURE
--    A patient in an unserviced city is refused BEFORE payment. Capturing the
--    ask turns a refusal into the demand list that decides the next city — and
--    the second centre in an existing one.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS service_area_requests (
    id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,   -- guests may ask
    mobile  TEXT NOT NULL,
    city    TEXT DEFAULT '',
    pincode TEXT DEFAULT '',
    lat     DOUBLE PRECISION,
    lng     DOUBLE PRECISION,
    requested_service_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_area_requests_city
    ON service_area_requests(city, created_at DESC);
```

Extend the section 99 `new_tables` array with `'service_area_requests'`.

- [ ] **Step 4: Write the implementation**

Create `backend/app/services/processing_center.py`:

```python
"""
Processing Center resolution and assignment.

The patient books from CallMedex. Which centre fulfils the order is decided
here, in the backend, and never surfaces to them.

Resolution order, first match wins:
    1. an active area row with an exact pincode match
    2. an active area row whose city matches the normalised input
    3. the nearest active centre whose radius_km covers the point

Ties break on priority ascending, then distance ascending, so two centres in
one city resolve deterministically — which is what lets HYD-02 be added as a
row rather than a code change.
"""
import logging
import math
from typing import List, Optional

from app.database import supabase

logger = logging.getLogger(__name__)

EARTH_KM = 6371.0


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_KM * math.asin(math.sqrt(a))


def normalise_city(raw: Optional[str]) -> str:
    """'Vizag', 'VIZAG', ' Visakhapatnam ' -> 'visakhapatnam'.

    Without this, a patient in Vizag is told their city is unserviced.
    """
    if not raw:
        return ""
    key = raw.strip().lower()
    if not key:
        return ""
    result = (
        supabase.table("city_aliases")
        .select("canonical_city")
        .eq("alias", key)
        .limit(1)
        .execute()
    )
    rows = _rows(result)
    return rows[0]["canonical_city"] if rows else key


def _active_centres() -> dict:
    rows = _rows(
        supabase.table("processing_centers").select("*").eq("status", "active").execute()
    )
    return {r["id"]: r for r in rows}


def _active_areas() -> List[dict]:
    return _rows(
        supabase.table("processing_center_areas")
        .select("*")
        .eq("is_active", True)
        .execute()
    )


def _priority(area: dict) -> int:
    try:
        return int(area.get("priority") or 100)
    except (TypeError, ValueError):
        return 100


def resolve_center(city=None, pincode=None, lat=None, lng=None) -> Optional[dict]:
    """Return the full centre row that should fulfil this location, or None."""
    centres = _active_centres()
    if not centres:
        return None
    areas = [a for a in _active_areas() if a.get("processing_center_id") in centres]

    # 1. Exact pincode.
    if pincode:
        key = str(pincode).strip()
        matches = [a for a in areas if (a.get("pincode") or "") == key]
        if matches:
            matches.sort(key=_priority)
            return centres[matches[0]["processing_center_id"]]

    # 2. City, through the alias table.
    canonical = normalise_city(city)
    if canonical:
        matches = [a for a in areas if (a.get("city") or "") == canonical]
        if matches:
            matches.sort(key=_priority)
            return centres[matches[0]["processing_center_id"]]

    # 3. Nearest covering centre.
    if lat is not None and lng is not None:
        candidates = []
        for area in areas:
            radius = area.get("radius_km")
            if radius is None:
                continue
            centre = centres[area["processing_center_id"]]
            if centre.get("lat") is None or centre.get("lng") is None:
                continue
            dist = haversine_km(float(lat), float(lng),
                                float(centre["lat"]), float(centre["lng"]))
            if dist <= float(radius):
                candidates.append((_priority(area), dist, centre))
        if candidates:
            candidates.sort(key=lambda c: (c[0], c[1]))
            return candidates[0][2]

    return None


def check_coverage(city=None, pincode=None, lat=None, lng=None) -> dict:
    """Patient-facing. Returns a boolean and NOTHING else.

    Deliberately a separate function from resolve_center: the centre row it
    returns carries partner_lab_name, and this is the one call a patient makes.
    """
    return {"serviceable": resolve_center(city=city, pincode=pincode,
                                          lat=lat, lng=lng) is not None}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_processing_center.py -v`
Expected: 19 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/processing_center.py database/task1_processing_center_foundation.sql backend/tests/test_processing_center.py
git commit -m "feat(pc): centre resolution, coverage gate and demand capture"
```

---

## Task 8: Booking assignment

**Files:**
- Modify: `backend/app/services/processing_center.py`
- Test: `backend/tests/test_processing_center.py` (append)

**Interfaces:**
- Consumes: `resolve_center` (Task 7), `derive_tubes` (Task 4), `booking_subjects` / `booking_tests` (Task 5), `samples` / `sample_events` (Task 6).
- Produces: `def assign_booking(booking_id: str) -> str | None` returning the assigned `processing_center_id`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_processing_center.py`:

```python
from app.services.processing_center import assign_booking


def _seed_booking(fake, city="hyderabad", pincode="", lat=None, lng=None):
    bid = str(uuid.uuid4())
    fake.db.setdefault("bookings", []).append({
        "id": bid, "patient_id": str(uuid.uuid4()), "provider_id": None,
        "provider_type": "", "service_type": "lab_test", "status": "pending",
        "booking_kind": "home_collection", "processing_center_id": None,
        "collection_city": city, "collection_pincode": pincode,
        "collection_lat": lat, "collection_lng": lng,
    })
    return bid


def _seed_subject_with_tests(fake, booking_id, services):
    """services: [(home_service_id, [tube_code, ...])]"""
    sid = str(uuid.uuid4())
    fake.db.setdefault("booking_subjects", []).append({
        "id": sid, "booking_id": booking_id, "family_member_id": str(uuid.uuid4()),
    })
    for svc_id, tubes in services:
        bt_id = str(uuid.uuid4())
        fake.db.setdefault("booking_tests", []).append({
            "id": bt_id, "booking_id": booking_id, "booking_subject_id": sid,
            "home_service_id": svc_id, "price_charged": 100.0, "source": "booking",
        })
        for tube in tubes:
            fake.db.setdefault("home_service_tubes", []).append({
                "home_service_id": svc_id, "tube_type_code": tube, "volume_ml": 3.0,
            })
    return sid


def test_assignment_creates_one_sample_per_subject_and_tube(pc_db):
    """The spec's worked example: patient CBC+LFT+KFT, mother CBC => 3 tubes."""
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad")
    bid = _seed_booking(pc_db)
    _seed_subject_with_tests(pc_db, bid, [
        ("cbc", ["edta_lavender"]), ("lft", ["sst_gold"]), ("kft", ["sst_gold"])])
    _seed_subject_with_tests(pc_db, bid, [("cbc", ["edta_lavender"])])

    assert assign_booking(bid) == cid

    samples = pc_db.db["samples"]
    assert len(samples) == 3
    assert all(s["status"] == "pending_collection" for s in samples)
    assert all(s["barcode"] is None for s in samples)
    assert all(s["processing_center_id"] == cid for s in samples)
    assert sorted(s["expected_tube_type_code"] for s in samples) == [
        "edta_lavender", "edta_lavender", "sst_gold"]


def test_assignment_writes_a_registered_custody_event_per_sample(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad")
    bid = _seed_booking(pc_db)
    _seed_subject_with_tests(pc_db, bid, [("cbc", ["edta_lavender"])])

    assign_booking(bid)
    events = pc_db.db["sample_events"]
    assert len(events) == 1
    assert events[0]["event"] == "registered"
    assert events[0]["processing_center_id"] == cid


def test_assignment_sets_provider_id_without_loosening_the_not_null(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad")
    bid = _seed_booking(pc_db)
    _seed_subject_with_tests(pc_db, bid, [("cbc", ["edta_lavender"])])

    assign_booking(bid)
    booking = pc_db.db["bookings"][0]
    assert booking["processing_center_id"] == cid
    assert booking["provider_id"] == cid
    assert booking["provider_type"] == "processing_center"


def test_assignment_is_idempotent(pc_db):
    """A retried booking creation must not double the tubes."""
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad")
    bid = _seed_booking(pc_db)
    _seed_subject_with_tests(pc_db, bid, [("cbc", ["edta_lavender"])])

    assert assign_booking(bid) == cid
    assert assign_booking(bid) == cid
    assert len(pc_db.db["samples"]) == 1


def test_an_unserviced_booking_is_not_assigned_and_creates_no_samples(pc_db):
    _seed_aliases(pc_db)
    bid = _seed_booking(pc_db, city="rajahmundry")
    _seed_subject_with_tests(pc_db, bid, [("cbc", ["edta_lavender"])])
    assert assign_booking(bid) is None
    assert pc_db.db.get("samples", []) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_processing_center.py -v -k assign`
Expected: FAIL — `ImportError: cannot import name 'assign_booking'`.

- [ ] **Step 3: Write the implementation**

Append to `backend/app/services/processing_center.py`:

```python
from app.services.tube_derivation import derive_tubes


def _tube_map(service_ids: List[str]) -> dict:
    """home_service_id -> [tube_type_code]. A service with no row draws no blood."""
    if not service_ids:
        return {}
    rows = _rows(
        supabase.table("home_service_tubes")
        .select("home_service_id, tube_type_code")
        .in_("home_service_id", list(set(service_ids)))
        .execute()
    )
    out: dict = {}
    for r in rows:
        out.setdefault(r["home_service_id"], []).append(r["tube_type_code"])
    return out


def assign_booking(booking_id: str) -> Optional[str]:
    """Assign a home-collection booking to a centre and register its tubes.

    Idempotent: re-running on an already-assigned booking returns the same
    centre and creates nothing, so a retried booking cannot double the tubes a
    phlebotomist is told to draw.
    """
    booking_rows = _rows(
        supabase.table("bookings").select("*").eq("id", booking_id).limit(1).execute()
    )
    if not booking_rows:
        return None
    booking = booking_rows[0]

    if booking.get("processing_center_id"):
        return booking["processing_center_id"]

    centre = resolve_center(
        city=booking.get("collection_city"),
        pincode=booking.get("collection_pincode"),
        lat=booking.get("collection_lat"),
        lng=booking.get("collection_lng"),
    )
    if centre is None:
        # Coverage is checked at the location step, long before this. Reaching
        # here means the centre was paused between search and payment.
        logger.warning("No processing centre for booking %s", booking_id)
        return None

    centre_id = centre["id"]

    supabase.table("bookings").update({
        "processing_center_id": centre_id,
        "provider_id": centre_id,          # keeps the existing NOT NULL satisfied
        "provider_type": "processing_center",
    }).eq("id", booking_id).execute()

    subjects = _rows(
        supabase.table("booking_subjects").select("*").eq("booking_id", booking_id).execute()
    )
    tests = _rows(
        supabase.table("booking_tests").select("*").eq("booking_id", booking_id).execute()
    )
    tube_map = _tube_map([t["home_service_id"] for t in tests])

    for subject in subjects:
        lines = [
            {
                "booking_test_id": t["id"],
                "home_service_id": t["home_service_id"],
                "tube_type_codes": tube_map.get(t["home_service_id"], []),
            }
            for t in tests
            if t.get("booking_subject_id") == subject["id"]
        ]

        for tube in derive_tubes(lines):
            inserted = _rows(
                supabase.table("samples").insert({
                    "barcode": None,                    # bound when the phlebo scans
                    "booking_id": booking_id,
                    "patient_id": booking.get("patient_id"),
                    "booking_subject_id": subject["id"],
                    "processing_center_id": centre_id,
                    "expected_tube_type_code": tube["tube_type_code"],
                    "status": "pending_collection",
                }).execute()
            )
            if not inserted:
                continue
            sample_id = inserted[0].get("id")

            for booking_test_id in tube["booking_test_ids"]:
                supabase.table("sample_tests").insert({
                    "sample_id": sample_id,
                    "booking_test_id": booking_test_id,
                }).execute()

            supabase.table("sample_events").insert({
                "sample_id": sample_id,
                "event": "registered",
                "actor_role": "system",
                "processing_center_id": centre_id,
                "location_label": "booking",
            }).execute()

    return centre_id
```

- [ ] **Step 4: Make `FakeSupabase` return an id on insert**

`FakeSupabase` returns the payload as given. For `assign_booking` to read back `inserted[0]["id"]`, the samples insert must carry one. Add to the `insert` branch of `FakeQuery.execute()` in `backend/tests/test_sample_lifecycle.py`, immediately before `rows.append(dict(rec))`:

```python
                rec.setdefault("id", str(uuid.uuid4()))
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all pass, 24 in `test_processing_center.py`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/processing_center.py backend/tests/test_processing_center.py backend/tests/test_sample_lifecycle.py
git commit -m "feat(pc): idempotent booking assignment creating tubes at booking time"
```

---

## Task 9: Advance rostering schema and assignment pass

**Files:**
- Create: `backend/app/services/roster.py`
- Modify: `database/task1_processing_center_foundation.sql` (append section 7)
- Test: `backend/tests/test_roster.py`

**Interfaces:**
- Consumes: `processing_centers` (1), `bookings` (5).
- Produces:
  - table `phlebotomist_roster`; columns `phlebotomists.processing_center_id`, `base_lat`, `base_lng`, `base_pincode`; columns `dispatch_requests.assignment_mode`, `scheduled_for`, `declined_by`
  - `def run_roster_pass(processing_center_id: str, roster_date: str) -> list[dict]`
  - `def decline_job(dispatch_request_id: str, phlebotomist_user_id: str) -> dict | None`
  - `ADVANCE_RADIUS_KM = 10.0`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_roster.py`:

```python
"""
Advance rostering.

Tomorrow's slots are assigned this evening, so live GPS is useless — assignment
anchors on the phlebotomist's base location instead. A phlebo may decline; the
job goes to the next-nearest rather than to nobody.
"""
import uuid

import pytest

import app.services.roster as roster_mod
from app.services.roster import ADVANCE_RADIUS_KM, decline_job, run_roster_pass
from tests.test_sample_lifecycle import FakeSupabase

DATE = "2026-07-29"


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(roster_mod, "supabase", fake)
    return fake


def _phlebo(fake, centre_id, lat, lng, available=True, date=DATE):
    uid = str(uuid.uuid4())
    fake.db.setdefault("phlebotomists", []).append({
        "user_id": uid, "processing_center_id": centre_id,
        "base_lat": lat, "base_lng": lng, "base_pincode": "",
    })
    fake.db.setdefault("phlebotomist_roster", []).append({
        "id": str(uuid.uuid4()), "processing_center_id": centre_id,
        "phlebotomist_user_id": uid, "roster_date": date,
        "status": "available" if available else "leave", "max_jobs": 0,
    })
    return uid


def _booking(fake, centre_id, lat, lng, date=DATE):
    bid = str(uuid.uuid4())
    fake.db.setdefault("bookings", []).append({
        "id": bid, "processing_center_id": centre_id,
        "booking_kind": "home_collection", "status": "confirmed",
        "collection_lat": lat, "collection_lng": lng,
        "collection_date": date, "priority": "normal",
    })
    return bid


def test_assignment_anchors_on_base_location_not_live_gps(db):
    centre = str(uuid.uuid4())
    near = _phlebo(db, centre, 17.385, 78.487)
    _phlebo(db, centre, 17.60, 78.90)          # farther from base
    _booking(db, centre, 17.390, 78.490)

    assigned = run_roster_pass(centre, DATE)
    assert len(assigned) == 1
    assert assigned[0]["phlebotomist_user_id"] == near


def test_a_phlebo_of_another_centre_is_never_assigned(db):
    """Even when strictly nearer — they could not submit the tube afterwards."""
    mine, theirs = str(uuid.uuid4()), str(uuid.uuid4())
    _phlebo(db, theirs, 17.3850, 78.4870)      # right next door
    ours = _phlebo(db, mine, 17.4200, 78.5200)
    _booking(db, mine, 17.3851, 78.4871)

    assigned = run_roster_pass(mine, DATE)
    assert [a["phlebotomist_user_id"] for a in assigned] == [ours]


def test_a_booking_beyond_the_radius_is_left_for_manual_assignment(db):
    centre = str(uuid.uuid4())
    _phlebo(db, centre, 17.385, 78.487)
    _booking(db, centre, 19.076, 72.877)       # Mumbai
    assert run_roster_pass(centre, DATE) == []
    assert db.db.get("dispatch_requests", []) == []


def test_a_phlebo_on_leave_is_skipped(db):
    centre = str(uuid.uuid4())
    _phlebo(db, centre, 17.385, 78.487, available=False)
    _booking(db, centre, 17.386, 78.488)
    assert run_roster_pass(centre, DATE) == []


def test_load_is_balanced_rather_than_dumped_on_the_nearest(db):
    centre = str(uuid.uuid4())
    a = _phlebo(db, centre, 17.385, 78.487)
    b = _phlebo(db, centre, 17.386, 78.488)
    for _ in range(4):
        _booking(db, centre, 17.3855, 78.4875)

    assigned = run_roster_pass(centre, DATE)
    counts = {}
    for row in assigned:
        counts[row["phlebotomist_user_id"]] = counts.get(row["phlebotomist_user_id"], 0) + 1
    assert sorted(counts.values()) == [2, 2]
    assert set(counts) == {a, b}


def test_assignments_are_advance_mode_and_dated(db):
    centre = str(uuid.uuid4())
    _phlebo(db, centre, 17.385, 78.487)
    _booking(db, centre, 17.386, 78.488)

    run_roster_pass(centre, DATE)
    req = db.db["dispatch_requests"][0]
    assert req["assignment_mode"] == "advance"
    assert req["scheduled_for"] == DATE
    assert req["status"] == "provider_accepted"


def test_the_pass_is_idempotent(db):
    centre = str(uuid.uuid4())
    _phlebo(db, centre, 17.385, 78.487)
    _booking(db, centre, 17.386, 78.488)

    run_roster_pass(centre, DATE)
    run_roster_pass(centre, DATE)
    assert len(db.db["dispatch_requests"]) == 1


def test_declining_reassigns_to_the_next_nearest(db):
    centre = str(uuid.uuid4())
    first = _phlebo(db, centre, 17.3850, 78.4870)
    second = _phlebo(db, centre, 17.3900, 78.4900)
    _booking(db, centre, 17.3851, 78.4871)

    assigned = run_roster_pass(centre, DATE)
    req_id = assigned[0]["dispatch_request_id"]
    assert assigned[0]["phlebotomist_user_id"] == first

    result = decline_job(req_id, first)
    assert result["phlebotomist_user_id"] == second
    assert first in db.db["dispatch_requests"][0]["declined_by"]


def test_a_declined_job_is_never_re_offered_to_the_same_phlebo(db):
    centre = str(uuid.uuid4())
    only = _phlebo(db, centre, 17.385, 78.487)
    _booking(db, centre, 17.386, 78.488)

    req_id = run_roster_pass(centre, DATE)[0]["dispatch_request_id"]
    assert decline_job(req_id, only) is None          # nobody left
    req = db.db["dispatch_requests"][0]
    assert req["status"] == "needs_manual_assignment"
    assert req["declined_by"] == [only]


def test_the_advance_radius_is_ten_kilometres(db):
    assert ADVANCE_RADIUS_KM == 10.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_roster.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.roster'`.

- [ ] **Step 3: Append section 7 to the migration**

Insert before the `-- 99. RLS` block:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 7. PHLEBOTOMIST <-> CENTRE BINDING AND ADVANCE ROSTERING
--    Tomorrow's slots are assigned this evening, so live GPS is meaningless
--    and assignment anchors on the phlebo's base location.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE phlebotomists ADD COLUMN IF NOT EXISTS processing_center_id UUID
    REFERENCES processing_centers(id) ON DELETE SET NULL;
ALTER TABLE phlebotomists ADD COLUMN IF NOT EXISTS base_lat DOUBLE PRECISION;
ALTER TABLE phlebotomists ADD COLUMN IF NOT EXISTS base_lng DOUBLE PRECISION;
ALTER TABLE phlebotomists ADD COLUMN IF NOT EXISTS base_pincode TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_phlebotomists_pc ON phlebotomists(processing_center_id);

CREATE TABLE IF NOT EXISTS phlebotomist_roster (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processing_center_id UUID NOT NULL REFERENCES processing_centers(id) ON DELETE CASCADE,
    phlebotomist_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    roster_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'unavailable', 'leave')),
    max_jobs   INT DEFAULT 0,                 -- 0 = centre default
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (phlebotomist_user_id, roster_date)
);

CREATE INDEX IF NOT EXISTS idx_roster_centre_date
    ON phlebotomist_roster(processing_center_id, roster_date);

ALTER TABLE dispatch_requests ADD COLUMN IF NOT EXISTS assignment_mode TEXT DEFAULT 'realtime';
ALTER TABLE dispatch_requests DROP CONSTRAINT IF EXISTS dispatch_requests_assignment_mode_check;
ALTER TABLE dispatch_requests ADD CONSTRAINT dispatch_requests_assignment_mode_check
    CHECK (assignment_mode IN ('advance', 'realtime', 'urgent'));
ALTER TABLE dispatch_requests ADD COLUMN IF NOT EXISTS scheduled_for DATE;
ALTER TABLE dispatch_requests ADD COLUMN IF NOT EXISTS declined_by UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_dispatch_scheduled
    ON dispatch_requests(scheduled_for, assignment_mode);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS collection_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS collection_city TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS collection_pincode TEXT DEFAULT '';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS collection_lat DOUBLE PRECISION;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS collection_lng DOUBLE PRECISION;

INSERT INTO platform_settings (key, value, description) VALUES
 ('roster_cutoff',
  '{"time":"18:00","timezone":"Asia/Kolkata"}',
  'Evening cutoff at which the next day''s bookings are assigned to phlebotomists.')
ON CONFLICT (key) DO NOTHING;
```

Extend the section 99 `new_tables` array with `'phlebotomist_roster'`.

- [ ] **Step 4: Write the implementation**

Create `backend/app/services/roster.py`:

```python
"""
Advance rostering — tomorrow's slots assigned this evening.

Anchors on the phlebotomist's BASE location, because their live GPS says
nothing about where they will be at 07:00 tomorrow. Assignment is direct, not
an offer: the phlebo sees the list tonight and may decline, which hands the job
to the next-nearest rather than to nobody.

Same-day and urgent bookings keep using the existing live-GPS offer flow in
dispatch_engine.
"""
import logging
import uuid
from typing import List, Optional

from app.database import supabase
from app.services.processing_center import haversine_km

logger = logging.getLogger(__name__)

ADVANCE_RADIUS_KM = 10.0


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _available_phlebos(processing_center_id: str, roster_date: str) -> List[dict]:
    """Rostered-available phlebos of this centre, with a usable base location."""
    roster = _rows(
        supabase.table("phlebotomist_roster")
        .select("phlebotomist_user_id, status, max_jobs")
        .eq("processing_center_id", processing_center_id)
        .eq("roster_date", roster_date)
        .eq("status", "available")
        .execute()
    )
    if not roster:
        return []
    wanted = {r["phlebotomist_user_id"] for r in roster}

    people = _rows(
        supabase.table("phlebotomists")
        .select("user_id, processing_center_id, base_lat, base_lng")
        .eq("processing_center_id", processing_center_id)
        .execute()
    )
    return [
        p for p in people
        if p.get("user_id") in wanted
        and p.get("base_lat") is not None
        and p.get("base_lng") is not None
    ]


def _unassigned_bookings(processing_center_id: str, roster_date: str) -> List[dict]:
    bookings = _rows(
        supabase.table("bookings")
        .select("*")
        .eq("processing_center_id", processing_center_id)
        .eq("collection_date", roster_date)
        .eq("booking_kind", "home_collection")
        .execute()
    )
    existing = {
        r.get("booking_id")
        for r in _rows(
            supabase.table("dispatch_requests")
            .select("booking_id")
            .eq("scheduled_for", roster_date)
            .execute()
        )
    }
    return [
        b for b in bookings
        if b["id"] not in existing               # idempotent
        and b.get("collection_lat") is not None
        and b.get("collection_lng") is not None
    ]


def _pick(candidates: List[dict], booking: dict, load: dict,
          exclude: Optional[set] = None) -> Optional[dict]:
    """Nearest by base location within the radius, breaking ties on load.

    Sorting on load first is what stops one phlebo absorbing a whole locality
    while a colleague two streets away sits idle.
    """
    exclude = exclude or set()
    viable = []
    for person in candidates:
        uid = person["user_id"]
        if uid in exclude:
            continue
        dist = haversine_km(
            float(booking["collection_lat"]), float(booking["collection_lng"]),
            float(person["base_lat"]), float(person["base_lng"]),
        )
        if dist <= ADVANCE_RADIUS_KM:
            viable.append((load.get(uid, 0), dist, uid, person))
    if not viable:
        return None
    viable.sort(key=lambda v: (v[0], v[1], v[2]))
    return viable[0][3]


def run_roster_pass(processing_center_id: str, roster_date: str) -> List[dict]:
    """Assign every unassigned next-day booking of this centre.

    Idempotent — a booking that already has a dispatch request for that date is
    skipped, so running the pass twice does not double-assign.
    """
    candidates = _available_phlebos(processing_center_id, roster_date)
    bookings = _unassigned_bookings(processing_center_id, roster_date)
    if not candidates or not bookings:
        return []

    load: dict = {}
    assigned: List[dict] = []

    for booking in bookings:
        person = _pick(candidates, booking, load)
        if person is None:
            # Out of radius for everyone. Left unassigned on purpose: it falls
            # back to the realtime offer flow on the collection day.
            logger.info("No advance candidate for booking %s", booking["id"])
            continue

        uid = person["user_id"]
        request_id = str(uuid.uuid4())
        supabase.table("dispatch_requests").insert({
            "id": request_id,
            "booking_id": booking["id"],
            "provider_type": "phlebotomist",
            "assigned_provider_id": uid,
            "assignment_mode": "advance",
            "scheduled_for": roster_date,
            "status": "provider_accepted",
            "priority": booking.get("priority") or "normal",
            "declined_by": [],
        }).execute()

        load[uid] = load.get(uid, 0) + 1
        assigned.append({
            "dispatch_request_id": request_id,
            "booking_id": booking["id"],
            "phlebotomist_user_id": uid,
        })

    return assigned


def decline_job(dispatch_request_id: str, phlebotomist_user_id: str) -> Optional[dict]:
    """Return a declined advance job to the roster queue and reassign it.

    When nobody is left, the request is surfaced for manual assignment rather
    than silently going unassigned — Spec 2 renders that queue.
    """
    rows = _rows(
        supabase.table("dispatch_requests")
        .select("*").eq("id", dispatch_request_id).limit(1).execute()
    )
    if not rows:
        return None
    request = rows[0]

    declined = list(request.get("declined_by") or [])
    if phlebotomist_user_id not in declined:
        declined.append(phlebotomist_user_id)

    booking_rows = _rows(
        supabase.table("bookings").select("*")
        .eq("id", request["booking_id"]).limit(1).execute()
    )
    if not booking_rows:
        return None
    booking = booking_rows[0]

    candidates = _available_phlebos(
        booking["processing_center_id"], request.get("scheduled_for"))
    replacement = _pick(candidates, booking, {}, exclude=set(declined))

    if replacement is None:
        supabase.table("dispatch_requests").update({
            "declined_by": declined,
            "assigned_provider_id": None,
            "status": "needs_manual_assignment",
        }).eq("id", dispatch_request_id).execute()
        return None

    supabase.table("dispatch_requests").update({
        "declined_by": declined,
        "assigned_provider_id": replacement["user_id"],
        "status": "provider_accepted",
    }).eq("id", dispatch_request_id).execute()

    return {
        "dispatch_request_id": dispatch_request_id,
        "booking_id": booking["id"],
        "phlebotomist_user_id": replacement["user_id"],
    }
```

- [ ] **Step 5: Widen the dispatch_requests status constraint**

`needs_manual_assignment` is a new status. Append to section 7 of the migration:

```sql
ALTER TABLE dispatch_requests DROP CONSTRAINT IF EXISTS dispatch_requests_status_check;
ALTER TABLE dispatch_requests ADD CONSTRAINT dispatch_requests_status_check
    CHECK (status IN (
        'searching', 'provider_notified', 'provider_accepted', 'provider_declined',
        'en_route', 'arrived', 'in_progress', 'completed', 'cancelled', 'expired',
        'needs_manual_assignment'
    ));
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_roster.py -v`
Expected: 10 passed.

- [ ] **Step 7: Commit**

```bash
git add database/task1_processing_center_foundation.sql backend/app/services/roster.py backend/tests/test_roster.py
git commit -m "feat(roster): advance next-day assignment off base location with decline and reassign"
```

---

## Task 10: Dispatch centre filter and urgent centre-wide fan-out

**Files:**
- Modify: `backend/app/services/dispatch_engine.py:117-192`, `:243-275`
- Test: `backend/tests/test_urgent_dispatch.py` (append)

**Interfaces:**
- Consumes: `phlebotomists.processing_center_id` (Task 9).
- Produces: `async find_nearby_providers(..., processing_center_id: str | None = None, ignore_radius: bool = False)` and an urgent path that ignores the distance cap for home collection. `create_dispatch_request` gains `processing_center_id: str | None = None`.

**Note on the real signature.** The method is `UniversalDispatchEngine.find_nearby_providers` — an `async staticmethod` taking positional `patient_lat, patient_lng, provider_type` then keyword `radius_km=10.0, limit=5, exclude_ids=None`. There is no `find_candidates`. Both new arguments are keyword-only with defaults, so every existing caller is untouched.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_urgent_dispatch.py`:

```python
def _seed_phlebo_at_centre(fake, lat, lng, centre_id, name="Phlebo"):
    uid = _seed_provider(fake, lat, lng, ptype="phlebotomist", name=name)
    fake.db.setdefault("phlebotomists", []).append({
        "user_id": uid, "processing_center_id": centre_id,
        "base_lat": lat, "base_lng": lng,
    })
    return uid


@pytest.mark.asyncio
async def test_a_phlebo_of_another_centre_is_never_a_candidate(fake_db):
    """They could not submit the tube afterwards, however close they are."""
    mine, theirs = "centre-a", "centre-b"
    _seed_phlebo_at_centre(fake_db, 17.3850, 78.4870, theirs, "Wrong centre")
    ours = _seed_phlebo_at_centre(fake_db, 17.3900, 78.4900, mine, "Right centre")

    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist", processing_center_id=mine)
    assert [c["user_id"] for c in found] == [ours]


@pytest.mark.asyncio
async def test_urgent_ignores_the_distance_cap_within_the_centre(fake_db):
    centre = "centre-a"
    far = _seed_phlebo_at_centre(fake_db, 17.9000, 78.9000, centre, "Far but ours")

    normal = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist", processing_center_id=centre)
    urgent = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist",
        processing_center_id=centre, ignore_radius=True)

    assert [c["user_id"] for c in normal] == []
    assert [c["user_id"] for c in urgent] == [far]


@pytest.mark.asyncio
async def test_urgent_still_never_crosses_a_centre_boundary(fake_db):
    """'All of them' is centre-scoped: a Hyderabad phlebo cannot serve Vizag."""
    _seed_phlebo_at_centre(fake_db, 17.3850, 78.4870, "centre-b", "Other centre")
    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist",
        processing_center_id="centre-a", ignore_radius=True)
    assert found == []


@pytest.mark.asyncio
async def test_the_centre_filter_is_opt_in_so_other_provider_types_are_unaffected(fake_db):
    """Nurses, doctors and ambulances keep today's behaviour exactly."""
    uid = _seed_provider(fake_db, 17.3850, 78.4870, ptype="nurse", name="Nurse")
    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "nurse")
    assert [c["user_id"] for c in found] == [uid]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_urgent_dispatch.py -v -k "centre or radius"`
Expected: FAIL — `find_nearby_providers() got an unexpected keyword argument 'processing_center_id'`.

- [ ] **Step 3: Add the centre filter to `find_nearby_providers`**

In `backend/app/services/dispatch_engine.py`, extend the `find_nearby_providers` signature (line 117-124) with two keyword arguments, after `exclude_ids`:

```python
        processing_center_id: Optional[str] = None,
        ignore_radius: bool = False,
```

Immediately before the candidate loop, load the centre binding once:

```python
        # Home collection is centre-bound: a phlebo may only be offered work
        # they could actually submit afterwards. Other provider types are
        # unaffected — the filter only engages when a centre is supplied.
        centre_members = None
        if processing_center_id:
            binding = supabase.table("phlebotomists") \
                .select("user_id") \
                .eq("processing_center_id", processing_center_id) \
                .execute()
            centre_members = {
                r["user_id"] for r in (getattr(binding, "data", None) or [])
                if isinstance(r, dict) and r.get("user_id")
            }
```

Inside the loop, skip non-members before computing distance, and honour `ignore_radius` at the existing `if dist <= radius_km:` check (line 177):

```python
            if centre_members is not None and provider_user_id not in centre_members:
                continue
```
```python
            if ignore_radius or dist <= radius_km:
```

- [ ] **Step 4: Route urgent home collection through the centre-wide fan-out**

In `create_dispatch_request` (around line 264), replace the radius multiplier for the home-collection path while leaving it intact for every other provider type:

```python
        # Urgent home collection fans out to EVERY on-duty phlebo of the
        # booking's centre. Widening the radius is not enough when the
        # constraint is the centre, not the distance.
        home_collection = provider_type == "phlebotomist" and processing_center_id
        ignore_radius = bool(urgent and home_collection)
        effective_radius = (
            search_radius_km * URGENT_RADIUS_MULTIPLIER
            if urgent and not home_collection
            else search_radius_km
        )
```

Then add `processing_center_id: str = None` to the `create_dispatch_request` signature (after `search_radius_km`, before `priority`), and pass both new arguments through to the `find_nearby_providers` call at line 271:

```python
        candidates = await UniversalDispatchEngine.find_nearby_providers(
            patient_lat, patient_lng, provider_type,
            radius_km=effective_radius, limit=max_offers,
            processing_center_id=processing_center_id,
            ignore_radius=ignore_radius,
        )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_urgent_dispatch.py tests/test_roster.py -v`
Expected: all pass — the pre-existing urgent tests still hold, because the multiplier is untouched for non-home-collection dispatch.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/dispatch_engine.py backend/tests/test_urgent_dispatch.py
git commit -m "feat(dispatch): centre-bound phlebo candidates and centre-wide urgent fan-out"
```

---

## Task 11: Admin centre and catalog endpoints

**Files:**
- Create: `backend/app/routers/processing_center_admin.py`, `backend/app/routers/home_services.py`
- Modify: `backend/app/main.py:266`
- Test: `backend/tests/test_home_services_catalog.py` (append)

**Interfaces:**
- Consumes: `require_pc_admin` / `get_current_pc_staff` (Task 2), `check_coverage` / `resolve_center` (Task 7), `PricingService.urgent_surcharge_for` (existing, `app/services/marketplace.py:82`).
- Produces: the routes listed in spec §5, plus three helpers other modules import — `price_for_city(home_service_id, processing_center_id) -> float`, `urgent_surcharge_for_service(home_service_id, base_price) -> float`, `soft_delete_home_service(home_service_id) -> {"hard_deleted": bool, "id": str}`. Both routers expose `router` as their module-level `APIRouter`; `processing_center_admin` also exposes `me_router`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_home_services_catalog.py`:

```python
import uuid

import pytest

import app.routers.home_services as hs_mod
from app.routers.home_services import price_for_city, soft_delete_home_service
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(hs_mod, "supabase", fake)
    # urgent_surcharge_for_service delegates to PricingService, which holds its
    # own module-level client. Patch both or the surcharge tests silently read
    # the real database.
    import app.services.marketplace as marketplace_mod
    monkeypatch.setattr(marketplace_mod, "supabase", fake)
    return fake


def _service(fake, code="CBC", base=350.0, active=True):
    sid = str(uuid.uuid4())
    fake.db.setdefault("home_services", []).append({
        "id": sid, "code": code, "name": code, "service_kind": "blood_test",
        "base_price": base, "is_active": active, "category": "blood_test",
        "description": "", "fasting_required": False, "fasting_hours": 0,
        "preparation_instructions": "", "estimated_report_hours": 6,
        "home_collection_available": True,
    })
    return sid


def test_base_price_is_used_when_no_override_exists(db):
    sid = _service(db, base=350.0)
    assert price_for_city(sid, str(uuid.uuid4())) == 350.0


def test_a_city_override_wins_over_the_base_price(db):
    sid, centre = _service(db, base=350.0), str(uuid.uuid4())
    db.db.setdefault("home_service_city_pricing", []).append({
        "home_service_id": sid, "processing_center_id": centre,
        "price": 299.0, "is_active": True,
    })
    assert price_for_city(sid, centre) == 299.0


def test_an_inactive_override_falls_back_to_base(db):
    sid, centre = _service(db, base=350.0), str(uuid.uuid4())
    db.db.setdefault("home_service_city_pricing", []).append({
        "home_service_id": sid, "processing_center_id": centre,
        "price": 299.0, "is_active": False,
    })
    assert price_for_city(sid, centre) == 350.0


def test_another_citys_override_does_not_leak(db):
    sid = _service(db, base=350.0)
    db.db.setdefault("home_service_city_pricing", []).append({
        "home_service_id": sid, "processing_center_id": "hyderabad-centre",
        "price": 299.0, "is_active": True,
    })
    assert price_for_city(sid, "vizag-centre") == 350.0


def _seed_urgent_config(fake, confirmed, flat=200):
    fake.db.setdefault("platform_settings", []).append({
        "key": "urgent_surcharge",
        "value": {"mode": "flat", "flat_inr": flat, "percent": 0,
                  "min_inr": 0, "max_inr": 1000, "confirmed": confirmed},
    })


def test_an_unconfirmed_platform_rate_charges_nothing(db):
    """Commit 68ea5eb: never quote a surcharge nobody has agreed to."""
    from app.routers.home_services import urgent_surcharge_for_service
    sid = _service(db, base=350.0)
    _seed_urgent_config(db, confirmed=False)
    assert urgent_surcharge_for_service(sid, 350.0) == 0.0


def test_a_confirmed_platform_rate_is_used_when_there_is_no_override(db):
    from app.routers.home_services import urgent_surcharge_for_service
    sid = _service(db, base=350.0)
    _seed_urgent_config(db, confirmed=True, flat=200)
    assert urgent_surcharge_for_service(sid, 350.0) == 200.0


def test_a_per_service_override_beats_the_platform_rate(db):
    """An urgent CBC may be priced differently from an urgent Vitamin D."""
    from app.routers.home_services import urgent_surcharge_for_service
    sid = _service(db, base=350.0)
    db.db["home_services"][0]["urgent_surcharge_override"] = 120.0
    _seed_urgent_config(db, confirmed=True, flat=200)
    assert urgent_surcharge_for_service(sid, 350.0) == 120.0


def test_an_override_applies_even_when_the_platform_rate_is_unconfirmed(db):
    """The override IS the agreed rate for this test, so it stands alone."""
    from app.routers.home_services import urgent_surcharge_for_service
    sid = _service(db, base=350.0)
    db.db["home_services"][0]["urgent_surcharge_override"] = 120.0
    _seed_urgent_config(db, confirmed=False)
    assert urgent_surcharge_for_service(sid, 350.0) == 120.0


def test_a_zero_override_is_honoured_rather_than_treated_as_unset(db):
    """0 is a deliberate 'no surcharge on this test', not a missing value."""
    from app.routers.home_services import urgent_surcharge_for_service
    sid = _service(db, base=350.0)
    db.db["home_services"][0]["urgent_surcharge_override"] = 0.0
    _seed_urgent_config(db, confirmed=True, flat=200)
    assert urgent_surcharge_for_service(sid, 350.0) == 0.0


def test_delete_is_soft_when_the_service_has_been_booked(db):
    sid = _service(db)
    db.db.setdefault("booking_tests", []).append({
        "id": str(uuid.uuid4()), "home_service_id": sid,
        "booking_subject_id": str(uuid.uuid4()), "price_charged": 350.0,
    })
    assert soft_delete_home_service(sid)["hard_deleted"] is False
    assert db.db["home_services"][0]["is_active"] is False


def test_a_never_booked_service_can_be_hard_deleted(db):
    sid = _service(db)
    assert soft_delete_home_service(sid)["hard_deleted"] is True
    assert db.db["home_services"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_home_services_catalog.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.routers.home_services'`.

- [ ] **Step 3: Write the catalog router**

Create `backend/app/routers/home_services.py`:

```python
"""
Home-service catalog — CallMedex owned.

Admin holds full CRUD. A Processing Center reads the catalog (it needs to know
this booking should have produced a lavender EDTA tube) but cannot change a
clinical definition or a price.

Patient-facing responses here carry NO centre identity. The price is resolved
against the caller's city behind the scenes.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user
from app.middleware.pc_auth import get_current_pc_staff
from app.services.processing_center import check_coverage, resolve_center

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Home Services"])

# Never widen this. It is what keeps a laboratory out of a patient's browser.
PATIENT_FIELDS = (
    "id", "code", "name", "category", "service_kind", "description",
    "home_collection_available", "fasting_required", "fasting_hours",
    "preparation_instructions", "estimated_report_hours",
)


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _num(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


class HomeServiceIn(BaseModel):
    code: str
    name: str
    service_kind: str = "blood_test"
    category: str = "blood_test"
    description: str = ""
    base_price: float
    urgent_surcharge_override: Optional[float] = None
    home_collection_available: bool = True
    fasting_required: bool = False
    fasting_hours: int = 0
    preparation_instructions: str = ""
    estimated_report_hours: Optional[int] = None
    is_active: bool = True


class CityPriceIn(BaseModel):
    price: float
    is_active: bool = True


class AreaRequestIn(BaseModel):
    mobile: str
    city: str = ""
    pincode: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    requested_service_ids: List[str] = []


def price_for_city(home_service_id: str, processing_center_id: str) -> float:
    """The city override when one is active, otherwise the platform base price."""
    override = _rows(
        supabase.table("home_service_city_pricing")
        .select("price, is_active")
        .eq("home_service_id", home_service_id)
        .eq("processing_center_id", processing_center_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if override:
        return _num(override[0].get("price"))

    base = _rows(
        supabase.table("home_services")
        .select("base_price")
        .eq("id", home_service_id)
        .limit(1)
        .execute()
    )
    return _num(base[0].get("base_price")) if base else 0.0


def urgent_surcharge_for_service(home_service_id: str, base_price: float) -> float:
    """Per-service override when set, otherwise the platform-wide knob.

    Reuses PricingService.urgent_surcharge_for so operations keep tuning the
    default from platform_settings without a deploy. A 0.0 override means
    "no surcharge on this test", which is different from "not configured".
    """
    from app.services.marketplace import PricingService

    rows = _rows(
        supabase.table("home_services")
        .select("urgent_surcharge_override")
        .eq("id", home_service_id)
        .limit(1)
        .execute()
    )
    if rows:
        override = rows[0].get("urgent_surcharge_override")
        if override is not None:
            return _num(override)

    return PricingService.urgent_surcharge_for(base_price)


def soft_delete_home_service(home_service_id: str) -> dict:
    """Soft delete by default; hard delete only if nothing has ever booked it.

    Disabling a service must never affect a booking already placed against it,
    so history stays readable.
    """
    booked = _rows(
        supabase.table("booking_tests")
        .select("id")
        .eq("home_service_id", home_service_id)
        .limit(1)
        .execute()
    )
    if booked:
        supabase.table("home_services").update({"is_active": False}) \
            .eq("id", home_service_id).execute()
        return {"hard_deleted": False, "id": home_service_id}

    supabase.table("home_services").delete().eq("id", home_service_id).execute()
    return {"hard_deleted": True, "id": home_service_id}


def _require_admin(user: dict) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only.")
    return user


# ─── Admin ────────────────────────────────────────────────────────────────

@router.get("/admin/home-services")
async def list_all(user: dict = Depends(get_current_user)):
    _require_admin(user)
    return {"services": _rows(supabase.table("home_services").select("*").execute())}


@router.post("/admin/home-services")
async def create(payload: HomeServiceIn, user: dict = Depends(get_current_user)):
    _require_admin(user)
    body = payload.model_dump()
    body["created_by"] = user.get("sub")
    created = _rows(supabase.table("home_services").insert(body).execute())
    return {"service": created[0] if created else None}


@router.patch("/admin/home-services/{service_id}")
async def update(service_id: str, payload: dict, user: dict = Depends(get_current_user)):
    _require_admin(user)
    payload = dict(payload)
    payload["updated_by"] = user.get("sub")
    updated = _rows(
        supabase.table("home_services").update(payload).eq("id", service_id).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Home service not found.")
    return {"service": updated[0]}


@router.delete("/admin/home-services/{service_id}")
async def delete(service_id: str, user: dict = Depends(get_current_user)):
    _require_admin(user)
    return soft_delete_home_service(service_id)


@router.put("/admin/home-services/{service_id}/pricing/{center_id}")
async def set_city_price(service_id: str, center_id: str, payload: CityPriceIn,
                         user: dict = Depends(get_current_user)):
    _require_admin(user)
    existing = _rows(
        supabase.table("home_service_city_pricing").select("id")
        .eq("home_service_id", service_id)
        .eq("processing_center_id", center_id).limit(1).execute()
    )
    body = {"price": payload.price, "is_active": payload.is_active,
            "updated_by": user.get("sub")}
    if existing:
        supabase.table("home_service_city_pricing").update(body) \
            .eq("id", existing[0]["id"]).execute()
    else:
        body.update({"home_service_id": service_id, "processing_center_id": center_id})
        supabase.table("home_service_city_pricing").insert(body).execute()
    return {"ok": True}


# ─── Processing centre (read-only) ────────────────────────────────────────

@router.get("/pc/home-services")
async def pc_catalog(staff: dict = Depends(get_current_pc_staff)):
    """The centre reads the catalog to verify tubes. It cannot change it."""
    services = _rows(
        supabase.table("home_services").select("*").eq("is_active", True).execute()
    )
    for svc in services:
        svc["price"] = price_for_city(svc["id"], staff["processing_center_id"])
    return {"services": services}


# ─── Patient ──────────────────────────────────────────────────────────────

@router.get("/home-services")
async def patient_search(city: Optional[str] = None, pincode: Optional[str] = None,
                         lat: Optional[float] = None, lng: Optional[float] = None,
                         q: Optional[str] = Query(default=None)):
    """Patient-facing search. The resolved centre is used for pricing and then
    discarded — it never appears in the response."""
    centre = resolve_center(city=city, pincode=pincode, lat=lat, lng=lng)
    if centre is None:
        return {"serviceable": False, "services": []}

    services = _rows(
        supabase.table("home_services").select("*")
        .eq("is_active", True).eq("service_kind", "blood_test").execute()
    )
    if q:
        needle = q.strip().lower()
        services = [s for s in services
                    if needle in (s.get("name") or "").lower()
                    or needle in (s.get("code") or "").lower()]

    out = []
    for svc in services:
        item = {k: svc.get(k) for k in PATIENT_FIELDS}
        item["price"] = price_for_city(svc["id"], centre["id"])
        out.append(item)

    return {"serviceable": True, "services": out}


@router.get("/coverage")
async def coverage(city: Optional[str] = None, pincode: Optional[str] = None,
                   lat: Optional[float] = None, lng: Optional[float] = None):
    """Checked at the location step, before slots, address or payment."""
    return check_coverage(city=city, pincode=pincode, lat=lat, lng=lng)


@router.post("/service-area-requests")
async def request_area(payload: AreaRequestIn):
    supabase.table("service_area_requests").insert(payload.model_dump()).execute()
    return {"ok": True}
```

- [ ] **Step 4: Write the centre admin router**

Create `backend/app/routers/processing_center_admin.py`:

```python
"""
Processing Center administration — CallMedex admin only.

Centres are created by CallMedex, never by self-signup. Deciding who becomes a
processing centre is a business decision, not a registration form.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user
from app.middleware.pc_auth import get_current_pc_staff

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/processing-centers", tags=["Processing Centers"])


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _require_admin(user: dict) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only.")
    return user


class CenterIn(BaseModel):
    code: str
    name: str
    city: str
    address: str = ""
    pincode: str = ""
    state: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    partner_lab_name: str = ""
    daily_capacity: int = 0
    status: str = "onboarding"


class StaffIn(BaseModel):
    user_id: str
    pc_role: str = "technician"


class AreaIn(BaseModel):
    city: Optional[str] = None
    pincode: Optional[str] = None
    radius_km: Optional[float] = None
    priority: int = 100


@router.post("")
async def create_center(payload: CenterIn, user: dict = Depends(get_current_user)):
    _require_admin(user)
    body = payload.model_dump()
    body["city"] = body["city"].strip().lower()
    body["created_by"] = user.get("sub")
    created = _rows(supabase.table("processing_centers").insert(body).execute())
    return {"center": created[0] if created else None}


@router.get("")
async def list_centers(user: dict = Depends(get_current_user)):
    _require_admin(user)
    return {"centers": _rows(supabase.table("processing_centers").select("*").execute())}


@router.patch("/{center_id}")
async def update_center(center_id: str, payload: dict,
                        user: dict = Depends(get_current_user)):
    _require_admin(user)
    if "city" in payload and payload["city"]:
        payload["city"] = str(payload["city"]).strip().lower()
    updated = _rows(
        supabase.table("processing_centers").update(payload).eq("id", center_id).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Processing centre not found.")
    return {"center": updated[0]}


@router.post("/{center_id}/staff")
async def add_staff(center_id: str, payload: StaffIn,
                    user: dict = Depends(get_current_user)):
    _require_admin(user)
    if payload.pc_role not in ("admin", "technician"):
        raise HTTPException(status_code=400, detail="pc_role must be admin or technician.")
    supabase.table("processing_center_staff").insert({
        "processing_center_id": center_id,
        "user_id": payload.user_id,
        "pc_role": payload.pc_role,
        "is_active": True,
    }).execute()
    supabase.table("users").update({"role": "processing_center"}) \
        .eq("id", payload.user_id).execute()
    return {"ok": True}


@router.delete("/{center_id}/staff/{user_id}")
async def remove_staff(center_id: str, user_id: str,
                       user: dict = Depends(get_current_user)):
    _require_admin(user)
    supabase.table("processing_center_staff").update({"is_active": False}) \
        .eq("processing_center_id", center_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.post("/{center_id}/areas")
async def add_area(center_id: str, payload: AreaIn,
                   user: dict = Depends(get_current_user)):
    _require_admin(user)
    body = payload.model_dump()
    if body.get("city"):
        body["city"] = body["city"].strip().lower()
    body["processing_center_id"] = center_id
    body["is_active"] = True
    supabase.table("processing_center_areas").insert(body).execute()
    return {"ok": True}


# ─── Centre self-read ─────────────────────────────────────────────────────

me_router = APIRouter(prefix="/api/pc", tags=["Processing Centers"])


@me_router.get("/me")
async def my_center(staff: dict = Depends(get_current_pc_staff)):
    rows = _rows(
        supabase.table("processing_centers").select("*")
        .eq("id", staff["processing_center_id"]).limit(1).execute()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Processing centre not found.")
    return {"center": rows[0], "pc_role": staff["pc_role"]}
```

- [ ] **Step 5: Register the routers**

`main.py` mixes a top import block with inline per-router imports (`from app.routers import samples` at line 261, `lab_team` at 263). Follow the inline style. After line 266 (`app.include_router(marketplace.router)`) add:

```python
from app.routers import processing_center_admin
app.include_router(processing_center_admin.router)
app.include_router(processing_center_admin.me_router)

from app.routers import home_services
app.include_router(home_services.router)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all pass, 19 in `test_home_services_catalog.py`.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/home_services.py backend/app/routers/processing_center_admin.py backend/app/main.py backend/tests/test_home_services_catalog.py
git commit -m "feat(api): admin centre and catalog endpoints, patient search and coverage"
```

---

## Task 12: Family member and roster endpoints

**Files:**
- Create: `backend/app/routers/family_members.py`, `backend/app/routers/roster.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_roster.py` (append)

**Interfaces:**
- Consumes: `family_members` (Task 5), `run_roster_pass` / `decline_job` (Task 9), `get_current_pc_staff` (Task 2).
- Produces: `ensure_self_member(account_user_id, full_name) -> dict`, plus the routes in spec §5.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_roster.py`:

```python
import app.routers.family_members as fm_mod
from app.routers.family_members import ensure_self_member


@pytest.fixture
def fm_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(fm_mod, "supabase", fake)
    return fake


def test_the_account_holder_becomes_a_family_member_row(fm_db):
    """Uniform subjects are what make per-person barcodes fall out of the schema."""
    uid = str(uuid.uuid4())
    member = ensure_self_member(uid, "Chaitanya")
    assert member["is_self"] is True
    assert member["account_user_id"] == uid
    assert len(fm_db.db["family_members"]) == 1


def test_ensuring_self_twice_creates_one_row(fm_db):
    uid = str(uuid.uuid4())
    first = ensure_self_member(uid, "Chaitanya")
    second = ensure_self_member(uid, "Chaitanya")
    assert first["id"] == second["id"]
    assert len(fm_db.db["family_members"]) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_roster.py -v -k family or self_member`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.routers.family_members'`.

- [ ] **Step 3: Write the family members router**

Create `backend/app/routers/family_members.py`:

```python
"""
Family members.

Every booking subject — including the account holder — is a family_members row.
That uniformity is what makes "separate barcode, separate sample, separate
report" per person fall out of the schema instead of needing a special case.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/family-members", tags=["Family Members"])


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


class MemberIn(BaseModel):
    full_name: str
    relationship: str = ""
    gender: str = ""
    date_of_birth: Optional[str] = None
    mobile: str = ""


def ensure_self_member(account_user_id: str, full_name: str) -> dict:
    """Idempotently create the account holder's own subject row."""
    existing = _rows(
        supabase.table("family_members").select("*")
        .eq("account_user_id", account_user_id).eq("is_self", True)
        .limit(1).execute()
    )
    if existing:
        return existing[0]

    created = _rows(
        supabase.table("family_members").insert({
            "account_user_id": account_user_id,
            "full_name": full_name,
            "relationship": "self",
            "is_self": True,
        }).execute()
    )
    return created[0] if created else {}


@router.get("")
async def list_members(user: dict = Depends(get_current_user)):
    account_id = user.get("sub")
    ensure_self_member(account_id, user.get("full_name") or "")
    return {"members": _rows(
        supabase.table("family_members").select("*")
        .eq("account_user_id", account_id).execute()
    )}


@router.post("")
async def add_member(payload: MemberIn, user: dict = Depends(get_current_user)):
    body = payload.model_dump()
    body["account_user_id"] = user.get("sub")
    body["is_self"] = False
    created = _rows(supabase.table("family_members").insert(body).execute())
    return {"member": created[0] if created else None}


@router.patch("/{member_id}")
async def update_member(member_id: str, payload: dict,
                        user: dict = Depends(get_current_user)):
    payload.pop("is_self", None)          # the self row cannot be reassigned
    payload.pop("account_user_id", None)
    updated = _rows(
        supabase.table("family_members").update(payload)
        .eq("id", member_id).eq("account_user_id", user.get("sub")).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Family member not found.")
    return {"member": updated[0]}


@router.delete("/{member_id}")
async def delete_member(member_id: str, user: dict = Depends(get_current_user)):
    rows = _rows(
        supabase.table("family_members").select("is_self")
        .eq("id", member_id).eq("account_user_id", user.get("sub")).limit(1).execute()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Family member not found.")
    if rows[0].get("is_self"):
        raise HTTPException(status_code=400, detail="You cannot remove yourself.")
    supabase.table("family_members").delete().eq("id", member_id) \
        .eq("account_user_id", user.get("sub")).execute()
    return {"ok": True}
```

- [ ] **Step 4: Write the roster router**

Create `backend/app/routers/roster.py`:

```python
"""
Roster endpoints.

The centre marks who is available tomorrow; the assignment pass runs at the
roster_cutoff. A phlebotomist sees their advance list this evening and may
decline, which reassigns rather than cancels.
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user
from app.middleware.pc_auth import get_current_pc_staff, require_pc_admin
from app.services.roster import decline_job, run_roster_pass

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Roster"])


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


class RosterEntry(BaseModel):
    phlebotomist_user_id: str
    status: str = "available"
    max_jobs: int = 0


@router.get("/pc/roster")
async def get_roster(date: str, staff: dict = Depends(get_current_pc_staff)):
    return {"roster": _rows(
        supabase.table("phlebotomist_roster").select("*")
        .eq("processing_center_id", staff["processing_center_id"])
        .eq("roster_date", date).execute()
    )}


@router.put("/pc/roster/{date}")
async def set_roster(date: str, entries: List[RosterEntry],
                     staff: dict = Depends(require_pc_admin)):
    centre = staff["processing_center_id"]
    for entry in entries:
        if entry.status not in ("available", "unavailable", "leave"):
            raise HTTPException(status_code=400, detail=f"Bad status: {entry.status}")
        existing = _rows(
            supabase.table("phlebotomist_roster").select("id")
            .eq("phlebotomist_user_id", entry.phlebotomist_user_id)
            .eq("roster_date", date).limit(1).execute()
        )
        body = {"status": entry.status, "max_jobs": entry.max_jobs}
        if existing:
            supabase.table("phlebotomist_roster").update(body) \
                .eq("id", existing[0]["id"]).execute()
        else:
            body.update({
                "processing_center_id": centre,
                "phlebotomist_user_id": entry.phlebotomist_user_id,
                "roster_date": date,
            })
            supabase.table("phlebotomist_roster").insert(body).execute()
    return {"ok": True}


@router.post("/pc/roster/{date}/run")
async def run_pass(date: str, staff: dict = Depends(require_pc_admin)):
    """Force the assignment pass early rather than waiting for the cutoff."""
    assigned = run_roster_pass(staff["processing_center_id"], date)
    return {"assigned": assigned, "count": len(assigned)}


@router.get("/phlebo/jobs")
async def my_jobs(date: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "phlebotomist":
        raise HTTPException(status_code=403, detail="Phlebotomists only.")
    return {"jobs": _rows(
        supabase.table("dispatch_requests").select("*")
        .eq("assigned_provider_id", user.get("sub"))
        .eq("scheduled_for", date).execute()
    )}


@router.post("/phlebo/jobs/{dispatch_id}/decline")
async def decline(dispatch_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "phlebotomist":
        raise HTTPException(status_code=403, detail="Phlebotomists only.")
    result = decline_job(dispatch_id, user.get("sub"))
    if result is None:
        # Nobody left. The centre picks it up manually rather than it vanishing.
        return {"reassigned": False, "needs_manual_assignment": True}
    return {"reassigned": True, "assigned_to": result["phlebotomist_user_id"]}
```

- [ ] **Step 5: Register the routers**

In `backend/app/main.py`, immediately after the Task 11 registrations, same inline style:

```python
from app.routers import family_members
app.include_router(family_members.router)

from app.routers import roster
app.include_router(roster.router)
```

Note the module name collision: `app.routers.roster` and `app.services.roster` are different modules. The router imports the service as `from app.services.roster import decline_job, run_roster_pass`, so nothing is shadowed.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all pass, 12 in `test_roster.py`.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/family_members.py backend/app/routers/roster.py backend/app/main.py backend/tests/test_roster.py
git commit -m "feat(api): family member CRUD and roster endpoints"
```

---

## Task 13: Future report automation schema

**Files:**
- Modify: `database/task1_processing_center_foundation.sql` (append section 8)
- Test: `backend/tests/test_sample_verification.py` (append)

**Interfaces:**
- Consumes: `samples` (Task 6), `booking_subjects` (Task 5).
- Produces: tables `lab_reports`, `report_fetch_jobs`. **No worker, no endpoint, no automation.**

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_sample_verification.py`:

```python
def test_report_tables_exist_for_the_future_task():
    sql = _sql()
    assert "CREATE TABLE IF NOT EXISTS lab_reports" in sql
    assert "CREATE TABLE IF NOT EXISTS report_fetch_jobs" in sql
    for status in ("'pending'", "'fetching'", "'ready'", "'failed'", "'manual'"):
        assert status in sql, status


def test_the_barcode_is_the_lookup_key_the_future_agent_will_use():
    sql = _sql()
    assert "barcode TEXT NOT NULL" in sql   # on report_fetch_jobs


def test_no_automation_is_implemented_in_this_task():
    """Tables only. The MocDoc agent is a later task and must not appear here."""
    from pathlib import Path
    backend = Path(__file__).resolve().parents[1] / "app"
    hits = [
        p for p in backend.rglob("*.py")
        if "mocdoc" in p.read_text(encoding="utf-8", errors="ignore").lower()
    ]
    assert hits == [], f"MocDoc automation leaked into: {hits}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_sample_verification.py -v`
Expected: 2 failed (the third already passes — nothing references MocDoc yet).

- [ ] **Step 3: Append section 8 to the migration**

Insert before the `-- 99. RLS` block:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 8. FUTURE REPORT AUTOMATION — TABLES ONLY
--
--    This task ends when a verified sample is handed to the laboratory. The
--    browser agent that logs into MocDoc, searches by barcode and uploads the
--    PDF is a LATER task. These tables and samples.report_status exist so it
--    can be added without redesigning the workflow.
--
--    NOTHING here is implemented in this task. No worker, no endpoint.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lab_reports (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID REFERENCES samples(id) ON DELETE CASCADE,
    booking_subject_id UUID REFERENCES booking_subjects(id) ON DELETE SET NULL,
    barcode   TEXT,
    source    TEXT DEFAULT 'mocdoc_automation',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'fetching', 'ready', 'failed', 'manual')),
    file_url   TEXT DEFAULT '',
    fetched_at TIMESTAMPTZ,
    attempts   INT DEFAULT 0,
    last_error TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_reports_sample  ON lab_reports(sample_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_barcode ON lab_reports(barcode);

CREATE TABLE IF NOT EXISTS report_fetch_jobs (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID REFERENCES samples(id) ON DELETE CASCADE,
    barcode   TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'abandoned')),
    scheduled_for TIMESTAMPTZ,
    attempts   INT DEFAULT 0,
    last_error TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_jobs_status ON report_fetch_jobs(status, scheduled_for);
```

Extend the section 99 `new_tables` array with `'lab_reports'` and `'report_fetch_jobs'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_sample_verification.py -v`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add database/task1_processing_center_foundation.sql backend/tests/test_sample_verification.py
git commit -m "feat(reports): schema-only groundwork for future report automation"
```

---

## Task 14: Leak guards

**Files:**
- Create: `backend/tests/test_patient_payload_leaks.py`
- Test: itself

**Interfaces:**
- Consumes: every patient-facing route from Tasks 11 and 12.
- Produces: nothing — this task adds only tests.

- [ ] **Step 1: Write the test**

This is the task that protects the business model. Create `backend/tests/test_patient_payload_leaks.py`:

```python
"""
Leak guards.

A patient books from CallMedex. They must never learn which processing centre
or which laboratory handled their sample — that is the entire premise of the
model, and it is one careless select("*") away from being false.

These tests assert against SERIALISED JSON so a leak fails the build rather
than shipping quietly.
"""
import json
import uuid

import pytest

import app.routers.home_services as hs_mod
import app.services.processing_center as pc_mod
from app.routers.home_services import coverage, patient_search
from tests.test_sample_lifecycle import FakeSupabase

FORBIDDEN = (
    "processing_center",
    "processing_center_id",
    "partner_lab",
    "partner_lab_name",
    "laboratory",
    "laboratory_name",
    "laboratory_org_id",
    "HYD-01",
    "VSP-01",
)


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(hs_mod, "supabase", fake)
    monkeypatch.setattr(pc_mod, "supabase", fake)

    centre_id = str(uuid.uuid4())
    fake.db["processing_centers"] = [{
        "id": centre_id, "code": "HYD-01", "name": "Hyderabad Processing Centre 01",
        "city": "hyderabad", "lat": 17.385, "lng": 78.487, "status": "active",
        "partner_lab_name": "Some Partner Laboratory Pvt Ltd",
        "partner_lab_reference": "SPL-9931", "daily_capacity": 400,
    }]
    fake.db["processing_center_areas"] = [{
        "id": str(uuid.uuid4()), "processing_center_id": centre_id,
        "city": "hyderabad", "pincode": None, "radius_km": None,
        "priority": 100, "is_active": True,
    }]
    fake.db["city_aliases"] = [{"alias": "hyderabad", "canonical_city": "hyderabad"}]
    fake.db["home_services"] = [{
        "id": str(uuid.uuid4()), "code": "CBC", "name": "Complete Blood Count",
        "service_kind": "blood_test", "category": "blood_test", "description": "",
        "base_price": 350.0, "is_active": True, "home_collection_available": True,
        "fasting_required": False, "fasting_hours": 0,
        "preparation_instructions": "", "estimated_report_hours": 6,
    }]
    return fake


def _assert_clean(payload):
    blob = json.dumps(payload, default=str).lower()
    for needle in FORBIDDEN:
        assert needle.lower() not in blob, f"leaked {needle!r} in {blob}"


@pytest.mark.asyncio
async def test_patient_search_leaks_no_centre_or_laboratory(db):
    _assert_clean(await patient_search(city="Hyderabad"))


@pytest.mark.asyncio
async def test_patient_search_still_returns_a_usable_price(db):
    """The guard must not pass by returning nothing."""
    result = await patient_search(city="Hyderabad")
    assert result["serviceable"] is True
    assert result["services"][0]["price"] == 350.0
    assert result["services"][0]["name"] == "Complete Blood Count"


@pytest.mark.asyncio
async def test_coverage_returns_a_boolean_and_nothing_else(db):
    assert await coverage(city="Hyderabad") == {"serviceable": True}
    assert await coverage(city="Rajahmundry") == {"serviceable": False}


@pytest.mark.asyncio
async def test_an_unserviced_search_leaks_nothing_either(db):
    _assert_clean(await patient_search(city="Rajahmundry"))


def test_the_patient_field_allowlist_excludes_every_internal_column():
    """Match on name SEGMENTS, not substrings: 'available' contains 'lab'."""
    from app.routers.home_services import PATIENT_FIELDS
    banned = {"center", "centre", "lab", "laboratory", "partner", "processing"}
    for field in PATIENT_FIELDS:
        segments = set(field.split("_"))
        assert not (segments & banned), f"{field} exposes {segments & banned}"


def test_home_services_and_walk_in_services_are_different_tables():
    """A diagnostic centre publishes walk-in imaging; it publishes nothing a
    phlebotomist delivers."""
    from pathlib import Path
    router = (Path(__file__).resolve().parents[1] / "app" / "routers"
              / "home_services.py").read_text(encoding="utf-8")
    assert "provider_services" not in router
```

- [ ] **Step 2: Run the tests**

Run: `cd backend && python -m pytest tests/test_patient_payload_leaks.py -v`
Expected: 6 passed. If any fail, a real leak exists — fix the router, not the test.

- [ ] **Step 3: Run the entire suite**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all pass, including every pre-existing test file.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_patient_payload_leaks.py
git commit -m "test: guard against centre and laboratory identity reaching patients"
```

---

## Task 15: Migration verification

**Files:**
- Modify: `database/task1_processing_center_foundation.sql` (final review only)
- Test: `backend/tests/test_processing_center.py` (append)

**Interfaces:**
- Consumes: the complete migration from Tasks 1–13.
- Produces: nothing — a structural audit of the finished migration.

- [ ] **Step 1: Write the audit test**

Append to `backend/tests/test_processing_center.py`:

```python
def test_every_new_table_appears_in_the_rls_loop():
    """Lint 0008: a table without a deny-all policy is reachable by anon."""
    import re
    sql = _sql()
    created = set(re.findall(r"CREATE TABLE IF NOT EXISTS (\w+)", sql))
    rls_block = sql.split("new_tables TEXT[] := ARRAY[")[1].split("];")[0]
    guarded = set(re.findall(r"'(\w+)'", rls_block))
    assert created - guarded == set(), f"unguarded tables: {created - guarded}"


def test_the_migration_has_exactly_one_transaction():
    sql = _sql()
    assert sql.count("BEGIN;") == 1
    assert sql.count("COMMIT;") == 1
    assert sql.index("BEGIN;") < sql.index("COMMIT;")


def test_notify_comes_after_commit():
    sql = _sql()
    assert sql.index("COMMIT;") < sql.index("NOTIFY pgrst")


def test_batches_are_created_before_samples_references_them():
    """Statement order matters: the ALTER would fail otherwise."""
    sql = _sql()
    assert sql.index("CREATE TABLE IF NOT EXISTS sample_batches") < \
           sql.index("ADD COLUMN IF NOT EXISTS batch_id")


def test_booking_subjects_exists_before_samples_references_it():
    sql = _sql()
    assert sql.index("CREATE TABLE IF NOT EXISTS booking_subjects") < \
           sql.index("ADD COLUMN IF NOT EXISTS booking_subject_id")
```

- [ ] **Step 2: Run the audit**

Run: `cd backend && python -m pytest tests/test_processing_center.py -v -k migration or rls or batches or subjects or notify`
Expected: 5 passed. Any failure is a real ordering or RLS bug in the migration — fix the SQL.

- [ ] **Step 3: Verify the migration is genuinely re-runnable**

If a Supabase instance is reachable, apply the migration twice and confirm the second run is a clean no-op:

```bash
psql "$SUPABASE_DB_URL" -f database/task1_processing_center_foundation.sql
psql "$SUPABASE_DB_URL" -f database/task1_processing_center_foundation.sql
```

Expected: both runs exit 0, and the second produces no errors. If no instance is reachable, record that this step was skipped — do not claim it passed.

- [ ] **Step 4: Run the full suite one final time**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_processing_center.py
git commit -m "test: audit migration ordering and RLS coverage"
```

---

## Spec Coverage

| Spec section | Task |
|---|---|
| §3.1 Processing centres, staff | 1 |
| §3.2 Serviceable areas, city aliases | 1 |
| §3.3 Home-service catalog, tubes, city pricing | 3 |
| §3.4 Family members, booking subjects, test lines | 5 |
| §3.5 Booking extension | 5 |
| §3.6 Samples, sample_tests, grain, nullable barcode | 6 |
| §3.7 Batches, repurposed handovers | 6 |
| §3.8 Chain of custody | 6 |
| §3.9 Coverage demand capture | 7 |
| §3.10 Future report tables | 13 |
| §4.1 Resolver, coverage, assignment | 7, 8 |
| §4.2 Tube derivation | 4 |
| §4.3 Dispatch binding, three modes | 10 |
| §4.3 Urgent pricing, per-service override | 3 (column), 11 (`urgent_surcharge_for_service`) |
| §4.4 Advance rostering | 9, 12 |
| §4.5 PC auth | 2 |
| §5 API surface | 11, 12 |
| §6 Testing, leak guards | 4, 7, 8, 9, 10, 14, 15 |
| §7 Migration | 1, 15 |

## Deferred to Specs 2 and 3

The PC dashboard, the scan-and-verify screen, batch screens, the booking queue, dashboard tiles, phlebotomist dashboard changes and the patient status rail are all UI and land in Specs 2 and 3. This plan builds the data model, services and API they consume — the write paths for verification and batching are deliberately left to Spec 2, where the screens that drive them are built.
