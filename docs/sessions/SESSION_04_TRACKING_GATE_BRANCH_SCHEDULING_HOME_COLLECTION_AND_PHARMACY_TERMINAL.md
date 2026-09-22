# Session 04: Tracking Gate, Branch-Accurate Scheduling, Home-Collection Window & Pharmacy Terminal

- **Session**: 04
- **Date**: 2026-09-22
- **Scope**: Phantom "Live collection tracking" on the patient dashboard; organisation doctor-schedule save crash; doctor ↔ organisation branch linking; branch-accurate walk-in doctors and slots; 6:00–11:00 AM home-collection window and phlebotomist assignment; removal of fabricated data (NRI doctors, walk-in centres, invoice, profile copy); navbar Health Packages link; full pharmacy terminal rebuild (backend + UI).
- **Author**: Claude Code (Opus 5) & Engineering Pair
- **Reference screenshots**: `images_ref/` (12 WhatsApp captures, 2026-09-22 15:59–16:23)
- **Status**: Uncommitted in working tree at time of writing. Backend suite 778 passed / 2 failed (both failures pre-exist on clean `HEAD`); frontend `tsc`, `lint:ui`, unit tests (36/36) and `next build` green.

---

## 1. Summary

| Area | Problem reported | What was done |
|---|---|---|
| Patient dashboard | 0 upcoming / 0 completed, yet "Live collection tracking" showed a collector approaching | Tracking now renders only for a dispatch linked to one of the patient's own open bookings; closed bookings close their dispatch; pre-assigned jobs show a "Collector assigned · date · time" card, never live GPS |
| Organisation → Edit doctor walk-in slots | "An internal error occurred" on save | Wrong column (`organizations.name`) fixed; shifts validated; only the org's real branches accepted; clashes with the doctor's other clinics refused; insert-then-retire save |
| Doctor → Slots & Availability → Clinic branch | Had to type branch name manually; two invented default branches | Linked organisations' real branches load automatically (`GET /api/providers/my-linked-branches`); invented localStorage branches removed; "My own clinic" kept for private practice |
| Patient → Consultation → walk-in branch | Branch with no doctors still offered time slots | Only doctors with hours at that exact branch are listed, with their real days/times; empty branch says "No doctors are available for this branch" and cannot be booked |
| Book a Test | "Central Processing Lab" / "NABL Compliant Standards" badges; 5:30 AM window | Badges removed, heading aligned; window 6:00–11:00 AM across diagnostics, booking wizard, packages, home-services and phlebotomist widget; enforced server-side |
| Home collection / health packages | Assign a full-time phlebotomist at the chosen slot | Shared roster picker: full-time first, nearest, least loaded, not on leave, not double-booked at that slot |
| NRI consultation | Fake doctor details | 7 hardcoded "showcase" doctors removed; real doctors show real fee, licence and online availability |
| Navbar | Health Packages visible to every role | Shown only to patients and signed-out visitors (desktop + mobile) |
| Pharmacy terminal | Multi-colour overview, poor Orders tab, no proper import, misaligned profile | Rebuilt Overview / Orders / Inventory / Profile in the premium design system; CSV/Excel import with review + sample templates; backend fixed (see 2.8) |

---

## 2. Bugs found and fixed (root causes)

