# Plan: Phlebo & Patient production readiness — camera chain-of-custody, stock, incentives, walk-in booking, PC/admin ops

## Context

Scouting (4 parallel explorers, 2026-07-29) established: the sample lifecycle backend is COMPLETE (samples, sample_events, handovers, PC 5-point verify, batches, report upload + patient notify), but every "scan" is a text input — no camera anywhere. Org-added services write `organization_services` while the marketplace reads `provider_services` (invisible to patients). PC centres sit at `onboarding` with no admin UI to activate them. Incentive tables exist but no code writes to them. No phlebo stock tracking exists. Imaging catalog entries are mis-categorized as `lab_test`.

User goal: patient blood-test booking + phlebo workflows production-ready for live testing, nothing dummy, working like DoctorC (camera tube scanning, barcode-linked reports, upsell incentives) plus CallMedex features (kit stock tracking).

## Global Constraints

- **Next.js 16.2.10** — read `frontend/node_modules/next/dist/docs/` before any non-trivial Next API. Plain `'use client'` + hooks + fetch are fine.
- **ui-lint gated files** (frontend/ui-lint.config.json): phlebotomist/page.tsx, nurse/page.tsx, supervisor/page.tsx, ProviderDispatchTracker.tsx, PhleboWalletPanel.tsx, AttendanceCard.tsx, DashboardProfile.tsx, DutyBar/OffDutyPanel/ActiveTaskPanel/TaskListPanel/TaskNotes/SelfieModal/LabHandoverModal/VitalsModal, NurseToolsModal, PhlebotomistToolsModal, serviceLabel.ts. **Any edit inside a gated file must use CSS classes (add to globals.css), lucide `<Icon>` glyphs, NO inline styles / hex literals / emoji.** New components NOT in the config may use the site's inline-style idiom — do not add them to the config.
- **NO new npm dependencies.** Camera scanning uses the native `BarcodeDetector` API + `getUserMedia` with a manual-entry fallback (Chrome/Edge/Android cover the target devices; unsupported browsers get the fallback).
- **Backend tests must stay green:** `cd backend && python -m pytest tests/ -q` (259 at baseline). New backend logic (stock decrement, incentive accrual/credit, barcode lookup scoping, PC report auth) REQUIRES new tests in backend/tests/ using the existing fake-supabase pattern (see tests/test_booking_home_collection_wiring.py).
- **Frontend verify:** `cd frontend && npm run build` — the FULL chain (lint:ui && test:unit && next build) must be green. It is green at baseline; keep it green.
- **SQL migrations** the user must paste in Supabase go in `database/` as idempotent files; say so in the report. Do NOT modify the 3 already-applied migrations (provider_directory_district, processing_center_area_districts).
- Partner-blind rule stands for BLOOD tests (home collection, CallMedex rate). Walk-in/imaging tests are Tier B per CLAUDE.md §7: patient SEES and SELECTS the diagnostic centre — that is the intended design, not a leak.
- Do not touch `openrouter_proxy.py`, `run-claude.ps1`, `.claude/`, `ui errors/`, `fixex_needed/`.

---

## Task 1: Camera barcode scanner component (foundation)

**NEW `frontend/src/components/BarcodeScannerModal.tsx`** (not gated — inline-style idiom OK):

- Props: `{ open: boolean; onClose: () => void; onScan: (code: string) => void; title?: string }`.
- When open: request `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })`, render the stream in a `<video>`, run `BarcodeDetector` (formats: code_128, code_39, ean_13, ean_8, qr_code, datamatrix if supported) on a ~300ms interval; on first successful decode call `onScan(code)` and close.
- Feature-detect: if `window.BarcodeDetector` is undefined or permission denied, show a manual-entry fallback INSIDE the modal (input + "Use this code" button) — never a dead end.
- Show a viewfinder frame overlay + "Point at the tube barcode" hint; stop all tracks on close/unmount (cleanup in useEffect return).
- Reusable by phlebo and PC dashboards. Style consistent with existing modals (dark overlay, centered white card, navy accents).

**Verify:** `npm run build` green; component compiles; BarcodeDetector types declared locally (`declare global` shim — TS DOM lib may lack it).

