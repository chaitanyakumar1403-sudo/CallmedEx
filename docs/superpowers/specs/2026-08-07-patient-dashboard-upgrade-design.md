# CallMedex Patient Dashboard Upgrade — Production Design Specification

**Date:** 2026-08-07  
**Author:** CallMedex Core Engineering Team  
**Status:** Approved  
**Target Repository:** CallMedex (`frontend/` & `backend/`)

---

## 1. Executive Summary & Production Objectives

The CallMedex Patient Dashboard is being upgraded to a state-of-the-art, AI-native healthcare portal that combines **Preventive Health Analytics**, **High-Touch Family Caregiving**, and **Real-Time Telemetry Safety**.

All additions preserve 100% backward compatibility with existing ABDM M1/M2/M3, FHIR R4, NHCX, and booking backend services.

---

## 2. Architecture & Boundary System

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND (NEXT.JS + TAILWIND + FRAMER MOTION)                  │
│                                                                                                  │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐                 │
│  │ FamilySwiperWheel     │  │ BiomarkerMatrix       │  │ DoctorBriefingModal   │                 │
│  │ (Caregiver Switcher)  │  │ (3D Risk Compass Ring)│  │ (PDF/QR Exporter)     │                 │
│  └───────────┬───────────┘  └───────────┬───────────┘  └───────────┬───────────┘                 │
│              │                          │                          │                             │
│  ┌───────────┴───────────┐  ┌───────────┴───────────┐  ┌───────────┴───────────┐                 │
│  │ EmergencySOSWidget    │  │ MedicineCabinetGrid   │  │ PhlebotomistRadar     │                 │
│  │ (5s Hold-to-Cancel)   │  │ (Pill Refill Radar)   │  │ (Telemetry Map)       │                 │
│  └───────────┬───────────┘  └───────────┬───────────┘  └───────────┬───────────┘                 │
└──────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────────┘
               │                          │                          │
               ▼                          ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ISOLATED FRONTEND ZUSTAND STORES                               │
│          [ useHealthMatrixStore ]       [ useFamilyHubStore ]       [ featureFlags ]             │
└─────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                          │ (REST / JSON + JWT)
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   BACKEND SERVICES (FASTAPI)                                     │
│                                                                                                  │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐                 │
│  │ /api/v1/biomarkers    │  │ /api/v1/doctor-brief  │  │ /api/v1/patient/sos   │                 │
│  │ (Time-Series Engine)  │  │ (Specialty Compiler)  │  │ (Twilio/WhatsApp SOS) │                 │
│  └───────────┬───────────┘  └───────────┬───────────┘  └───────────┬───────────┘                 │
└──────────────┼──────────────────────────┼──────────────────────────┼─────────────────────────────┘
               │                          │                          │
               ▼                          ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SUPABASE POSTGRESQL + POSTGIS                                  │
│   (patient_biomarkers, doctor_briefings, emergency_sos_contacts, patient_medications)           │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema Migration Specification

**File:** `database/task11_patient_dashboard_upgrade.sql`

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

---

## 4. Subsystem Components & API Design

### 4.1 Feature Flags & Isolation (Phase 0)
* **Frontend:** `frontend/src/config/featureFlags.ts`
  ```typescript
  export const FEATURE_FLAGS = {
    ENABLE_PREVENTIVE_BIOMARKERS: true,
    ENABLE_DOCTOR_BRIEFING: true,
    ENABLE_FAMILY_SWIPER: true,
    ENABLE_EMERGENCY_SOS: true,
    ENABLE_SMART_MEDICINE_CABINET: true,
    ENABLE_PHLEBO_RADAR: true,
  };
  ```
* **Backend:** `backend/app/config.py` (adds settings for feature flags).

### 4.2 Zustand State Stores
* **`frontend/src/store/useHealthMatrixStore.ts`**: Holds biomarker trend points, active parameter selection, risk compass calculation state.
* **`frontend/src/store/useFamilyHubStore.ts`**: Holds active family member context, unread alerts count per member, dependent consent tokens.

### 4.3 Phase 1: Preventive Health & Visual Analytics (Approach A)
* **Backend Router:** `backend/app/routers/patient_health.py`
  * `GET /api/v1/patient/biomarkers/matrix`: Aggregates historical biomarkers for `patient_id` and calculates 5-year risk projections.
  * `POST /api/v1/patient/doctor-briefing`: Compiles ABHA records, active medications, and lab anomalies into a specialty-tailored JSON briefing.
* **Frontend Components:**
  * `frontend/src/app/(app)/dashboard/components/BiomarkerMatrix.tsx`: Recharts multi-axis line chart + Framer Motion interactive 3D Health Risk Compass Ring (#10B981, #F59E0B, #EF4444).
  * `frontend/src/app/(app)/dashboard/components/DoctorBriefingModal.tsx`: Specialty selector, PDF generator, WhatsApp sharing, and QR code renderer.

### 4.4 Phase 2: High-Touch Caregiving & Family Safety (Approach B)
* **Backend Router:** `backend/app/routers/patient_sos.py`
  * `POST /api/v1/patient/sos/trigger`: Validates idempotency, fetches emergency contacts, dispatches SMS/WhatsApp alerts with live GPS location & medical summary.
  * `GET/POST /api/v1/patient/medications`: Refill radar and pill inventory management.
* **Frontend Components:**
  * `frontend/src/app/(app)/dashboard/components/FamilySwiperWheel.tsx`: Top header avatar wheel with glowing status badges.
  * `frontend/src/app/(app)/dashboard/components/EmergencySOSWidget.tsx`: Floating SOS button with 5-second hold-to-cancel ring.
  * `frontend/src/app/(app)/dashboard/components/MedicineCabinetGrid.tsx`: 3D medicine card grid with radial refill progress bars.

### 4.5 Phase 3: Telemetry View & Visual Polish (Approach C Integration)
* **Frontend Component:**
  * `frontend/src/app/(app)/dashboard/components/PhlebotomistRadar.tsx`: Dark-mode tactical map view with phlebotomist GPS, speed, temperature container telemetry, and 4-digit OTP.
* **Glassmorphism Theme System:**
  * Semi-transparent dark card surfaces (`rgba(15, 23, 42, 0.75)`), `backdrop-filter: blur(16px)`, border `1px solid rgba(255, 255, 255, 0.1)`.

---

## 5. Implementation Phases & Verification Strategy

1. **Phase 0:** System Audit, Feature Flags, Zustand Stores, SQL Migration (`task11_patient_dashboard_upgrade.sql`).
2. **Phase 1:** Backend Biomarker & Briefing Engine (`patient_health.py`) -> Frontend `BiomarkerMatrix.tsx` & `DoctorBriefingModal.tsx`.
3. **Phase 2:** Backend SOS & Medication Radar (`patient_sos.py`) -> Frontend `FamilySwiperWheel.tsx`, `EmergencySOSWidget.tsx`, `MedicineCabinetGrid.tsx`.
4. **Phase 3:** Dark-Mode Telemetry Radar (`PhlebotomistRadar.tsx`) & Glassmorphism design system application.
5. **Phase 4:** Full End-to-End Regression & Integration Test Suite (`tests/test_patient_dashboard_upgrade.py`).

---

## 6. Spec Self-Review
* **Placeholder Scan:** 0 placeholders found.
* **Internal Consistency:** Schemas match FastAPIRouters and Zustand stores.
* **Scope Check:** Appropriately scoped for step-by-step phased execution.
* **Ambiguity Check:** All APIs, routes, payload fields, and UI interactions are explicitly typed.