### 2.1 Phantom live tracking (confirmed in live data)
- Advance home-collection jobs are created as `dispatch_requests.status = provider_accepted`, `assignment_mode = advance` at booking time, while the booking stays `confirmed`.
- `auto_expire_stale_bookings` cancelled the past-date booking but only cancelled dispatches in `searching` / `provider_notified`, so the pre-assigned job stayed "active" forever.
- The patient dashboard rendered tracking for any `activeDispatchId` in localStorage whose row was active — so L S NAIDU (booking 2026-09-10, auto-cancelled) watched collector R VENKATA RAMANA MURTHY for 12 days.
- Fixes:
  - `bookings.auto_expire_stale_bookings` now also cancels `provider_accepted` dispatches of expired bookings.
  - `dispatch_engine.get_live_tracking` reads the linked booking: closed booking (`cancelled/completed/slot_rejected/no_show`) or an advance job for a past day → reports `cancelled` with `closed_reason: booking_closed`. Existing stale rows are therefore harmless without a data migration.
  - Pre-travel advance jobs return the collector's name only — no live position, distance or ETA (privacy).
  - Response gains `assignment_mode`, `scheduled_for`, `slot_time`.
  - Patient dashboard: shared `isLiveBooking()` drives both the Upcoming count and the tracking gate; 403/404 from `/track` clears the stored id (stops polling another account's dispatch); the on-demand request refreshes bookings so its card can render.
- Two stale rows remain in the DB (L S NAIDU, yaswanth); they no longer surface anywhere. Not modified — can be cancelled on request.

### 2.2 Organisation schedule save → 500
`update_org_doctor_schedule` selected `organizations.name`; the column is `organization_name`. PostgREST rejected the query and the security middleware returned "An internal error occurred". Also fixed in the same endpoint:
- HH:MM and start < end validated per shift; at least one day required.
- `branch_id` must be an active `provider_branches` row owned by the organisation (400 otherwise).
- Overlaps inside the payload (400) and with the doctor's walk-in hours at other clinics (409) refused.
- Old code deleted with an `or_(... location_name.ilike.%name%)` filter (breaks on names with commas/parentheses, could hit other orgs) and then inserted regardless of failure → duplicates. Now: insert new rows, then delete the org's previous rows by id; on failure the new rows are rolled back.
- Removed doctors (`is_active = false`) cannot be scheduled.

### 2.3 Branch identity was never stored consistently
Three writers disagreed: the org modal put the branch UUID in `template_group_id`; the doctor shift builder put a random group UUID there with only a free-text `location_name`; old rows had only a name. Every reader treated `template_group_id` as the branch id, so doctor-published shifts matched no branch. New shared resolver `app/services/doctor_branches.py` (`resolve_branch`, `doctor_branch_shifts`) — used by `search_organizations`, `/bookings/org-services/{id}`, `/org/doctors`, `/slots` and both save paths:
1. row belongs to another organisation → excluded;
2. `template_group_id` equals a branch id → that branch;
3. `location_name` equals / contains a branch name (longest wins) → that branch;
4. `organization_id` is this org, or name contains the org name → main facility;
5. otherwise → not at this org (doctor's own clinic).

No schema change. Verified on live data: Dr LATCHIREDDI SA NAIDU resolves to Main Facility Mon–Sat 09:00–12:00 & 17:00–19:00; Maharanipeta has no shifts (the org's saves had been crashing), so patients see "No doctors are available for this branch".

### 2.4 Walk-in slots at the main facility leaked every shift
The frontend never sent `branch_id=main`, so the main facility received every in-person shift the doctor had anywhere. `/api/providers/slots` gains `org_id`; with it, only shifts resolving to the requested branch (default `main`) generate slots.

### 2.5 Booked slots always reported free
`/slots` looked up `bookings.booking_date` / `slot_time`, which `create_booking` never writes. Now reads `slot_id` (`provider|date|HH:MM`) / `slot_start` for the doctor's ids, excluding cancelled / slot-rejected.

### 2.6 Doctor shift publish wiped other branches
`replace_existing` deleted every row for the day + mode. Now scoped to the same place (same org branch, or same own-clinic name); overlaps with hours at another clinic return 409; insert-then-retire. Accepts `organization_id` + `branch_id` (link verified, branch must belong to the org; name/address taken from the DB).

### 2.7 Home-collection assignment
- Inline picker in `create_booking` took the first full-time row with no distance, load or slot check, fell back to collectors **on leave**, and when nobody existed inserted a collector-less `pending_provider_acceptance` row — which blocked the same-day live-offer fallback forever (`scheduled_dispatch` skips bookings that already have a dispatch row).
- New `roster.pick_advance_collector`: full-time within 25 km first, then part-time within 15 km; nearest then least-loaded that day; excludes leave/unavailable and anyone already holding a job at the same slot time; city fallback when no processing centre. No candidate → no row, so the evening roster pass / same-day live offer still applies.
- `run_roster_pass` and `decline_job` use the same busy-at-slot exclusion; roster inserts carry `service_subtype`.
- Server enforces `HOME_COLLECTION_WINDOW = ("06:00", "11:00")` for scheduled home collections (422 outside it; `on_demand|` / `reorder|` exempt).

### 2.8 Pharmacy backend
- `/api/pharmacy/orders/incoming` returned **every pharmacy's orders** (patient addresses, prescriptions) to any pharmacy login → scoped to the caller's `pharmacies.id`; admins see all; patient name/phone enriched.
- Status updates had no ownership check and accepted any value → ownership verified; allowed flow `pending→confirmed→preparing→out_for_delivery→delivered` (+ cancel before dispatch); 409 otherwise.
- Inventory endpoints wrote `price` / `description` / `is_prescription_required`, but the table has `sku (NOT NULL)`, `unit_price`, `generic_name`, `requires_prescription`, `batch_number`; errors were swallowed, so every "Item added" saved nothing. Now mapped to the real columns, SKU auto-generated when blank, errors surfaced; responses carry both spellings so the mobile app keeps working.
- Bulk import: batch inserts (500/chunk), upsert by SKU (or name when no SKU), duplicate rows in one sheet ignored, returns created/updated counts; max 5,000 rows.
- `PUT /api/providers/profile` for pharmacies now writes pharmacy columns (`pharmacy_name`, `pharmacist_in_charge`, `operating_hours`, `home_delivery`, `available_24x7`, `service_radius_km`); licence / drug licence / GST stay verification-bound (not editable).

### 2.9 Fabricated data removed
- `SHOWCASE_NRI_DOCTORS` (7 invented doctors with licence numbers and stock photos) and their presentation branch; real NRI doctors no longer default to "International Medical Board", 800/1200 fees or `available: true` — availability requires published online hours and a tariff.
- Diagnostics walk-in tab: invented 4.9 rating, hours, equipment list and `FALLBACK_CENTERS` removed.
- Pharmacy invoice: hardcoded GSTIN / registration, Rs 120 per line and Rs 268.80 total removed; prints real pharmacy details, items and `total_cost` (or "To be confirmed at billing"); all values HTML-escaped.
- Profile: the "Professional Presentation & Fee Justification" card now shows only for practitioners, and empty bio / fee text says "Not added yet" instead of invented doctor copy.

### 2.10 Pre-existing test failures fixed along the way
- `get_available_slots` called directly received truthy `Query(None)` defaults for `mode` / `branch_id`, emptying results → params normalised.
- `test_org_branches` hardcoded 2026-09-21 (now in the past) → computes next Monday.
- Slot test fake returned the non-existent `slot_time` shape → now `slot_start`.

---

## 3. Implementation details

### 3.1 Patient dashboard (`dashboard/patient/page.tsx`, `components/PhlebotomistRadar.tsx`)
- `todayInIST`, `isLiveBooking`, `TRACKABLE_DISPATCH` module helpers; `trackingLive` / `trackingScheduled` computed once and used by both the radar and the large tracker panel.
- Radar `scheduled` prop: "Collector assigned", visit date/time chip, "Live tracking starts when your collector sets out".

### 3.2 Booking wizard (`(app)/booking/page.tsx`)
- `HOME_COLLECTION_SLOTS` 06:00–11:00.
- Doctor slots: `null` = loading, `[]` = none; no facility/generic fallback; distinct error vs "no open slots at <branch>" messages; `org_id` + `branch_id` sent.
- Step 3 (walk-in): doctors filtered by `assigned_branches`, per-branch shift summary, "General OPD" removed, Continue disabled until a doctor at that branch is chosen.

### 3.3 Consultation branch modal (`(public)/consultation/page.tsx`)
Doctors must have hours at the branch; real "Mon, Tue · 13:30 – 17:00" summaries; "No doctors are available for this branch."; CTA disabled when empty.

### 3.4 Doctor schedule (`components/ProviderSchedulePanel.tsx`)
`LinkedBranch` chips from `my-linked-branches`, "My own clinic" with previous own-clinic suggestions, shared `renderPlacePicker` for shift builder and single block; publishes `organization_id` / `branch_id`. Used by doctor, dietitian and physiotherapist dashboards (non-doctors have no links → own clinic). Remains on the `lint:ui` allowlist.

### 3.5 Organisation dashboard (`dashboard/organization/page.tsx`)
Schedule modal loads `walkin_availability` (this org only, with resolved `branch_id`); duplicate main-facility option removed; doctor card lists this org's shifts with branch label.

### 3.6 Pharmacy terminal (`dashboard/pharmacy/page.tsx`, `.cm-pharm-*` in `foundation.css`)
- Overview: single-accent KPI row (New orders, Packing, Out for delivery, Low stock ≤10) + "Orders needing action" and "Low stock" panels with one-click next step / Restock.
- Orders: status filter with counts, search, table (order, patient + phone + address, items, prescription, status pill, next-step / cancel / invoice).
- Inventory: Add/Edit modal, search, table (name, generic, SKU, category, batch, MRP, stock with low/out colouring, Rx/OTC), Import CSV/Excel ≤5 MB with review modal, Sample Excel (.xlsx) and Sample CSV templates (fuzzy header matching: name/MRP/stock required; generic, category, batch, SKU, Rx optional).
- Profile (`components/DashboardProfile.tsx`): pharmacy name, pharmacist in charge, registration, drug licence, GST, hours, home delivery, radius, address; pharmacy-specific edit form.
- Page added to `ui-lint.config.json`; icons `Printer`, `Upload`, `FileSpreadsheet` added to `components/ui/icons.ts`.

### 3.7 Navbar (`components/SmartNavbar.tsx`)
Health Packages moved inside the patient/guest block (desktop and mobile menus).

---

## 4. Files changed

**Backend**
- `app/services/doctor_branches.py` (new)
- `app/routers/provider_management.py` — org schedule save, `/org/doctors`, `/slots`, `my-linked-branches`, shift publish, `search_organizations`, NRI, pharmacy profile
- `app/routers/bookings.py` — `org-services` branches, home-collection window, advance assignment, stale-expiry cascade
- `app/services/roster.py` — `pick_advance_collector`, busy-slot exclusion
- `app/services/dispatch_engine.py` — `get_live_tracking` booking gate
- `app/routers/pharmacy_orders.py` — order scoping/flow, inventory mapping, bulk import
- `app/models/schemas.py` — inventory models
- Tests: new `test_doctor_branches.py`, `test_pharmacy_terminal.py`, `test_tracking_booking_gate.py`; extended `test_org_doctor_walkin_op.py`, `test_doctor_workstation_fixes.py`; fixed `test_org_branches.py`, `test_therapy_booking_flow.py`

**Frontend**
- `(app)/dashboard/patient/page.tsx`, `components/PhlebotomistRadar.tsx`
- `(app)/booking/page.tsx`
- `(public)/consultation/page.tsx`, `(public)/diagnostics/page.tsx`, `(public)/home-services/page.tsx`, `(public)/nri-consultation/page.tsx`
- `components/ProviderSchedulePanel.tsx`, `components/DashboardProfile.tsx`, `components/AdvanceHomeCollectionsWidget.tsx`
- `dashboard/organization/page.tsx`, `dashboard/pharmacy/page.tsx`
- `components/SmartNavbar.tsx`, `components/ui/icons.ts`, `styles/foundation.css`, `ui-lint.config.json`

No database migrations.

---

## 5. Verification

- **Backend**: full suite 778 passed / 2 failed. Both failures (`test_send_rx_email_dispatches_successfully`, `test_my_jobs_enriches_patient_and_slot_time`) also fail on a clean `HEAD` worktree; baseline had 6 failures, 4 fixed this session.
- **Frontend**: `tsc --noEmit` clean; `lint:ui` clean across 21 files; unit tests 36/36; `npm run build` succeeds.
- **Live data (read-only)**: both stale advance dispatches now resolve to `cancelled / booking_closed` with no provider location exposed; `search_organizations` returns the correct branch mapping for VISAKHA MULTISPECIALITY CLINICS.
- **Browser (mocked API, no real accounts, no writes)**: pharmacy Overview / Orders / Inventory / Profile, doctor branch picker (linked branches, selection, own-clinic inputs) and diagnostics home tab checked by screenshot.
- Not exercised end-to-end with real accounts (Supabase intermittently returned Cloudflare 1101; avoided creating real bookings).

---

## 6. Known limitations / follow-ups

- Recommended manual pass: book a home collection, save a doctor's shifts from the organisation dashboard (including the Maharanipeta branch), import a pharmacy stock sheet.
- Two stale dispatch rows (L S NAIDU, yaswanth — 2026-09-10) remain in the DB; harmless now, can be cancelled on request.
- Pharmacy order matching (`PharmacyService.match_nearest_pharmacy`) still picks the first verified pharmacy rather than the nearest — pre-existing, out of scope.
- Area slot lock still allows one home collection per city per 30-minute slot (existing product rule).
- Doctor rows saved earlier with the old invented "Main Consultation OPD" default are treated as the doctor's own clinic, not an organisation branch.
- Mobile app untouched; it stays compatible (inventory responses keep legacy field names; tracking hides live GPS server-side).
