# Layer 0 — Foundation: Unified Data Model, Verification Rebuild & Verified-Only Search

**Date:** 2026-07-24
**Status:** Approved design — ready for implementation planning
**Branch:** `feature/layer0-foundation`
**Program context:** First of a 7-layer decomposition of the CallMedex DoctorC-style
marketplace program (see "Program decomposition" below). This layer is the foundation
every later layer depends on.

---

## 1. Purpose & Scope

Establish the trustworthy foundation the marketplace stands on:

1. **Unified data model** — one canonical provider identity + service catalog +
   availability/slot model + verification authority, replacing the fragmented,
   phase-accreted, partially-drifted schema.
2. **Verification rebuild (Req D)** — a tiered pipeline (AI pre-screen → auto-decide
   or human review) with real document storage and an admin dashboard as the authority.
3. **Verified-only search** — search returns only verified, listed providers, sourced
   from a single directory view (kills the "nameless org" bug at the source).
4. **Inline hardening** — the mechanical security/correctness fixes surfaced during
   codebase analysis, fixed in the same PR so the foundation isn't leaky.

**Precondition confirmed:** no real/production data exists — only demo records. The
migration may restructure/drop tables freely and ships as one clean migration.

### In scope
- New marketplace tables + `provider_directory` view + one clean migration.
- Verification pipeline rebuild: storage, tiered decision engine, `verification_reviews`
  authority table, admin review endpoints, per-role support, error/retry handling.
- `GET /api/search/providers` verified-only search with marketplace filters.
- Hardening checklist items 1–9 (Section 6).
- Updating existing tests/code that reference superseded tables.

### Out of scope (deferred, with reason — not silently dropped)
- **MOU-token contains `password_hash`** (P0): fix = store pending signups server-side,
  opaque email token. Auth-flow surgery → **immediate dedicated follow-up spec** right
  after this one.
- **DPDP consent stub** (always returns `true`): belongs to the consent-management
  feature (a later layer).
- **Token in `localStorage` → httpOnly cookies**: frontend-auth change, its own pass.
- Coupons/offers/campaigns (Layer 5), settlement/payout mechanics (Layer 6),
  sample chain-of-custody (Layer 4). Columns/status enums are *seeded* now so these
  layers slot in without a second migration.

---

## 2. Program Decomposition (context)

Dependency-ordered layers; each is its own spec → plan → build cycle sharing one data model:

- **Layer 0 (this spec)** — Foundation: data model + verification + verified search + hardening.
- **Layer 1** — Marketplace core: browse/compare/filter verified providers (Req 1, patient Req 6).
- **Layer 2** — Availability & slots: smart templates, recurring/bulk edit, real-time capacity (Req A, Req 2 slots).
- **Layer 3** — Booking flow: full funnel, lab-visit vs home-collection, payment, confirmation (Req 2).
- **Layer 4** — Home-collection chain-of-custody + org↔phlebotomist integration (Req B, Req C).
- **Layer 5** — Packages, offers, coupons, add-ons (Req 3).
- **Layer 6** — Provider dashboard + admin controls: commission, approval, settlement/payout, campaigns, featured (Req 4, Req 5).

---

## 3. Core Architectural Decision

**Approach 1 — Canonical `users.id` identity + additive marketplace layer** (chosen over a
full polymorphic-`providers` rewrite and over a minimal FK patch).

**The one rule:** every marketplace provider is identified by **`users.id`**.
- A solo doctor is their own `users.id`; an organization/lab is its org account's `users.id`.
- All marketplace tables key off `provider_user_id → users.id`.
- `organizations.id` stops being a *marketplace* key: the new marketplace sub-entities
  (`provider_branches`, `provider_services`, `provider_packages`, `provider_availability`,
  `provider_slots`, `provider_blocked_dates`, `provider_settings`) all key to the org's
  `users.id` — **confirmed acceptable by owner.**
- Existing **org-internal link tables** (`organization_doctors`, `staff.linked_organization_id`)
  are **untouched in Layer 0** and keep referencing `organizations.id`; org↔doctor employment
  modeling is deferred to a later layer.
- Role tables (`doctors`, `organizations`, `pharmacies`, `nurses`, `phlebotomists`, `staff`)
  remain for role-specific profile fields only.

Rationale: kills the `provider_id` ambiguity (bare UUID meaning either `organizations.id`
or a `users.id`, no FK) that causes join failures and the nameless-org search bug; gives
Layers 1–6 one canonical id, one catalog, one availability model, one verification
authority — as an additive, testable layer rather than a big-bang rewrite.

---

## 4. Data Model

### 4.1 New marketplace tables (all `provider_user_id UUID REFERENCES users(id) ON DELETE CASCADE`)

