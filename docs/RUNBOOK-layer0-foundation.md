# Layer 0 Foundation — Production Runbook

Branch `feature/layer0-foundation`. This runbook covers the live-infra steps that were
**deferred** during the build (no live Supabase/server in the build environment) plus the
**deploy-time config gates** the final code review flagged as merge-with-fixes items.

Do these in order when deploying Layer 0.

---

## 0. Prerequisites
- Supabase project (URL + service key + anon key) in the backend `.env`.
- `GEMINI_API_KEY` set (verification OCR fails closed to manual review without it).
- Razorpay keys set (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) for payment verification.

## 1. Apply the database migration (additive — safe, non-destructive)
The migration only CREATES new tables + the `provider_directory` view. It drops nothing.
1. In the Supabase SQL editor (or `psql`), run **`database/layer0_foundation.sql`**.
2. Then run **`database/layer0_seed.sql`** (demo providers for QA).
3. Verify: `python database/verify_layer0.py` → expect `OK table ...` for all 8 tables and
   `OK provider_directory (... verified rows), no nameless rows`.

## 2. Create the verification Storage bucket
In Supabase → Storage → create a bucket named **`verification-docs`**, set **Private**.
(Name overridable via `VERIFICATION_BUCKET`.) Without it, uploaded certificates aren't
stored and the admin reviewer has nothing to view.

## 3. Set deploy-time environment variables ⚠️ REQUIRED — deploy gates

These two are **correctness-critical in production** (final review, Important #2):

| Var | Value | Why |
|---|---|---|
| **`ALLOWED_ORIGINS`** | comma-separated, **must include the live frontend origin** (e.g. `https://callmedex-v1.vercel.app`, your real Vercel prod URL) and `https://meet.jit.si` if the video iframe needs it | CORS is now an explicit allowlist with `allow_credentials=True` and **no wildcard**. A missing prod origin **bricks the browser app**. |
| **`TRUSTED_PROXY_COUNT`** | the number of proxy hops in front of the app (Render = typically `1`) | Rate limiter now ignores `X-Forwarded-For` unless this is set. Left at `0` behind Render, **all users share one IP bucket** → collective throttling. |

Other Layer 0 flags (defaults are sensible):

| Var | Default | Notes |
|---|---|---|
| `VERIFICATION_AUTO_APPROVE` | `true` | High-confidence + exact-match auto-approves; else → admin queue. |
| `GOV_REGISTRY_MODE` | `mock` | `mock`/`off` = gov result advisory only, never sole basis for approval. Set `live` only with real registry access. |
| `VERIFICATION_BUCKET` | `verification-docs` | Must match the bucket created in step 2. |

## 4. Live smoke tests (post-deploy)
Run against the deployed server with real JWTs.

1. **Verification (auto-approve path):** as a doctor with a matching, legible license,
   `POST /api/verification/verify-document` (multipart `file`). Expect a tiered result; a
   `documents` row **and** a `verification_reviews` row created; **no PGRST204**.
2. **Admin authority:** as an admin, `GET /api/admin/verifications?status=under_review`
   returns the queue with `document_signed_url`; `POST /api/admin/verifications/{id}/decide`
   `{ "decision":"approve","reason":"..." }` flips the provider's role-table
   `verification_status` and sends a notification.
3. **Verified-only search invariant:** `GET /api/providers/search/providers?type=diagnostic_center`
   ⚠️ **note the prefix is `/api/providers`** (not `/api/provider-management`). The seeded
   `Vizag Diagnostics Center` (verified) appears; `Pending Labs` (pending) does **not**.
4. **Payment fail-closed:** confirm a tampered signature and an amount mismatch both return
   `verified:false`; a valid capture returns `verified:true`.

## 5. Known limitations & follow-ups (from the final review — none merge-blocking)

**Deferred to later layers (by design — additive Layer 0):**
- **Packages are "dark":** `search_packages` reads the new `provider_packages`, but the
  org package-creation CRUD still writes legacy `health_packages`/`organization_packages`.
  Packages created via the current dashboard are invisible on the patient page until
  **Layer 5/6** wires the writer to `provider_packages` (or seed `provider_packages` for demos).
- **`bookings.provider_id` FK + org-booking `users.id` convention** → Layer 3.
- **Legacy tables retained** (`slots`, `organization_services`, `doctor_availability`, …) —
  dropped in the layer that migrates their code (2/3/6).

**Cleanup follow-ups (non-blocking):**
- `backend/test_ai_pipeline.py` (manual script, not pytest-collected) still monkeypatches the
  old 6-arg `_finalize` — update to the new 9-arg signature or delete before relying on it.
- admin `list_reviews` N+1 documents query; `decide` is not transactional across
  review-update → role-mirror → notify (partial-failure inconsistency) — harden in Layer 6.
- `fhir.push_to_abdm` writes an empty `user_id` audit row when `patient_user_id` is absent.
- `decide()` doesn't append a passed `gov_registry` entry to `checks` (audit-trail symmetry).
- The suite emits one third-party `google.generativeai` deprecation warning (library-level).

**Security items already fixed in this branch (verify they hold post-deploy):**
- CORS wildcard removed; exception text no longer leaked; rate-limit XFF bypass closed;
  payments fail-closed with amount check; `documents` column bugs fixed; dispatch
  live-tracking crash fixed.

**Explicitly deferred to their own follow-up specs (from the design):**
- MOU-token `password_hash` exposure (immediate next spec), DPDP consent implementation,
  `localStorage` → httpOnly cookie auth.

## 6. Test harness note
Pure logic is unit-tested (`cd backend && pytest -q` → 25 passing). DB/Storage/HTTP paths
have **no automated integration tests** (no ephemeral test DB) — steps 1–4 above are their
verification. Standing up a testcontainers/ephemeral-Supabase harness is a recommended
follow-up so these paths get regression coverage.
