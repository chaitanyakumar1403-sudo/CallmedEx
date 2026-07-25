# CallMedex — Sample Lifecycle, Provider Economics & Test Marketplace

**Status:** Phase 1 (data foundation) implemented. Phases 2–8 pending.
**Date:** 2026-07-25

This plan covers nine feature areas requested together. They are sequenced so that
each phase is independently shippable and later phases depend only on earlier ones.

---

## Decisions taken (confirmed with owner)

| Decision | Choice |
|---|---|
| Phlebo ↔ diagnostic center | **One home lab, override per run.** Phlebo has a primary linked center; a sample may be routed elsewhere when the booking belongs to a different partner. |
| Urgent pricing | **Platform-wide surcharge**, configurable by admin (flat ₹ or %), applied on top of normal price. |
| Provider payout | **Wallet settlement (MOU Method 1) by default**, per-provider override to Confirmation Fee (Method 2). |
| Partner test discount | **Center sets MRP, platform sets discount %.** Patient sees struck-through MRP vs CallMedex price. |

---

## Commercial model extracted from the MOUs

Source: `mous/` (gitignored — local only).

**Phlebotomist — Part Time** (`PART TIME PHLEBO.docx`)
- ₹150 per *successfully completed and verified* collection.
- Credited to an in-app **wallet**; settled **monthly** to registered bank account.
- Cancelled / fake / incomplete / rejected collections are **not** payable.
- Must accept or reject a request within **10 minutes**.
- Live selfie with collection kit uploaded by **05:15** daily; failure ⇒ payment hold.
- Penalties and deductions are reflected *before* monthly settlement.

**Phlebotomist — Full Time** (`FULL TIME PHLEBO.docx`)
- Salaried employee; salary + incentives per employment agreement, **not** per-collection.
- Payment eligibility gated on attendance compliance, collection completion, documentation.
- Same 10-minute acceptance rule and 05:15 selfie rule.
- Responsible for samples from collection until handover to the processing center;
  handover only to **authorized personnel**.

**Doctors / Physiotherapists / Nursing — home, clinic, video**
(`Drs Physio and Nursing.docx`, `CALLMEDEX_Doctors_..._Modified.docx`)
- **20% platform fee** per service.
- *Method 1 — Wallet Settlement*: platform collects full amount, deducts 20%, credits 80%
  to provider wallet, monthly bank settlement after verification.
- *Method 2 — Confirmation Fee*: platform collects 20% at booking; provider collects the
  remaining 80% directly from the patient on completion.
- Rates go live only after mutual acceptance between CallMedex and the provider.

**Dental clinics / hospitals** (`CALLMEDEX_Dental_...docx`) — same 20% fee, same two methods.

Implication: `provider_settings.commission_pct` already defaults to 15.00 and must be
reconciled to **20.00** for these categories, and a `payout_model` column is required.

---

## Phase 1 — Data foundation ✅ IMPLEMENTED

`database/phase1_sample_lifecycle.sql`

### Sample chain of custody
Today the barcode is a **client-side fiction**: `PhlebotomistToolsModal.tsx` generates
`"VAM-" + Math.random()` and never persists it. Nothing links a physical tube to a booking.

- **`samples`** — one row per physical tube. Unique `barcode`, owning `booking_id`,
  collecting `phlebotomist_user_id`, `destination_org_user_id` (the home-lab override
  point), and a status walking
  `collected → in_transit → handover_requested → received → processing → report_ready`,
  plus terminal `rejected`.
- **`sample_events`** — append-only custody log. Every scan, handover, acceptance and
  rejection writes a row with actor, role, GPS and optional photo. This is the audit
  trail the MOUs require ("fully responsible from collection until delivery").
- **`sample_handovers`** — the batch a phlebo submits to a center. Center accepts or
  rejects *per sample*, so a partial handover is representable.

### Provider economics
- **`provider_wallets`** / **`wallet_transactions`** — double-entry-ish ledger. Every
  credit references the sample or booking that earned it, so a disputed collection can be
  reversed without recomputing a balance.
- **`incentive_rules`** / **`incentive_ledger`** — the phlebo upsell incentive
  ("if a phlebo gets the patient to add services, they earn"). Rules are data, not code,
  so commercial terms change without a deploy.
- **`attendance_logs`** — the 05:15 selfie gate. `is_late` is computed against the rule
  time; payment hold keys off this.