---

## Task 2: Phlebo tube registration via camera scan

**Files:** `frontend/src/app/(app)/dashboard/components/DoorstepScanPanel.tsx` (not gated), `frontend/src/app/(app)/dashboard/components/SampleCollectionPanel.tsx` (NOT gated per config — verify before editing), `backend/app/routers/phlebo_doorstep.py`, `backend/tests/` new test.

Backend:
- Extend `POST /api/phlebo/scan-tube` (phlebo_doorstep.py:171) request model with optional `scanned_barcode: str`. When provided and the sample's `barcode` is NULL, write it to `samples.barcode` + log `sample_events` ("barcode_bound"). If barcode already set and DIFFERENT from scanned, return a warning flag in the response (do not overwrite) so the UI can warn of a possible tube swap. Keep the existing tube-type match/mismatch behavior unchanged.
- New test: barcode bound on first scan; second different scan warns and does not overwrite; tube-type match still enforced.

Frontend (DoorstepScanPanel):
- Add a "Scan barcode" button (camera icon) next to the tube-type input per expected tube. Opens BarcodeScannerModal. On scan: call scan-tube with BOTH the scanned barcode and the tube type code flow as today (the barcode is bound; tube-type validation still uses the existing code entry — if the physical tube label ALSO encodes type, that's future work; for now barcode == the sample's unique ID).
- After a successful bind, show the bound barcode on the sample row (mono font) with a check badge.

Frontend (SampleCollectionPanel):
- Next to the barcode text input ("Scan or leave blank"), add a camera button opening BarcodeScannerModal; scanned value fills the input. No other change.

**Verify:** build green; new backend test passes; existing 259 pass.

---

## Task 3: PC intake barcode verify + PC results upload

**Files:** `backend/app/routers/pc_operations.py`, `backend/app/routers/samples.py` (report endpoint role check), `backend/app/services/samples.py`, `frontend/src/app/(app)/dashboard/components/PCIntakePanel.tsx`, `frontend/src/app/(app)/dashboard/components/PCBatchPanel.tsx` (results action), new backend test.

Backend:
- NEW `GET /api/pc/samples/by-barcode/{barcode}` (pc_operations.py): PC-auth scoped; returns the sample ONLY if `processing_center_id` == caller's centre; 404 otherwise (no cross-centre leakage). Include id, barcode, status, test_names, tube_type_code, expected_tube_type_code, patient name (join users), booking_id.
- PC results upload: extend the existing `POST /api/samples/{id}/report` (samples.py:273) role gate to ALSO allow role `processing_center` when the sample's `processing_center_id` matches the caller's centre (resolve via pc_auth.get_current_pc_staff). Reuse `SampleService.upload_report` unchanged. Sets report_status/report_url, status report_ready, patient notification (already in the service).
- Tests: by-barcode scoping (own centre 200, other centre 404); PC report upload allowed for own sample, forbidden for other centre's sample, patient notification fired.

Frontend (PCIntakePanel):
- Add camera scan (BarcodeScannerModal) beside the barcode text input. On scan: FIRST try the server lookup `by-barcode`; if found, select that sample and AUTO-CHECK the `barcode_match` box (verified by server resolution, not manual judgment — show "Verified by scan ✓" hint); fall back to the existing client-side match + manual checkbox if the server 404s.

Frontend (PCBatchPanel or Intake sample rows):
- For samples with status `verified`/`batched`/`sent_to_lab` and no `report_url`: an "Upload result" action — small inline form (report URL input + submit to the report endpoint). After success, show "Report sent to patient" state. Keep it inside the existing panel structure (these panels are NOT gated — check config before assuming; inline styles OK if not gated).

**Verify:** build green; new tests pass; 259 baseline green.

---

## Task 4: Patient "My Reports" inbox

**Files:** `backend/app/routers/patient_samples.py`, `frontend/src/app/(app)/dashboard/patient/reports/page.tsx`, backend test.

Backend:
- Extend `GET /api/patient/my-samples` (patient_samples.py:49) to include per-sample: `barcode`, `test_names`, `status`, `report_url`, `report_status`, `report_uploaded_at`, `collected_at` (only what exists in the samples row — no schema change). Patient-scoped already.
- Test: response includes report fields for a sample with report_url; other patients' samples never leak.

