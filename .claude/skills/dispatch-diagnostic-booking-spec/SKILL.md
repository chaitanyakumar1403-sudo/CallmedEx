---
name: dispatch-diagnostic-booking-spec
description: CallMedex's two-tier diagnostic booking model, the phlebotomist dispatch engine technical spec, and provider fraud/quality trust scoring. Use when building or reviewing home-collection booking, phlebotomist matching/dispatch, live tracking, or provider trust ranking.
---

# Diagnostic Services — Two-Tier Model

## Tier A: Home-serviceable (dispatch model)
Sample collection, ECG, basic vitals, select rapid tests.
- Patient books via web/WhatsApp → dispatch engine assigns nearest available, on-duty phlebotomist
- **Live tracking UI** (Swiggy/Uber-style): map with moving pin, distance remaining, live ETA countdown
- **Chain-of-custody:** photo + QR/barcode scan at collection, at transit handoff, and at lab receipt — prevents sample mishandling/mix-up disputes
- Sample routed to a registered diagnostic center's queue
- **Future-forward additions:**
  - AI-predicted demand heatmaps (which localities need more on-duty phlebotomists at which hours) to pre-position staff
  - Auto-scheduling of routine/recurring tests (e.g., monthly diabetes panel) with one-tap re-book
  - Cold-chain temperature logging for samples requiring refrigerated transit (IoT sensor tag on collection kit, optional)

## Tier B: Lab-mandatory (slot-booking model)
Imaging (X-ray, MRI, CT), specialized panels requiring lab equipment.
- Patient selects diagnostic center + available time slot (capacity-aware inventory, no dispatch needed)
- Standard appointment confirmation + reminder flow
- **Future-forward addition:** AI-based prep-instruction reminders specific to the test (e.g., fasting requirement countdown sent via WhatsApp before an early-morning slot)

# Dispatch Engine (Phlebotomist Matching) — Technical Spec

**New components required beyond current MediAssist stack:**

1. **`phlebotomist_locations` table** — live lat/long pings every 10–15s while on duty (Supabase Realtime channel, or lightweight Redis if latency becomes an issue)
2. **Matching query:** on booking, find on-duty phlebotomists within radius
   - Use PostGIS `ST_DWithin` (add PostGIS extension to Supabase) for accurate radius queries, or haversine formula in plain SQL for a leaner MVP
   - Rank candidates by: distance → current load (active job count) → rating
3. **ETA calculation:** Google Distance Matrix API or Mapbox Directions API for real routing ETA (not straight-line) — display "Arriving in ~14 mins, 2.3 km away"
4. **Live tracking screen:** Supabase Realtime subscription pushing phlebotomist location updates to patient's map view
5. **Duty/availability toggle:** phlebotomist app-side on/off switch controlling dispatch eligibility
6. **Surge/load-aware assignment (future):** avoid overloading a single phlebotomist during high-demand windows

This is the single most engineering-heavy new module — a genuine dispatch system, not CRUD.

> **Current implementation note (as of the 2026-08-05 production audit):** the live table is `provider_locations` (not `phlebotomist_locations`), PostGIS is not enabled (haversine only), ETA is straight-line (no Distance Matrix/Mapbox integration yet), and live tracking is 10s HTTP polling rather than a Realtime push subscription. See `docs/superpowers/specs/2026-08-05-production-pipeline-hardening-design.md` for the hardening plan closing these gaps.

# Fraud/Quality Scoring (Provider Trust Layer)

- Track per-provider (phlebotomist, pharmacy, doctor): no-show rate, late-arrival rate, patient complaint rate, rating
- Feed into dispatch ranking (above) and into a visible trust badge on provider profiles
- Flag providers below threshold for manual review/suspension
- **Future-forward addition:** anomaly detection on consultation patterns (e.g., a doctor prescribing the same medication to an unusually high share of patients) surfaced for admin review — a light clinical-integrity safeguard, not an accusation engine
