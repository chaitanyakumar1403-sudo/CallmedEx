# Production Pipeline Hardening — Design

**Date:** 2026-08-05
**Status:** Approved for planning
**Source:** Production audit of the patient-booking → phlebotomist-dispatch → sample-collection → lab-processing → MediAssist AI report pipeline (see conversation history for full audit findings with file:line evidence).

## Context

A full-pipeline production audit traced 8 stages end-to-end: booking creation, phlebotomist notification, accept/decline, live tracking, barcode/chain-of-custody, phlebo dashboard scheduling, processing-center verification, and the MediAssist AI handoff. The audit found the pipeline functionally wired at a basic level but with 10 concrete defects ranging from a patient-safety-grade AI fabrication bug to silent failures, inconsistent constants, dead code, and missing UI for backend logic that already exists. This spec organizes the fixes into three phases, ordered by risk, each independently shippable.

## Decisions

These were resolved with the user before this design was written:

1. **Structure:** one phased plan (P0 safety → P1 reliability → P2 completeness), not separate specs per subsystem.
2. **Image OCR bug:** build real vision extraction now, not a stop-gap block on non-PDF uploads.
3. **Silent booking/dispatch failure:** keep the booking confirmed; add retry + ops alert rather than failing the booking loudly.
4. **City fallback:** replace the hardcoded 7-city map with real geocoding (reusing the same API family needed for real ETA).
5. **Dispatch timeout mismatch:** align the Celery sweep to the MOU-documented 10-minute offer window (not the reverse).
6. **Re-fan-out on decline/expiry:** auto re-fan with widening radius, 2 rounds, then an ops alert.
7. **Phlebo notification channel:** stays email-only (no WhatsApp-to-phlebo, no Web Push/FCM) — harden the existing channel instead of adding new infrastructure.
8. **Barcode consolidation:** migrate the frontend to the more rigorous `confirm-sample-collection` endpoint and delete the weaker `scan-tube` path, rather than merging rigor into `scan-tube`.
9. **Chain-of-custody scope:** build all 3 CLAUDE.md checkpoints (collection, transit, lab-receipt) plus photo capture now, not just collection.
10. **AI pipeline divergence:** add a Groq fallback for lab-verified samples when MediAssist is down, rather than fully unifying the two pipelines or leaving them as-is.
11. **Leave-triggered reassignment:** when a phlebo goes on leave, prefer full-time phlebos for reassignment of their advance-scheduled jobs, falling back to part-time only if no full-time phlebo is available nearby — never leave a booking unassigned when a part-time phlebo could cover it.
12. **Platform-admin roster visibility:** add a cross-centre roster/leave view to the platform admin dashboard, showing full roster status (available/unavailable/leave) for every phlebotomist at every processing centre for a selected date, not just leave-only. Mirrors the existing per-centre `PCRosterPanel` UX but rolled up platform-wide with a centre column.

## Phase P0 — Safety-critical

### Image report OCR fix