Frontend (patient reports page):
- NEW section ABOVE the existing AI upload tool: "Your CallMedex lab results". Fetch `/api/patient/my-samples`; list every sample with `report_url` as a card: test names, barcode (mono), report date, status pill, and a prominent "View / Download report" link (opens report_url in new tab). Samples without reports yet show in a collapsed "In progress" strip with their rail stage (barcode + status) — the patient sees the barcode their tube carries, matching the chain-of-custody story.
- Keep the AI upload tool below, visually separated ("Have an external report? Let AI explain it").

**Verify:** build green; new backend test passes.

---

## Task 5: Phlebo kit & stock tracking (DoctorC "Current Equipment" model)

**Reference (fixex_needed image):** DoctorC's kit list tracks tubes AND consumables — Plain(Red), EDTA K2(Lavender), Fluoride(Grey), Sodium Citrate(Light Blue), Sodium Citrate 3.8%(Black), Urine Container, Needle, Alcohol Swabs, Injection Plaster, Gloves, Syringe 2.5/5ml, Sterillium — each with an in-hand count.

**Files:** `database/phlebo_stock.sql` (NEW migration — user pastes in Supabase), `backend/app/routers/phlebo_stock.py` (NEW router) + `backend/app/main.py` (register), `backend/app/routers/phlebo_doorstep.py` (hook Task 2's `_bind_barcode`), `backend/app/routers/samples.py` (collect path), `frontend/src/app/(app)/dashboard/phlebotomist/page.tsx` (GATED — classes only), `frontend/src/app/(app)/dashboard/components/PhleboStockPanel.tsx` (NEW, not gated), `frontend/src/app/globals.css` (`.stock-*` classes), backend tests.

Migration `database/phlebo_stock.sql` (idempotent):
```sql
CREATE TABLE IF NOT EXISTS kit_items (
    code TEXT PRIMARY KEY,            -- 'edta_lavender', 'needle', 'gloves_large'…
    name TEXT NOT NULL,               -- display name
    category TEXT NOT NULL CHECK (category IN ('tube','container','consumable')),
    cap_colour TEXT DEFAULT '',       -- tubes/containers only
    decrement_event TEXT NOT NULL DEFAULT 'never'
      CHECK (decrement_event IN ('per_tube','per_collection','never')),
    is_active BOOLEAN DEFAULT true
);
-- Seed: the 5 tube_types (mirror their codes/names/colours, per_tube),
-- urine_container (container, per_collection), needle, alcohol_swabs,
-- injection_plaster, gloves_large, syringe_2_5ml, syringe_5ml,
-- sterillium_small (consumable, per_collection each).

CREATE TABLE IF NOT EXISTS phlebo_stock (
    phlebotomist_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_code TEXT NOT NULL REFERENCES kit_items(code),
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (phlebotomist_user_id, item_code)
);
-- Enable RLS consistent with repo posture.
```

Backend (`/api/phlebo/stock` in new phlebo_stock.py):
- `GET /api/phlebo/stock` — phlebo-auth; ALL active kit_items LEFT JOIN own stock (missing row = 0), plus `used_today` per item (per_tube: samples collected today with that tube_type_code; per_collection: samples collected today count).
- `POST /api/phlebo/stock` — `{item_code, quantity}` upsert own row only.
- Auto-decrement (best-effort, clamp at 0, never block collection): per_tube items decrement in Task 2's `_bind_barcode` path AND `POST /api/samples/collect`; per_collection items decrement once per sample registered in either path.
- Tests: seed integrity helper (items exist), upsert own, cannot write others', per_tube decrement on bind, per_collection decrement once per sample, clamp at 0, used_today math.

Frontend (PhleboStockPanel, "Kit & Stock" tab between "Samples & Handover" and "Wallet" in the GATED phlebotomist/page.tsx — globals.css `.stock-*` classes only, icon from the icons module e.g. Package):
- DoctorC layout: per item — colour dot (cap_colour) for tubes/containers, name, big in-hand count; "used today" muted; inline number input + Save (POST). Low-stock (<=5) highlighted via class modifier. Group by category: Tubes & Containers, then Consumables. One-line explainer: "Counts auto-decrement as you collect."

**Verify:** migration idempotent; FULL build green (lint gate!); new backend tests pass.

---

## Task 6: Doorstep add-test incentives (wire the skeleton)

**Files:** `backend/app/routers/phlebo_doorstep.py` (doorstep_addon), `backend/app/services/samples.py` (_credit_for_accepted), `backend/app/services/wallet.py` (read-only use), `frontend/src/app/(app)/dashboard/components/PhleboWalletPanel.tsx` (GATED), backend tests.

Backend:
- In `POST /api/phlebo/doorstep-addon` (phlebo_doorstep.py:263): after creating the `booking_tests` row, look up the matching `incentive_rules` row (service_kind package → `PHLEBO_UPSELL_PKG`, else `PHLEBO_UPSELL_SVC`; both 5%) and insert `incentive_ledger` (phlebotomist_user_id, booking_test_id, rule_code, amount = round(price_charged * pct, 2), status 'pending'). Read the actual incentive_ledger columns from database/phase1_sample_lifecycle.sql:199-245 FIRST and insert exactly those.
- In `SampleService._credit_for_accepted` (services/samples.py:572-612): after the per-collection credit, also settle any `pending` incentive_ledger rows whose booking_test's sample got accepted — mark `credited` + `WalletService.credit(reason="incentive", amount=...)` with linkage metadata. Full-time phlebos (rate 0) still earn upsell incentives (they're sales incentives, not collection pay) — unless incentive_rules say otherwise; follow the rule row.
- Tests: addon creates pending incentive at 5% of price; acceptance credits wallet with reason incentive and flips status; no double-credit on re-accept (idempotent).