| Table | Purpose | Key columns |
|---|---|---|
| `provider_settings` | Per-provider marketplace config | `provider_user_id` (PK), `home_service_enabled bool`, `home_radius_km real`, `commission_pct numeric(5,2)`, `is_listed bool`, `accepts_online_payment bool` |
| `provider_branches` | Multi-location support | `id`, `provider_user_id`, `name`, `address`, `city`, `lat`, `lng`, `phone`, `is_active` |
| `provider_services` | Service catalog | `id`, `provider_user_id`, `branch_id?`, `name`, `category` (lab_test/imaging/consult/procedure/…), `base_price numeric(10,2)`, `home_available bool`, `is_active` |
| `provider_packages` | Health packages (replaces `health_packages` + missing `organization_packages`) | `id`, `provider_user_id`, `name`, `description`, `included_service_ids uuid[]`, `price numeric(10,2)`, `home_available bool`, `status` (draft/pending/approved/rejected), `is_active` |
| `provider_availability` | Recurring availability **template** (feeds Layer 2 Req A) | `id`, `provider_user_id`, `branch_id?`, `day_of_week int 0-6`, `start_time`, `end_time`, `slot_minutes int`, `capacity_per_slot int`, `mode` (lab_visit/home), `is_active` |
| `provider_slots` | Concrete bookable slots w/ real-time capacity | `id`, `provider_user_id`, `branch_id?`, `date`, `start_time`, `end_time`, `capacity int`, `booked_count int default 0`, `mode`, `is_available bool` |
| `provider_blocked_dates` | Holidays/exceptions | `id`, `provider_user_id`, `branch_id?`, `date`, `reason` |
| `verification_reviews` | **Verification authority record** | `id`, `provider_user_id`, `role`, `document_id?`, `ai_result jsonb`, `ai_decision` (auto_approve/auto_reject/needs_review), `gov_result jsonb`, `final_status` (verified/rejected/under_review), `reviewed_by uuid?`, `review_reason text?`, `created_at`, `decided_at?` |

Indexes: `provider_user_id` on all; `(provider_user_id, date)` on `provider_slots`;
`(final_status)` on `verification_reviews`; geo columns on `provider_branches`.

### 4.2 `provider_directory` view

Unions role tables into one searchable surface. Columns:
`provider_user_id, provider_type, display_name, subtype, city, lat, lng, rating,
verification_status, is_listed, home_service_enabled`.

- `display_name` is `COALESCE(organization_name, pharmacy_name, users.full_name)` and the
  view **excludes rows with empty display_name** → nameless rows structurally impossible.
- Joins `provider_settings` for `is_listed` / `home_service_enabled`.
- **All search reads go through this view**, filtered `verification_status='verified' AND is_listed=true`.

### 4.3 Reconciliation — old → new (dropped; no real data)

| Old | New |
|---|---|
| `slots` | `provider_slots` |
| `doctor_availability` + `organization_timings` (never existed) | `provider_availability` |
| `doctor_blocked_dates` | `provider_blocked_dates` |
| `organization_services` | `provider_services` |
| `health_packages` + `organization_packages` (never existed) | `provider_packages` |
| scattered home flags (`pharmacies.home_delivery`, `nurses.service_radius_km`, etc.) | `provider_settings` |
| `bookings.provider_id` (bare UUID, no FK) | `bookings.provider_id UUID REFERENCES users(id)` |

Code referencing the old tables is refactored to the new ones as part of the plan
(`bookings.py`, `provider_management.py`, dashboards, existing tests).

### 4.4 Migration posture

One idempotent migration file (`database/layer0_foundation.sql`): create new tables +
indexes, add the `bookings.provider_id` FK, drop superseded/drifted tables, create the
`provider_directory` view. Plus a `database/layer0_seed.sql` producing demo providers
(verified + pending + a home-service one) for tests and manual QA.

---

## 5. Verification Pipeline (Req D)

**Entry:** `POST /api/verification/verify-document` (multipart; frontend contract unchanged).

**Stage 0 — Store document (new):** upload bytes to a **private Supabase Storage bucket**
(`verification-docs/{user_id}/{uuid}.{ext}`); write a `documents` row using only real
columns (`user_id, document_type, file_url, file_name, verification_status='pending',
uploaded_at, verification_notes`). Fixes PGRST204 **and** gives the admin reviewer an image.

**Stage 1 — AI OCR** (Gemini Vision, existing `AIOCRService`): extract `name`,
`license/registration number`, `doc_type`, `is_legible`, `is_valid_document`, `confidence`.

**Stage 2 — Strict matching (fixed):** replace the substring match
(`s_norm in e_norm or e_norm in s_norm`, which matched `AB12`↔`AB1299999`) with:
- **license/registration:** normalized **exact** equality.
- **name:** normalized equality with a bounded similarity threshold (handles honorifics/spacing only).

**Stage 3 — Decision engine (tiered):**
- **auto_reject** → illegible / invalid doc type / hard license-or-name mismatch → `final_status = rejected`, clear reason.
- **auto_approve** → high confidence **and** legible **and** valid doc **and** exact name & license match.
  Gated by `VERIFICATION_AUTO_APPROVE` (**default ON** — owner decision B). If `GOV_REGISTRY_MODE=live`
  and returns valid, that strengthens approval; while `mock`/`off`, gov result is
  **advisory only, recorded, never the sole basis** for approval.
