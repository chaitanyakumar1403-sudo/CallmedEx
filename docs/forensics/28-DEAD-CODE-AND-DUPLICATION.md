# CallMedex Forensic Intelligence: Dead Code, Stubs, Duplication & Technical Debt Inventory

> **Analysis Scope**: Exhaustive repository sweep identifying unreferenced modules, legacy superseded implementations, route aliases, stubbed/mocked services, and root directory technical debt.

---

## 1. Dead Code Inventory (Never Imported or Invoked)

| File / Component | Path | Size | Functional Intent | Forensic Discovery & Proof of Inactivity |
| :--- | :--- | :--- | :--- | :--- |
| `FraudScoringService` | `backend/app/services/fraud_scoring.py` | 905 B (30 lines) | Prototype penalty/scoring formula for provider no-shows. | **0 imports across entire codebase**. Superseded by `app/services/fraud_detection.py` which is actively imported in `app/routers/admin.py`. |
| `DispatchService` | `backend/app/services/dispatch.py` | 10.5 KB (290 lines) | Phase 2 Haversine phlebotomist dispatch and distance calculator. | Imported on Line 15 of `app/routers/dispatch.py`, but **zero methods are ever called**. Superseded by `UniversalDispatchEngine` in `app/services/dispatch_engine.py` (100 KB). Comment in router explicitly states: *"No need for a second DispatchService call — that was a double write."* |
| `analyze_fks.py` | Root directory | 1.6 KB | One-off foreign key constraint analyzer. | Ad-hoc maintenance script left in root. |
| `check_tables.py` | Root directory | 1.7 KB | Database table existence and row count verification script. | Ad-hoc maintenance script left in root. |
| `scratch_check.py` | Root directory | 669 B | Scratch debug verification snippet. | Disposable development artifact. |
| `scratch_fix_urls.js`| Root directory | 1.7 KB | Node.js script for patching URL strings. | Disposable development artifact. |
| Stray Media File | `WhatsApp Image 2026-07-29 at 5.07.48 PM.jpeg` | 69.3 KB | WhatsApp UI screenshot. | Accidentally committed binary image in repository root. |

---

## 2. Directory & Route Duplication (Aliases & Re-exports)

### 2.1 Next.js Processing Center Directory Alias
- **Location 1**: `frontend/src/app/(app)/dashboard/processing-center/page.tsx` (4,076 B) — Canonical Next.js page.
- **Location 2**: `frontend/src/app/(app)/dashboard/processing_center/page.tsx` (298 B) — Re-export alias:
  ```typescript
  "use client";
  /**
   * Route alias — the database stores role as "processing_center" (underscore)
   * but the canonical Next.js folder is "processing-center" (hyphen).
   * This page ensures /dashboard/processing_center resolves without a 404.
   */
  export { default } from "../processing-center/page";
  ```
- **Forensic Assessment**: Intentional shim bridging backend snake_case database roles with frontend kebab-case folder routing conventions.

### 2.2 FastAPI Main Application Route Aliases
Several endpoints are registered as direct route decorators in `backend/app/main.py` rather than within their respective router modules:
1. `GET /api/track/{token}` (Line 348): Alias forwarding to `app.routers.dispatch.get_public_guardian_track`.
2. `GET /api/v1/patient/savings` (Line 354): Alias forwarding to `app.routers.pharmacy_orders.get_patient_generic_savings`.
3. `GET /api/communications/notifications` (Line 360): Direct binding to `NotificationEngine.get_user_notifications`.
4. `POST /api/communications/notifications/read-all` (Line 375): Direct binding to `NotificationEngine.mark_all_read`.

---

## 3. Mocked & Stubbed Subsystems (Not Production Ready)

| Subsystem | File Location | Nature of Mock / Stub | Production Risk |
| :--- | :--- | :--- | :--- |
| **National Health Claims (NHCX)** | `backend/app/services/nhcx.py` | Hardcoded method `check_eligibility`: Returns active "Star Health Insurance (AB-PMJAY), Rs 5,00,000" policy for any string $\ge 5$ characters. | Insurance claim submissions will simulate approval without ever interacting with real insurance TPAs or IRDAI sandbox. |
| **Ayushman Bharat Digital Mission (ABDM)** | `backend/app/services/abdm.py` | Methods return synthetic sandbox dictionaries and fake ABHA IDs. | No live NDHM cryptographic certificates or gateway endpoints configured. |
| **Government Doctor Registry** | `backend/app/services/gov_registry.py` | `USE_MOCK_GOV_API=true` auto-approves any doctor/pharmacist credential $\ge 4$ characters. | Fraudulent providers can self-verify in staging and production if flag is active. |
| **Public Telemedicine Fallback** | `backend/app/routers/telemedicine.py` | Falls back to public `https://meet.jit.si/callmedex-{consultation_id}` without room passwords when `DAILY_API_KEY` is absent. | Critical HIPAA/DISHA privacy leak if deployed without Daily.co API key. |

---

## 4. Code Duplication & Consolidation Recommendations

1. **Purge Dead Services**:
   - Safely delete `backend/app/services/fraud_scoring.py` (unreferenced).
   - Remove unused import `from app.services.dispatch import DispatchService` in `backend/app/routers/dispatch.py` and retire `backend/app/services/dispatch.py`.
2. **Move Root Scripts to `scripts/`**:
   - Relocate `analyze_fks.py`, `check_tables.py`, `create_admins.py`, and `scratch_*` to a dedicated `backend/scripts/` directory to clean up the repository root.
   - Delete `WhatsApp Image 2026-07-29 at 5.07.48 PM.jpeg`.
3. **Consolidate Notification Endpoints**:
   - Move the direct notifications routes in `backend/app/main.py` into `backend/app/routers/communications.py` to maintain router modularity.
