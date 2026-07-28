# Pre-merge verification — Processing Center migration

**Run this before merging `worktree-processing-center-foundation`.**

Every automated test on this branch checks the migration by reading it as *text*. None of
them execute SQL. That was a deliberate decision (no local Postgres, Docker daemon down,
hosted-Supabase-only project), and it leaves exactly one class of failure undetected: a
conflict between the migration and the rows already in your live database.

This document closes that gap. It takes about five minutes.

---

## Step 1 — Prove no existing row violates the new CHECK constraints

The migration widens four `CHECK` constraints. Postgres applies `ADD CONSTRAINT` against
existing rows, so **a single row holding a value outside the new list aborts the entire
migration**. Nothing is partially applied — the transaction rolls back — but you want to
know before you run it, not during.

```bash
psql "$SUPABASE_DB_URL" -c "SELECT DISTINCT status FROM samples;"
psql "$SUPABASE_DB_URL" -c "SELECT DISTINCT event  FROM sample_events;"
psql "$SUPABASE_DB_URL" -c "SELECT DISTINCT status FROM dispatch_requests;"
psql "$SUPABASE_DB_URL" -c "SELECT DISTINCT role   FROM users;"
```

Check each returned value against the corresponding list in
`database/task1_processing_center_foundation.sql`:

| Query | Constraint | Line |
|---|---|---|
| `samples.status` | `samples_status_check` | 359 |
| `sample_events.event` | `sample_events_event_check` | 393 |
| `dispatch_requests.status` | `dispatch_requests_status_check` | 492 |
| `users.role` | `users_role_check` | 117 |

**If any value is missing from its list, stop and tell me.** It means a value entered your
database through a patch that isn't in these files, and the list needs widening before the
migration can run. This is not hypothetical — one task in this build caught the plan
guessing at `dispatch_requests` values and omitting two real ones
(`samples_delivered_to_lab`, `no_provider`), which would have failed exactly here.

## Step 2 — Confirm the prerequisite tables exist in the expected shape

The migration assumes these already exist. `service_catalog` in particular is joined
during seeding.

```bash
psql "$SUPABASE_DB_URL" -c "\d service_catalog"
psql "$SUPABASE_DB_URL" -c "\d samples"
psql "$SUPABASE_DB_URL" -c "\d phlebotomists"
psql "$SUPABASE_DB_URL" -c "\d dispatch_requests"
```

## Step 3 — Apply the migration, twice

The second run is the one that matters: it proves idempotency, which is the property the
offline tests genuinely cannot check.

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/task1_processing_center_foundation.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f database/task1_processing_center_foundation.sql
```

Both must exit 0. The second must produce no errors and change nothing.
`ON_ERROR_STOP=1` matters — without it psql continues past failures and reports success.

## Step 4 — Verify the result

```bash
# All 17 new tables present
psql "$SUPABASE_DB_URL" -c "
SELECT count(*) AS tables_created FROM pg_tables
 WHERE schemaname='public' AND tablename IN (
  'processing_centers','processing_center_staff','processing_center_areas','city_aliases',
  'tube_types','home_services','home_service_tubes','home_service_city_pricing',
  'family_members','booking_subjects','booking_tests','sample_batches','sample_tests',
  'service_area_requests','phlebotomist_roster','lab_reports','report_fetch_jobs');"
# expect: 17

# Every new table has RLS enabled (deny-all by default)
psql "$SUPABASE_DB_URL" -c "
SELECT tablename FROM pg_tables
 WHERE schemaname='public' AND rowsecurity=false AND tablename IN (
  'processing_centers','processing_center_staff','processing_center_areas','city_aliases',
  'tube_types','home_services','home_service_tubes','home_service_city_pricing',
  'family_members','booking_subjects','booking_tests','sample_batches','sample_tests',
  'service_area_requests','phlebotomist_roster','lab_reports','report_fetch_jobs');"
# expect: 0 rows

# The 10 blood tests and 5 tube types seeded
psql "$SUPABASE_DB_URL" -c "SELECT code, name, base_price FROM home_services ORDER BY code;"
psql "$SUPABASE_DB_URL" -c "SELECT code, name FROM tube_types ORDER BY code;"

# Centres seeded as 'onboarding' with NO laboratory name — this is deliberate
psql "$SUPABASE_DB_URL" -c "SELECT code, city, status, partner_lab_name FROM processing_centers;"
# expect: HYD-01 and VSP-01, status 'onboarding', partner_lab_name empty

# The barcode uniqueness change: partial index, NULLs allowed
psql "$SUPABASE_DB_URL" -c "
SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename='samples' AND indexname='uq_samples_barcode';"
# expect: UNIQUE, and the definition must end WHERE (barcode IS NOT NULL)
```

## Step 5 — Sanity-check the barcode change under real constraints

Samples are now created at booking time with a NULL barcode, bound later when the
phlebotomist scans a sticker. That only works if multiple NULLs are permitted.

```bash
psql "$SUPABASE_DB_URL" -c "
BEGIN;
INSERT INTO samples (patient_id, status) SELECT id, 'pending_collection' FROM users LIMIT 1;
INSERT INTO samples (patient_id, status) SELECT id, 'pending_collection' FROM users LIMIT 1;
ROLLBACK;"
```

Both inserts must succeed inside the transaction. If the second fails with a duplicate-key
error, the old `UNIQUE` survived and the drop targeted the wrong constraint name — tell me,
because every booking after the first would then fail in production.

---

## What this does NOT cover

- Application behaviour against real data. These checks verify schema, not endpoints.
- Performance of the new indexes at your data volume.
- Whether `assign_booking` is wired into booking creation (tracked separately).