- **needs_review** → anything plausible-but-uncertain → `final_status = under_review`, enters admin queue.

**Stage 4 — Persist & mirror:** write `verification_reviews` authority row; mirror
`final_status` onto the role table's `verification_status`; update `documents`; audit-log.

**Error handling & retry:** Gemini transient failures retry with bounded exponential
backoff; persistent failure → `under_review` (never an unfair auto-reject). No `str(e)`
leaked to clients — generic message + `request_id`.

**Config flags:** `VERIFICATION_AUTO_APPROVE` (default `true`), `GOV_REGISTRY_MODE`
(`mock`|`off`|`live`, default `mock`). Both logged loudly at startup so mock posture is never silent.

**Admin review dashboard (authority):**
- `GET /api/admin/verifications?status=needs_review|under_review` → queue: provider info,
  **extracted-vs-stored fields side by side**, signed URL to the document, AI decision + gov result.
- `POST /api/admin/verifications/{review_id}/decide {decision: approve|reject, reason}` →
  sets final status, mirrors to role table, **notifies provider** (existing notification
  engine → in_app + email/WhatsApp), audit-logs. Final and authoritative.
- Provider view: `GET /api/verification/status` returns latest review status, plain-language
  message, and history.

**All roles:** doctor, organization (hospital/diagnostic_lab/polyclinic/imaging_center),
pharmacy, nurse, phlebotomist — one pipeline, role-specific required fields + registry label.

---

## 6. Verified-Only Search (Req 1)

**Single source:** `GET /api/search/providers` reads the `provider_directory` view,
always filtered `verification_status='verified' AND is_listed=true`. The nameless/unverified
rows cannot appear → the `search/page.tsx` client-side `.filter()` band-aid is removed and
the fix lives at the source (`provider_management.search_organizations`).

**Filters:** `type` (hospital/diagnostic_lab/polyclinic/imaging_center/doctor/pharmacy);
`location` (patient lat/lng via Geoapify geocode → haversine distance); `home_service`
(badge + within `home_radius_km`); `price` (min from `provider_services`/`provider_packages`);
`rating`; `has_availability` (join `provider_slots` next-available date).

**Default sort:** distance-first, then rating (price/rating toggles available).

**Row shape:** name, type/subtype, city + distance, rating, min price, home-service badge,
next-available slot. Response shape reserves room for offers/featured badges (Layers 5/6).

---

## 7. Hardening Checklist (bundled into this PR)

1. **CORS** — remove `allow_origin_regex=".*"`; explicit allowlist; credentials only for allowed origins.
2. **Rate-limit bypass** — trusted-proxy-aware client IP; client `X-Forwarded-For` can't reach the localhost skip.
3. **Exception leak** — global handler + `SecurityMiddleware` return generic message + `request_id`; stop downgrading DB errors to HTTP 200; no `str(exc)` in bodies.
4. **Payment fail-closed** — `verify_payment` fails on bad/missing signature or exception; validates `amount == order amount`; never returns `verified: True` on a skipped check.
5. **`documents` column bug** — fix inserts in `verification.upload_document` and `fhir.push_to_abdm` to real columns.
6. **Dispatch crash** — fix `dispatch_engine.get_live_tracking` unbound-`result` NameError on DB-miss/local path.
7. **Non-UUID dispatch id** — `telemedicine.order_prescribed_actions` uses a real `uuid4`.
8. **Duplicate `SlotResponse`** in `schemas.py` — dedupe/rename.
9. **`sanitize_input`** — stop regex-mangling legitimate medical text; rely on parameterized PostgREST + output encoding.

---

## 8. Testing Strategy

- **Migration:** applies cleanly + idempotently on fresh Supabase; new tables/FKs/view created;
  superseded tables dropped; seed produces demo providers.
- **Data model:** FK integrity (`booking.provider_id` resolves to real `users.id`);
  `provider_directory` returns only `verified + listed`; pending & nameless rows never appear.
- **Verification (TDD core):** decision-engine unit tests per role assert each tier fires
  correctly; document lands in Storage + `documents` row writes with no PGRST204;
  `verification_reviews` written + role status mirrored; `admin/decide` flips status + notifies
  + audit-logs; Gemini-failure → `under_review` (not reject).
- **Search:** verified-only invariant (seed pending + verified → only verified returned);
  filter tests (type/home/distance/price); band-aid removed and page still renders.
- **Hardening regression:** CORS rejects disallowed origin; rate limiter not bypassable via
  spoofed XFF; `verify_payment` rejects bad signature + amount mismatch; `get_live_tracking`
  clean on DB-miss; no response body contains `str(exc)`.
- **Existing tests:** `test_*` files assuming old `slots`/`health_packages`/`provider_id`
  shapes are updated to the new model (not left red).

---

## 9. Open Follow-ups (queued, not in this spec)

1. **MOU-token `password_hash` exposure** — immediate follow-up spec (next).
2. DPDP consent implementation — later layer.
3. `localStorage` → httpOnly cookie auth — later pass.
