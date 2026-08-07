# CallMedex Patient Dashboard Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the CallMedex Patient Dashboard to an AI-native healthcare portal combining Preventive Health Analytics, High-Touch Family Caregiving, and Real-Time Telemetry Safety while maintaining 100% backward compatibility.

**Architecture:** Add isolated Supabase SQL schema migrations (`task11_patient_dashboard_upgrade.sql`), modular FastAPI endpoints (`patient_health.py` and `patient_sos.py`), Zustand stores (`useHealthMatrixStore` and `useFamilyHubStore`), and Next.js Framer Motion glassmorphism UI components gated by feature flags.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Framer Motion, Recharts, Zustand, FastAPI, Python 3.11, PostgreSQL (Supabase).

## Global Constraints

- Preserve 100% backward compatibility with ABDM M1/M2/M3, FHIR R4, NHCX, and booking backend services.
- All new components must be gated by `FEATURE_FLAGS` in `frontend/src/config/featureFlags.ts`.
- Zero silent breakages: Do not delete, disable, or mock existing components or endpoints.
- Defensive security: Enforce JWT authentication (`get_current_user`), input validation, and user isolation (`patient_id == current_user.id`).

---

### Task 1: Database Migration & Config Infrastructure

**Files:**
- Create: `database/task11_patient_dashboard_upgrade.sql`
- Create: `frontend/src/config/featureFlags.ts`
- Modify: `backend/app/config.py`

**Interfaces:**
- Consumes: Existing `users` table and `report_jobs` table in PostgreSQL.
- Produces: 4 new PostgreSQL tables (`patient_biomarkers`, `doctor_briefings`, `emergency_sos_contacts`, `patient_medications`) and `FEATURE_FLAGS` export.

- [ ] **Step 1: Write SQL migration file `database/task11_patient_dashboard_upgrade.sql`**

```sql
BEGIN;

-- 1. Patient Biomarkers Time-Series Table
CREATE TABLE IF NOT EXISTS patient_biomarkers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    observation_code TEXT NOT NULL,
    observation_name TEXT NOT NULL,
    value_number NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    source_report_job_id UUID REFERENCES report_jobs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_biomarkers_patient_time
    ON patient_biomarkers(patient_id, recorded_at DESC);

-- 2. Doctor Briefings Cache Table
CREATE TABLE IF NOT EXISTS doctor_briefings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialty_type TEXT NOT NULL,
    summary_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_briefings_patient
    ON doctor_briefings(patient_id, specialty_type);

-- 3. Emergency SOS Contacts Table
CREATE TABLE IF NOT EXISTS emergency_sos_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_sos_patient
    ON emergency_sos_contacts(patient_id) WHERE is_active = TRUE;

-- 4. Patient Medications Table
CREATE TABLE IF NOT EXISTS patient_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    total_pills INT NOT NULL,
    remaining_pills INT NOT NULL,
    pills_per_day INT NOT NULL DEFAULT 1,
    refill_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_medications_patient
    ON patient_medications(patient_id);

COMMIT;
```

- [ ] **Step 2: Create `frontend/src/config/featureFlags.ts`**

```typescript
export const FEATURE_FLAGS = {
  ENABLE_PREVENTIVE_BIOMARKERS: true,
  ENABLE_DOCTOR_BRIEFING: true,
  ENABLE_FAMILY_SWIPER: true,
  ENABLE_EMERGENCY_SOS: true,
  ENABLE_SMART_MEDICINE_CABINET: true,
  ENABLE_PHLEBO_RADAR: true,
} as const;
```

- [ ] **Step 3: Update `backend/app/config.py` with feature flag settings**

Add feature flags settings to `backend/app/config.py`.

---

### Task 2: Zustand State Stores

**Files:**
- Create: `frontend/src/store/useHealthMatrixStore.ts`
- Create: `frontend/src/store/useFamilyHubStore.ts`

**Interfaces:**
- Consumes: REST APIs from `/api/v1/patient/biomarkers/matrix` and `/api/v1/patient/medications`.
- Produces: React state hooks for biomarker risk selection and family member context.