Frontend (PhleboWalletPanel — GATED):
- The ledger already labels reason "incentive" (verify). Add a small "Upsell incentives earned (this month)" stat next to existing stats, from the existing `/api/samples/wallet` summary IF it already breaks out incentives — if not, extend `WalletService.get_summary` minimally to include `incentive_month` total and display it. Classes only, no inline styles.

**Verify:** new tests pass; 259 green; FULL build green.

---

## Task 7: Book a Test — layout fix + two-model display + catalog recategorization

**Files:** `frontend/src/app/(public)/diagnostics/page.tsx`, `database/catalog_imaging_recategorize.sql` (NEW migration), `frontend/src/data/lab-test-prices.json` (read-only use), backend marketplace router (read-only use of /offers).

1. **Layout:** restructure the search area so nothing squeezes: search input on its own row (full width of the 780px container), StateDistrictPicker on the next row (selects each flex:1 minWidth:140 + detect button, no wrap). Keep filters row below. This kills the 257px-wrap bug found in scouting.
2. **Two-model result display:**
   - When the selected/browsed test is category `lab_test` (blood): keep the partner-blind fulfilment card (home collection, CallMedex rate) — but ALSO cross-check `frontend/src/data/lab-test-prices.json` by name (case-insensitive exact, then normalized contains); when the fixed rate card has the test, show its MRP-struck → offer price as "CallMedex fixed rate" (fallback to API fulfilment price when absent). Blood tests are ALWAYS home-collection framing.
   - When the test is walk-in (imaging / walk_in_required): BELOW the heading, fetch `GET /api/marketplace/offers?catalog_id=<id>&city=<district>` and render "Available at these verified centres" — one row per offer: provider_name, city, price (with MRP strike when savings > 0), rating when present. Each row's Book button → `/booking?type=lab&org=<provider_user_id>&service=<catalog_id>`. When zero offers: "No partner centre has listed this test in your district yet — we'll notify you as centres onboard."