- `phlebotomists` gains `home_lab_org_user_id`, `per_collection_rate` (₹150 default for
  part-time), `monthly_salary`, `employment_type`.

### Urgent tier
- `bookings.priority` (`normal` | `urgent`) + `urgent_surcharge_applied`.
- `dispatch_requests.priority` so the dispatch board can sort and red-flag.
- **`platform_settings`** — key/value for the admin-tunable urgent surcharge.

### Marketplace pricing
- `provider_services` gains `mrp` (partner walk-in price) and `urgent_available`.
- `provider_settings` gains `partner_discount_pct` and `payout_model`.
- **`service_catalog`** — canonical test names + synonyms so "MRI" matches
  "Magnetic Resonance Imaging" and "MRI Brain". This is what makes search beat DoctorC.

### Doctor availability
- `provider_availability` gains `template_group_id` so "apply to all days" writes seven
  linked rows that can later be edited or deleted as one unit.

### Registration
- `legal_documents` gains `payment_sheet_url` and `provider_subtype`, so a dental clinic
  and a diagnostic center receive different agreements plus their own rate sheet at signup.

---

## Phase 2 — Sample lifecycle backend (next)

`backend/app/services/samples.py`, `backend/app/routers/samples.py`

1. `POST /samples/collect` — phlebo scans/generates barcode at the patient's side.
   Validates the dispatch belongs to them and is in `arrived`/`in_progress`.
   Writes `samples` + `sample_events(collected)` with GPS.
2. `POST /samples/handover` — phlebo submits N samples to a center. Defaults destination
   to their `home_lab_org_user_id`, overridable per the confirmed decision.
   Moves samples to `handover_requested`, creates `sample_handovers`.
3. `POST /samples/handover/{id}/respond` — center accepts/rejects per sample.
   On acceptance: samples → `received`, dispatch → `samples_delivered_to_lab`,
   wallet credit fires for part-time phlebos (₹150 × accepted count),
   **patient notification**: "Vizag Diagnostics has received your sample."
4. `POST /samples/{id}/report` — center uploads the report; sample → `report_ready`;
   patient notified; feeds the existing `ai_report_analyses` pipeline.

Rejection is first-class: a rejected sample credits nothing and records a reason, which
is exactly the MOU's "payment deduction for contamination/delay" clause.

## Phase 3 — Phlebotomist dashboard rebuild

Current: 137 lines. Needs: today's runs with **red urgent banners**, 10-minute acceptance
countdown, barcode scan-at-collection, sample manifest, "submit to lab" batch action,
wallet balance + this month's earnings, incentive tracker, 05:15 selfie attendance card.

## Phase 4 — Organization dashboard split

Current: one 1365-line universal page. Split by `organizations.organization_type`:
- **diagnostic_center** — incoming handovers queue (accept/reject per tube), sample
  register, report upload, test catalogue + MRP, home-collection settings.
- **hospital** / **polyclinic** — departments, doctor roster, OPD slots, admissions.
- **clinic** — single-doctor simplified view.
Shared shell + role-specific panels; no more one-size-fits-none.

## Phase 5 — Patient test marketplace

Replace the hardcoded 12-test `/diagnostics` array with search over `service_catalog` +
`provider_services`. Search "MRI" ⇒ partner centers, each showing struck-through MRP vs
CallMedex price, distance, slots. Book jointly. Remove "find diagnostic centers" as a
standalone destination — the test is the entry point, not the center.

## Phase 6 — Urgent nursing & doctor consults

Extend the existing magic-link email dispatch (`send_magic_dispatch_email`,
`/dispatch/respond`) with priority: urgent offers get red subject/badging, a wider initial
radius, shorter expiry, and sort first on every provider board.

## Phase 7 — Doctor availability UX

"Apply to all days" writes 7 rows sharing a `template_group_id`; edit/delete operate on
the group; per-day overrides detach from the group.

## Phase 8 — Registration MOU + payment sheet

On signup, select the MOU by `role` **and** `provider_subtype`, attach the matching
payment sheet, email both, and gate activation on acceptance. Extends the existing
`legal_acceptances` / `accept-mou` flow rather than replacing it.

---

## Explicitly out of scope for now

- Real barcode *hardware* scanning (camera decode). Phase 2 accepts scanned or typed
  input; a camera decoder is a frontend swap that does not change the API.
- Cold-chain IoT temperature logging (`claude.md` §7 "optional").
- Razorpay Route payouts for the monthly settlement run — the wallet ledger is built,
  the bank transfer is a later integration.
