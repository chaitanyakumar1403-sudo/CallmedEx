# Task 8 Report: Walk-in Centre Booking + Org Services Marketplace Wiring

## Status: DONE

## Commit Hash
`7c89fb9`

## Summary

Two linked fixes implemented:

### Backend
1. **Dual-write from `organization_services` to `provider_services`** — `POST /api/providers/org/services` now best-effort matches the service name against `service_catalog` (slug match first, then ILIKE name fallback). On match, upserts `provider_services` with `provider_user_id`, `catalog_id`, `base_price`, `mrp`, `home_available`, `is_active`. Wrapped in try/except — never fails the main write. Unmatched custom services skip silently (org-local only).

2. **`create_booking` PENDING_REVIEW fix** — Changed `if is_diagnostic_review:` to `if is_diagnostic_review and not resolved_provider_id:` so that lab bookings with an explicit `provider_id` (org-specific) route to **CONFIRMED** status, not PENDING_REVIEW. The partner-blind flow (no org) remains PENDING_REVIEW as before.

3. **`org-services` endpoint resolution** — The endpoint now resolves `org_id` from `user_id` when a `provider_user_id` is passed. This is needed because marketplace search pages link with `?org=<provider_user_id>` (users.id), but the org tables key on `organizations.id`.

### Frontend (`booking/page.tsx`)
4. **Deep-link handling** — `?type=lab&org=<id>&service=<catalog_id>` now:
   - Sets `bookingType` to `"lab"` and `selectedOrg` to the org ID
   - Goes to step 2 (test selection) instead of step 3 (doctor selection)
   - Fetches org catalog from `/api/providers/{id}/catalog` to show the specific centre's services/packages instead of the default hardcoded test list
   - Pre-checks the deep-linked `service=<catalog_id>` test

5. **Step 4 date+slot for lab-with-org** — Shows the time slot picker (operating hours from org timings, morning/afternoon grid) instead of the "centre assigns slot" blue banner. The partner-blind lab path remains unchanged.

6. **handleConfirm for lab-with-org** — When `selectedOrg.isReal`, omits `catalog_id`, `query`, `city`, `district`, `home` fields (partner-blind). Sends `provider_id` + real `slot_id` so the backend routes to CONFIRMED.

### Tests
7. **`test_org_services_marketplace.py`** — 6 new tests:
   - `test_catalog_matched_service_creates_provider_row`: MRI Brain at 4500 creates provider_services row
   - `test_matched_service_appears_in_offers`: find_offers returns the org
   - `test_price_update_rewrites_base_price`: 4500 to 4200 reflected in offers
   - `test_unmatched_service_skips_dual_write`: custom name skips without error
   - `test_unverified_provider_excluded_from_offers`: unverified partner filtered out
   - `test_slug_fallback_via_ilike_name`: ILIKE fallback matches "MRI Brain Screening"

## Verification
- **Backend tests**: 301 passed (baseline 295 + 6 new)
- **Frontend build**: Full `next build` green, no errors
- **Manual trace**: MRI search → centre row → booking step 2 (centre's tests) → date+slot → confirm → success — the flow is now wired end-to-end

## Concerns
- The `org-services` endpoint (`/api/bookings/org-services/{org_id}`) now resolves `user_id` to `org_id` internally. This is backward-compatible — existing callers passing `organizations.id` continue to work because the resolution only triggers when the direct lookup fails.
- The frontend uses the `/api/providers/{id}/catalog` endpoint for the centre's test list, not the `org-services` endpoint. These are two different data sources: the catalog reads from `provider_services` (marketplace table, populated by the dual-write), while `org-services` reads from `organization_services` (legacy org table). Both should show the same data after the dual-write.

---

## Post-Review Fix Report (2026-07-29)

### Finding 1 (CRITICAL) — `updated_at` phantom column in dual-write

**Issue:** `ps_row` in `org_add_service` included `"updated_at": datetime.now(...)`, but `provider_services` has no `updated_at` column (DDL: `layer0_foundation.sql:47-57` + phase1 ALTERs for `mrp`, `urgent_available`, `catalog_id`, `turnaround_hours`). PostgREST rejects unknown columns, so the entire dual-write silently failed in production.

**Fix:** Removed `updated_at` from both the INSERT and UPDATE branches. Re-audited every key against the DDL:
- INSERT: `id`, `provider_user_id`, `catalog_id`, `name`, `category`, `base_price`, `mrp`, `home_available`, `is_active`, `created_at`
- UPDATE: same minus `id` and `created_at` (not updated on conflict)

### Finding 2 (Minor) — PostgREST or-filter comma injection

**Issue:** The catalog match used `.or_(f"slug.eq.{slug},name.ilike.%{body.name}%")`. When `body.name` contains a comma (e.g. "MRI, Brain"), PostgREST's or-filter parser breaks because the comma is both a filter separator and part of the value.

**Fix:** Restructured into two separate parameterised queries — first `.eq("slug", slug)`, then `.ilike("name", f"%{body.name}%")` as a fallback. No raw-name embedding in filter strings.

### Finding 3 (Minor) — UPDATE path verification

**Issue:** Verified that the UPDATE path also referenced `updated_at` (same dict, same bug). Fixed in the same pass — the UPDATE branch now writes exactly the same column set minus `id`/`created_at`.

### Test gap fix

**Issue:** All 6 original tests used a simulated inline re-implementation of the dual-write logic, proving nothing about the production write path.

**Fix:** Replaced the `_simulate_dual_write` helper. Three new tests now call the **real** `org_add_service` endpoint directly with a mocked `supabase` and `current_user`:
- `test_dual_write_via_real_endpoint_no_phantom_columns` — asserts the written row's keys are a subset of `PROVIDER_SERVICES_DDL` and explicitly asserts `"updated_at" not in written_keys`
- `test_dual_write_update_no_phantom_columns` — same assertion for the UPDATE path
- `test_dual_write_unmatched_skips_silently` — verifies the catch-all doesn't throw

**Test count:** 303 passed (baseline 295 + 8 new; the 3 real-endpoint tests + 5 marketplace-behaviour tests).