3. **Frequently booked:** when every popular item has provider_count 0, replace the grid with a curated common-tests list (CBC, HbA1c, Thyroid Profile, Lipid Profile, Vitamin D, Vitamin B12, KFT, LFT, Fasting Blood Sugar, Urine Routine, ECG, Chest X-Ray) resolved from the search API by name — same card UI.
4. **Migration `database/catalog_imaging_recategorize.sql`:** idempotent UPDATE on service_catalog setting category='imaging' where UPPER(name) matches imaging patterns (starts with 'MRI', 'CT ', 'X-RAY', 'XRAY', 'USG', 'ULTRASOUND', 'ECG', 'ECHO', 'DEXA', 'MAMMOGRAPHY', 'SONOGRAPHY', 'DOPPLER', 'TMT', 'HOLTER', 'PFT', 'AUDIOMETRY', 'BMD', 'PET-CT', 'TIFFA', 'NT SCAN', 'ANOMALY') and category='lab_test'. Report expected row counts per pattern in comments.

**Verify:** build green; layout verified at 1280px (no wrap); blood test shows fixed-rate strike-through; MRI search shows centre list when offers exist, honest empty state otherwise; migration file idempotent.

---

## Task 8: Walk-in centre booking + org services marketplace wiring

**Files:** `backend/app/routers/provider_management.py` (org services write path ~791-836), `backend/app/services/marketplace.py` (read-only), `frontend/src/app/(app)/booking/page.tsx`, `backend/app/routers/marketplace.py` (read), backend tests.