- [ ] **Step 1: Create `frontend/src/store/useHealthMatrixStore.ts`**

Implement store for biomarker observations, risk compass calculation state, active parameter selection, and doctor briefing cache.

- [ ] **Step 2: Create `frontend/src/store/useFamilyHubStore.ts`**

Implement store for family member list, active member context, unread alerts count per member, and SOS trigger state.

---

### Task 3: Backend Routers (Patient Health & SOS)

**Files:**
- Create: `backend/app/routers/patient_health.py`
- Create: `backend/app/routers/patient_sos.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: Supabase database connection and JWT user session.
- Produces: API endpoints:
  - `GET /api/v1/patient/biomarkers/matrix`
  - `POST /api/v1/patient/doctor-briefing`
  - `POST /api/v1/patient/sos/trigger`
  - `GET /api/v1/patient/medications`
  - `POST /api/v1/patient/medications`

- [ ] **Step 1: Create `backend/app/routers/patient_health.py`**

Implement `/matrix` and `/doctor-briefing` routes with mock/fallback sample data when database is unseeded.

- [ ] **Step 2: Create `backend/app/routers/patient_sos.py`**

Implement `/sos/trigger`, `/medications` GET, and `/medications` POST routes with SMS dispatch simulation.

- [ ] **Step 3: Register routers in `backend/app/main.py`**

Import and include `patient_health.router` and `patient_sos.router` into the FastAPI application.

---

### Task 4: Frontend Subsystem Components & Integration

**Files:**
- Create: `frontend/src/app/(app)/dashboard/components/BiomarkerMatrix.tsx`
- Create: `frontend/src/app/(app)/dashboard/components/DoctorBriefingModal.tsx`
- Create: `frontend/src/app/(app)/dashboard/components/FamilySwiperWheel.tsx`
- Create: `frontend/src/app/(app)/dashboard/components/EmergencySOSWidget.tsx`
- Create: `frontend/src/app/(app)/dashboard/components/MedicineCabinetGrid.tsx`
- Create: `frontend/src/app/(app)/dashboard/components/PhlebotomistRadar.tsx`
- Modify: `frontend/src/app/(app)/dashboard/patient/page.tsx`

**Interfaces:**
- Consumes: Zustand stores (`useHealthMatrixStore`, `useFamilyHubStore`) and backend REST endpoints.
- Produces: Fully interactive glassmorphic dashboard views for patient portal.

- [ ] **Step 1: Create `BiomarkerMatrix.tsx`** (3D Risk Compass Ring + Multi-axis Recharts visualization).
- [ ] **Step 2: Create `DoctorBriefingModal.tsx`** (Specialty briefing generator, PDF export view, QR code, and WhatsApp share button).
- [ ] **Step 3: Create `FamilySwiperWheel.tsx`** (Header avatar switcher with glowing status indicators).
- [ ] **Step 4: Create `EmergencySOSWidget.tsx`** (Floating SOS button with 5-second hold-to-cancel ring).
- [ ] **Step 5: Create `MedicineCabinetGrid.tsx`** (3D pill inventory cards with radial progress bars).
- [ ] **Step 6: Create `PhlebotomistRadar.tsx`** (Dark-mode tactical radar view with GPS, speed, temperature, and 4-digit OTP).
- [ ] **Step 7: Integrate all components into `frontend/src/app/(app)/dashboard/patient/page.tsx`** under `FEATURE_FLAGS` guards.

---

### Task 5: End-to-End Regression & Integration Tests

**Files:**
- Create: `backend/tests/test_patient_dashboard_upgrade.py`

**Interfaces:**
- Consumes: FastAPI TestClient and authentication tokens.
- Produces: Test results verifying feature flags, database queries, biomarker calculations, briefing compilation, SOS trigger idempotency, and medication inventory.

- [ ] **Step 1: Create `backend/tests/test_patient_dashboard_upgrade.py`**
- [ ] **Step 2: Run pytest to verify all tests pass unconditionally**