**Problem:** `GroqReportAnalyzerService.extract_text_from_file` only performs real text extraction for PDFs. JPEG/PNG uploads (permitted by `ai_reports.py`'s `ALLOWED_TYPES`) fall through to a hardcoded generic placeholder string, which is then fed to the LLM as if it were the actual report. The patient receives a fabricated, content-independent "AI analysis" with no relationship to their real results.

**Fix:** Add an image extraction path to `GroqReportAnalyzerService`:
- For `image/jpeg` / `image/png` inputs, base64-encode the image and call a vision-capable Groq model (Llama 3.2 90B Vision or equivalent) with a prompt instructing it to transcribe the report's visible text, tables, and values.
- Feed that transcription into the existing analysis prompt (same downstream logic as the PDF path — no duplication of the analysis prompt itself).
- If the vision call fails, times out, or returns no usable text, return an explicit error response to the caller (e.g. "couldn't read this image clearly, please try a clearer photo or upload a PDF"). Never fall back to the placeholder string.

**Data flow:** `/api/reports/analyze` (image upload) → `extract_text_from_file` (new vision branch) → same `analyze_report_bytes` prompt pipeline → `report_jobs` row marked `delivered` only on real success, `failed` with a clear reason otherwise.

**Error handling:** vision-extraction failure must be distinguishable from "model produced an analysis" — no code path may reach the analysis prompt with the placeholder string still in place.

**Testing:** a fixture image of a synthetic/redacted lab report, asserting the extracted text contains expected values from that specific image (not a generic string); a fixture of an unreadable/non-report image, asserting a clean error response and no `ai_report_analyses` row is created from it.

## Phase P1 — Reliability

### Booking / dispatch-creation failure handling

**Problem:** `create_dispatch` is called synchronously inside `create_booking` wrapped in a bare `except Exception` (`bookings.py:582-586`). On failure, the booking stays `CONFIRMED` with zero dispatch ever created, and only a log line records it — no retry, no alert.

**Fix:**
- Keep the booking `CONFIRMED` (patient experience unaffected by a transient dispatch-engine issue).
- Replace the bare except with a scoped catch that enqueues a Celery retry task for dispatch creation, with backoff (e.g. 3 attempts, exponential backoff).
- If all retries exhaust, write an entry to an ops-alert mechanism (reuse or introduce a lightweight `ops_alerts` table/admin-queue entry) so a human follows up on a booking with no phlebo assigned.

**Testing:** simulate a `create_dispatch` failure and assert (a) the booking remains `CONFIRMED`, (b) a retry task is enqueued, (c) after exhausting retries an ops-alert record exists.

### City geocoding

**Problem:** Unrecognized cities silently default to Vizag's hardcoded coordinates (`bookings.py:532`), causing wrong-geography phlebo dispatch with no error surfaced.

**Fix:** Replace the hardcoded 7-city map with a real geocoding API call (Google Geocoding API — same API family as the ETA fix below, so this is one integration serving two fixes). Cache resolved coordinates per normalized address/city to avoid redundant calls and cost. On geocoding failure, do not fall back to Vizag — surface an explicit error/ops-review flag instead.

**Note:** This phase also folds in the ETA fix identified in the original audit (replacing straight-line haversine ETA with real Google Distance Matrix routing), since it shares the same API integration and credentials setup. Both ship together.

**Testing:** a known-city test asserting correct geocoded coordinates are used; an unrecognized-city test asserting no silent Vizag fallback occurs.

### Dispatch timeout alignment

**Problem:** Individual offers are valid for 10 minutes (`DEFAULT_OFFER_WINDOW_MINUTES` in `dispatch_engine.py`), but the Celery beat sweep (`workers/tasks/dispatch.py:25`) force-cancels anything in `searching`/`provider_notified` after a hardcoded 5 minutes — a phlebo can accept an offer for a dispatch the sweep already force-cancelled.

**Fix:** Change the sweep to read `DEFAULT_OFFER_WINDOW_MINUTES` from `dispatch_engine.py` instead of a separately hardcoded constant, so there is one source of truth for the timeout value.

**Testing:** a test asserting the sweep and the offer-acceptance logic agree on the same cutoff; a regression test reproducing the old race (offer still valid at the 5-8 minute mark, previously force-cancelled) to confirm it no longer occurs.

### Re-fan-out on decline/expiry

**Problem:** When a phlebo declines an offer, or an offer expires, nothing re-notifies the next candidate — the dispatch simply sits until the timeout sweep eventually cancels it (see above), with no automatic recovery.

**Fix:**
- On decline (`respond_to_offer` reject path) and on individual offer expiry, immediately re-run `find_nearby_providers` for the same dispatch.
- If the current-radius candidate pool is exhausted (no new candidates), widen the search radius by a configurable step (e.g. +2km) and retry.
- Track a `fan_out_round` counter on `dispatch_requests`.
- After 2 rounds with no acceptance, stop auto-retrying and write an ops-alert entry (reusing the same alerting mechanism as the booking-failure fix) for manual dispatch intervention.

**Testing:** a decline test asserting a new offer round is created immediately; a radius-widening test when the initial pool is exhausted; a test asserting the process stops and alerts ops after 2 rounds with no acceptance.

### Notification hardening (email-only)

**Problem:** The only notification mechanism is `send_magic_dispatch_email` plus 5s client-side polling, which only works with an open browser tab. The user has explicitly decided to keep email as the sole channel — no WhatsApp-to-phlebo, no Web Push/FCM.

**Fix:** Audit `send_magic_dispatch_email` for whether send failures are currently caught/logged or silently swallowed. Make failures visible: retry the send once on failure, then write an ops-alert entry if the retry also fails, so "the email never went out" is never a silent gap. No new channel is introduced.

**Testing:** a simulated email-send failure asserting a retry occurs and, on repeated failure, an ops-alert record is created.

## Phase P2 — Completeness

### Barcode consolidation

**Problem:** Three competing barcode-scan implementations exist. The one wired to the phlebo UI (`scan-tube` / `samples/collect`) is the weaker path. The unused `confirm-sample-collection` endpoint (rescan-match, GPS capture, device metadata, audit logging) is more rigorous but is dead code — never called from any frontend.

**Fix:** Rewire `BarcodeScannerModal.tsx` / `DoorstepScanPanel.tsx` to call `confirm-sample-collection` instead of `scan-tube`. Once migrated and verified working end-to-end, delete the `scan-tube` route and its frontend caller to remove the redundant weaker path.

**Testing:** an end-to-end test confirming the phlebo UI's barcode scan now produces a `confirm-sample-collection`-style record (rescan-match, GPS, device metadata, audit log entry) rather than the old `scan-tube` record shape.

### Chain-of-custody: all 3 checkpoints + photo capture

**Problem:** CLAUDE.md Section 7 specifies a photo + barcode scan at 3 checkpoints (collection, transit handoff, lab receipt). Today only collection has a real scan; transit handoff has no rescan (just a batch submit); lab-receipt rescan endpoints (`verify-incoming-barcode`/`confirm-receipt`) exist in the backend but have no frontend caller; photo capture is schema-only (`photo_url` field exists but the frontend never populates it).

**Fix:**
- Add photo capture to the collection UI (camera capture → upload → `photo_url` populated on the relevant `sample_events` row), using the audit-log plumbing already present in `confirm-sample-collection`.
- Wire a rescan step into the transit-handoff UI, replacing the current no-scan batch submit.
- Build the missing frontend for the existing lab-receipt rescan endpoints (`verify-incoming-barcode`/`confirm-receipt`), giving processing-center staff a real scan-in step.

**Testing:** custody-chain integration test asserting all 3 checkpoints produce queryable `sample_events` rows with photo/GPS/device metadata where applicable, and that `GET /api/samples/{id}/timeline` shows a complete, ordered custody trail from collection through lab receipt.

### Phlebo "Upcoming Jobs" panel

**Problem:** `run_roster_pass` correctly assigns tomorrow's bookings to a phlebo the evening before (`assignment_mode="advance"`), and `GET /api/phlebo/jobs?date=` exists to retrieve them — but this endpoint is never called from any frontend component. Phlebos have no visibility into advance-rostered jobs until the live dispatch tracker surfaces them same-day, defeating the purpose of advance rostering.

**Fix:** Add a new "Upcoming Jobs" panel to the phlebo dashboard, distinct from the existing live `ProviderDispatchTracker`, that calls `GET /api/phlebo/jobs?date=` for tomorrow (and a short window beyond) and displays assigned bookings with patient/address details.

**Testing:** a test asserting that a booking advance-rostered for tomorrow is retrievable via this panel's underlying endpoint call, and visually distinct from same-day live dispatch jobs.

### Lab connector routing

**Problem:** `connector_type` is hardcoded to `ConnectorType.MOCDOC.value` for every processing center's sample verification (`pc_operations.py:603`), regardless of which lab system a given center actually partners with.

**Fix:** Add a `lab_connector_type` column to `processing_centers`, defaulting existing rows to `mocdoc` in the migration. Change the hardcoded literal in `pc_operations.py` to read the center's own configured connector type.

**Testing:** a test with two processing centers configured with different connector types, asserting each produces a `report_jobs` row tagged with its own center's connector, not a hardcoded value.

### Leave-triggered reassignment: full-time preference

**Problem:** `phlebo_stats.py:195-243` already auto-reassigns a phlebo's advance-scheduled jobs when they mark leave/unavailable within 2 days, routing through `roster.decline_job` → `_available_phlebos`/`_pick`. But candidate selection has no concept of full-time vs. part-time — `_pick` (`roster.py:83-105`) just sorts all rostered-available phlebos of the centre by load then distance. A part-time phlebo covering a quiet slot can end up absorbing a full day's reassigned load meant for a colleague who normally covers that area full-time.

**Fix:** Add a `phlebo_type` (full_time / part_time, per the existing signup field from CLAUDE.md Section 3) read into `_available_phlebos`'s candidate rows. Change `_pick` to run two passes: first restrict `viable` to full-time candidates within radius; if that set is empty, fall back to the full candidate set (including part-time) rather than returning `None` and pushing the booking to `needs_manual_assignment`. This preserves the existing "never silently unassigned when someone could cover it" guarantee while preferring full-time coverage.

**Testing:** a reassignment test with both a full-time and a closer part-time candidate available, asserting the full-time phlebo is picked; a test with only a part-time candidate available, asserting it still gets assigned (not pushed to manual queue) since the fallback fires.

### Platform-admin roster visibility

**Problem:** `GET /api/pc/roster` (`roster.py:31-37`) already returns full roster status (available/unavailable/leave) but is scoped to the calling PC staff's own `processing_center_id` only (`get_current_pc_staff`), and the frontend `PCRosterPanel.tsx` consuming it is only mounted on the per-centre `dashboard/processing-center/page.tsx`. The platform-level admin dashboard (`dashboard/admin/page.tsx`) has a phlebotomist count/role-filter tile but no roster or leave visibility across centres at all — an ops admin has no way to see who's on leave platform-wide without checking every centre individually.

**Fix:**
- Add an admin-only endpoint, e.g. `GET /api/admin/roster?date=`, that joins `phlebotomist_roster` with `phlebotomists`/`processing_centers` across all centres for the given date, gated the same way other `admin.py` routes are (role check inside the handler via `get_current_user`).
- Add a new panel/tab to `dashboard/admin/page.tsx` (or a new admin sub-route, consistent with the existing `admin/fraud` sub-page pattern) rendering this list with a centre column, reusing `PCRosterPanel`'s status-badge styling (available/unavailable/leave) for visual consistency.
- Show full roster status, not leave-only, so an admin can see availability and unavailable-without-leave-reason entries too, not just who's formally on leave.

**Testing:** an admin-role test asserting the endpoint returns roster rows spanning multiple processing centers in one call; a non-admin-role test asserting 403; a frontend smoke check that the new panel renders centre + status correctly for a date with mixed statuses across centres.

### AI pipeline fallback

**Problem:** Lab-verified samples depend on MediAssist alone for report analysis; if MediAssist is unreachable, the `report_jobs` row sits `queued`/`failed` indefinitely with no in-process fallback, while a patient re-uploading the same document through the direct-upload path would get an instant Groq-based analysis instead.

**Fix:** In `submit_report_job_to_mediassist`, on failure or timeout, fall back to calling the same in-process `GroqReportAnalyzerService` already used for patient direct uploads. Mark the `report_jobs` row `delivered` via this fallback path rather than leaving it stuck. Record which path (MediAssist vs. Groq-fallback) actually produced the result, for audit/compliance traceability.

**Testing:** a MediAssist-down simulation (mocked failure/timeout) asserting the Groq fallback fires, the `report_jobs` row reaches `delivered`, and the result record correctly attributes which pipeline produced it.

## Out of Scope (explicitly deferred, not part of this spec)

- Full PostGIS/`ST_DWithin` migration for dispatch matching (haversine is retained; only the ETA/geocoding piece is upgraded in P1).
- Supabase Realtime push for live tracking (10s polling is retained as-is; not flagged as a decision point requiring a fix in this pass).
- Load/rating tiebreak in phlebo ranking beyond distance (noted in the original audit as a gap but not selected as part of this hardening pass).

## Cross-Cutting Notes

- The booking-failure alert (P1) and the re-fan-out failure alert (P1) should share the same underlying ops-alert mechanism — build it once, use it in both places.
- The city-geocoding fix and the real-ETA fix share one API integration; implement together to avoid a second credentialing/config pass later.
- Phase P0 has no dependency on P1/P2 and should ship first, independent of the rest.