Backend (the disconnect fix):
- `POST /api/providers/org/services` currently inserts into `organization_services`. ADD a best-effort dual-write into `provider_services`: match `service_catalog` by normalized name (exact slug match on slugified name, else ilike name); when matched, upsert `provider_services (provider_user_id, catalog_id, base_price, is_active true, home_service_enabled false)` — on conflict (provider_user_id, catalog_id) update base_price. Never fail the main write if catalog matching misses (log + skip — unmatched custom services stay org-local). Look at provider_services actual columns in database/*.sql FIRST and insert exactly those (include mrp if the column exists; derive mrp = base_price when the org didn't give one).
- Tests: org adds "MRI Brain" price 4500 → provider_services row exists with catalog link; marketplace find_offers for that catalog now returns the org; price update re-writes base_price; unmatched service name skips dual-write without failing.

Frontend (booking page):
- Accept `?type=lab&org=<provider_user_id>&service=<catalog_id>` (deep link from the new centre list): when `type=lab` AND `orgParam` present, set bookingType "lab", set selectedOrg to the org (fetch name via `/api/providers/search/organizations?q=` or the catalog endpoint — pick the lightest existing call), go to step 2 but show THAT centre's catalog (`GET /api/providers/{id}/catalog` — services + packages) as the test list instead of the hardcoded DEFAULT_DIAGNOSTIC_TESTS. Pre-check the deep-linked service when present.
- Date step for lab-with-org: show the org's real slots via the existing getDynamicSlots(selectedOrg.timings) path (org-services endpoint already returns timings) and let the patient pick a time — this is the Tier B slot booking. The booking POST then includes provider_id = org, slot_id from the chosen slot (standard confirmed flow — NOT the partner-blind PENDING_REVIEW path). Keep partner-blind PENDING_REVIEW flow for lab WITHOUT org.
- This also fixes the user's "no slots, no further process" complaint: with a centre chosen, slots render; without one, the blue "centre assigns slot" banner path stays as-is.

**Verify:** new backend tests pass; 259 green; build green; manual trace documented in report: MRI search → centre row → booking step 2 (centre's tests) → date+slot → confirm → success screen.

---

## Task 9: Admin "Processing Centres" tab

**Files:** `frontend/src/app/(app)/dashboard/admin/page.tsx` (933 lines — check gating; NOT in ui-lint config at baseline → inline-style idiom OK), `backend/app/routers/admin.py` (reuse), `backend/app/routers/processing_center_admin.py` (reuse; extend ONLY if lookup missing), backend test for any new endpoint.

- New tab "Processing Centres" in the admin dashboard (add to the tab bar): 
  - Centres table: code, name, city, status badge, staff count, areas. Data: `GET /api/admin/processing-centers` (exists).
  - "New centre" form: code, name, city, state, address, pincode, daily_capacity → POST (exists). 
  - Per-centre actions: **Activate / Pause** (PATCH status active/paused — exists), "Add staff" (email input → find user via `GET /api/admin/users` with a search param — if the existing endpoint can't filter by email/q, ADD `q` support to it minimally with a test — then POST staff with that user_id), "Add area" (city, pincode, radius_km → POST areas, exists).
  - A one-line explainer at the top so the ops model is never a mystery again: "Centres are created by CallMedex (no self-signup). Create → Activate → Add staff → Add areas. Active centres receive bookings automatically by pincode/city/district/radius."
- This directly answers "where is the PC dashboard, who assigns, how do they register": the seeded HYD-01/VSP-01 will appear here and can be activated.

**Verify:** build green; if `/api/admin/users` gained `q`, new test passes; admin page renders the tab (typecheck).

---

## Task 10: Phlebo "My Performance" scorecard + availability self-service (DoctorC profile model)

**Reference (fixex_needed images):** DoctorC's profile shows — Slots Completed (month), Rating, Incentives +₹, Fines −₹, Cancellation %, Late Appts %, plus "Manage my Work" (slot schedule, leaves, week-off). NOTHING may be dummy: every number must come from real tables, or the tile is omitted.

**Files:** `backend/app/routers/phlebo_stock.py` or a new small `backend/app/routers/phlebo_stats.py` (implementer's call — one new router for stats is cleaner), `backend/app/main.py`, `backend/app/routers/roster.py` (self-service availability — read it first: PCRosterPanel marks phlebo availability PC-side; give the PHLEBO the ability to mark THEIR OWN available/unavailable/leave for upcoming dates via the same roster table, own rows only), `frontend/src/app/(app)/dashboard/components/PhleboPerformancePanel.tsx` (NEW, not gated), `frontend/src/app/(app)/dashboard/phlebotomist/page.tsx` (GATED — classes only; panel goes on the Profile tab ABOVE DashboardProfile), `frontend/src/app/globals.css`, backend tests.

Backend:
- `GET /api/phlebo/performance` — phlebo-auth, current calendar month, computed from REAL data only:
  - `slots_completed`: dispatch_requests assigned to this phlebo with completed status this month (check dispatch_requests actual columns first).
  - `cancellation_pct`: cancelled / (completed + cancelled) this month, 1 decimal; null when no jobs (render "—").
  - `late_pct`: jobs where actual arrival/start exceeded scheduled time beyond a 15-min grace IF the timestamps exist in the schema; if the schema cannot answer this, OMIT the field entirely (no fake number).
  - `incentives_month`: sum of wallet_transactions reason='incentive' this month (Task 6 wires these).
  - `fines_month`: sum of wallet_transactions reason IN ('fine','penalty','hold') this month IF such reasons exist in VALID_REASONS and any rows exist; else 0 (the ledger is the source of truth — 0 is honest).
  - `rating`: only if a real ratings source for phlebotomists exists (check phlebotomists table + any reviews/ratings tables); else omit.
- `POST /api/phlebo/availability` — `{date, status: 'available'|'unavailable'|'leave'}` upsert OWN roster row for a future/today date only (no past edits). If roster.py already exposes a phlebo-self endpoint, reuse it and say so in the report instead of adding a new one.
- Tests: performance math on seeded dispatch rows (completed/cancel counts), month boundary (last month's jobs excluded), fines sum, availability upsert own-only, past date rejected.

Frontend (PhleboPerformancePanel on the Profile tab):
- Scorecard grid (`.perf-*` classes in globals.css — gated page): Slots Completed (count), Incentives (+₹ green), Fines (−₹ red), Cancellation %, Late % (render "—" when null), Rating (only when backend returns it). Month label ("This month — July 2026").
- "My availability" strip: next 7 days, each a toggle Available/Leave hitting POST /api/phlebo/availability; PC roster overrides are still possible (note in one line: "Your processing centre can override for staffing").
- Icons from the icons module (no emoji — gated page).

**Verify:** new tests pass; 259+ green; FULL build green (lint gate!); every tile traces to a real query — the report must list each tile → its SQL/table.

---

## Execution order

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → final whole-branch review.
Migrations for the user to paste after merge: `database/phlebo_stock.sql` (T5), `database/catalog_imaging_recategorize.sql` (T7).
