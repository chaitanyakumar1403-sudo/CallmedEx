# Processing Center Foundation — Entity, Assignment, Home-Service Catalog & Sample Lifecycle

**Date:** 2026-07-28
**Status:** Draft — awaiting owner review before implementation planning
**Branch:** `feature/processing-center-foundation`
**Program context:** Spec 1 of a 3-spec decomposition of "Task 1 — Processing Center
Architecture & Blood Collection Workflow". This spec builds the data model, auth and
services. Spec 2 builds the Processing Center dashboard. Spec 3 updates the
phlebotomist and patient dashboards. Specs 2 and 3 both depend on this one; they do
not depend on each other.

---

## 1. Purpose & Scope

Introduce the Processing Center as the operational layer between phlebotomists and
partner laboratories, and make CallMedex the owner of everything a patient sees for
home services.

The patient books a blood test from CallMedex. They never see a processing center, a
partner laboratory, or a diagnostic center anywhere in the home-collection flow. Those
are internal operational entities.

### In scope

- `processing_centers`, its staff logins, and its serviceable areas.
- `processing_center` role and a PC-scoped auth dependency.
- Admin-only provisioning of centres and their staff. No self-signup.
- `home_services` — the CallMedex-owned catalog of phlebo-delivered services, with
  tube requirements and admin-set per-city pricing.
- Family members, booking subjects, and per-subject test lines.
- Automatic booking → processing centre assignment, with a coverage gate and demand
  capture for unserviced cities.
- Sample lifecycle extension: one sample per (subject × tube type), created at booking
  time, barcode bound at scan.
- Batch model for the centre → laboratory leg.
- Full chain-of-custody event chain.
- Phlebotomist ↔ centre binding, and the dispatch filter that follows from it.
- Advance rostering: next-day bookings assigned the evening before, off the phlebo's
  base location, with a decline-and-reassign path.
- Schema-only groundwork for future report automation.

### Out of scope

| Deferred | Where it lands |
|---|---|
| Processing Center dashboard UI, verification screen, batch screens, queue, tiles | Spec 2 |
| Phlebotomist dashboard changes, patient dashboard status rail | Spec 3 |
| MocDoc browser automation, report fetching, report notifications | Future task — tables only here |
| Kit return, end-of-day inventory return, reconciliation, returned-kit verification | Explicitly excluded by the task brief |
| Report retrieval of any kind | Task ends at "Sent To Laboratory" |

---

## 2. The Two Service Families

The single most important boundary in this design. Getting it wrong collapses the
existing marketplace.

| | **Home services** | **Walk-in services** |
|---|---|---|
| Examples | Blood tests, ECG, home vitals | MRI, CT, X-Ray, USG, 2D Echo, Mammography |
| Delivered by | Phlebotomist at the patient's address, processed at a Processing Center | Diagnostic center; the patient travels |
| Catalog owned by | CallMedex admin | The diagnostic center |
| Price set by | CallMedex admin | The diagnostic center |
| Patient sees a provider? | **Never** | Yes — center name, price, comparison |
| Table | new `home_services` | existing `provider_services` — **unchanged** |

The existing marketplace (`provider_services`, center browsing, per-center pricing,
`partner_discount_pct`) keeps running exactly as it does today for walk-in services.
Nothing is removed from it. It simply stops applying to anything a phlebotomist
delivers.

This is what "remove the dependency where diagnostic centers publish services" means in
practice: it applies to home services only.

---

## 3. Data Model

### 3.1 Processing centres

```sql
processing_centers (
  id UUID PK,
  code TEXT UNIQUE NOT NULL,              -- 'HYD-01', 'VSP-01'
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT, pincode TEXT, state TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  partner_lab_name TEXT DEFAULT '',       -- internal only, never in a patient payload
  partner_lab_reference TEXT DEFAULT '',
  daily_capacity INT DEFAULT 0,           -- drives Spec 2's capacity tile
  status TEXT NOT NULL DEFAULT 'onboarding'
      CHECK (status IN ('onboarding', 'active', 'paused', 'closed')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)

processing_center_staff (
  id UUID PK,
  processing_center_id UUID NOT NULL REFERENCES processing_centers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pc_role TEXT NOT NULL CHECK (pc_role IN ('admin', 'technician')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  UNIQUE (processing_center_id, user_id)
)
```

`users.role` CHECK gains `processing_center`. Both the `schema.sql` and
`complete_supabase_schema.sql` constraint definitions must be updated.

A centre is an operational entity, not a person. Several people log in to HYD-01, and
the chain-of-custody actor is the individual, not the centre.

**Centres are created only by a CallMedex admin.** There is no processing-center
signup route, no MOU flow, no verification pipeline entry. The admin creates the centre
and provisions staff logins through the existing `app/services/magic_link.py` service.
Adding HYD-02 alongside HYD-01 when volume justifies it is a row insert — never a code
change.

### 3.2 Serviceable areas

```sql
processing_center_areas (
  id UUID PK,
  processing_center_id UUID NOT NULL REFERENCES processing_centers(id) ON DELETE CASCADE,
  city TEXT,                       -- normalised, lowercase
  pincode TEXT,                    -- nullable; when set, it is the strongest match
  radius_km NUMERIC(6,2),          -- nullable; geo fallback around the centre
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN DEFAULT true
)

city_aliases (
  alias TEXT PRIMARY KEY,          -- 'vizag'
  canonical_city TEXT NOT NULL     -- 'visakhapatnam'
)
```

Today one row per centre keyed on city reproduces the "one PC per city" rollout
exactly. `city_aliases` is what stops `Vizag` / `Visakhapatnam` / `VISAKHAPATNAM` from
silently failing to resolve.

### 3.3 Home-service catalog — CallMedex owned

```sql
tube_types (
  code TEXT PRIMARY KEY,           -- 'edta_lavender', 'sst_gold', 'citrate_blue',
                                   -- 'fluoride_grey', 'plain_red'
  name TEXT NOT NULL,
  cap_colour TEXT, additive TEXT,
  typical_volume_ml NUMERIC(5,2),
  is_active BOOLEAN DEFAULT true
)

home_services (
  id UUID PK,
  catalog_id UUID REFERENCES service_catalog(id) ON DELETE SET NULL,
  code TEXT UNIQUE NOT NULL,       -- 'CBC'
  service_kind TEXT NOT NULL DEFAULT 'blood_test'
      CHECK (service_kind IN ('blood_test', 'ecg', 'vitals')),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'blood_test',
  description TEXT DEFAULT '',
  base_price NUMERIC(10,2) NOT NULL,
  urgent_surcharge_override NUMERIC(10,2),      -- nullable; falls back to platform knob
  home_collection_available BOOLEAN DEFAULT true,
  fasting_required BOOLEAN DEFAULT false,
  fasting_hours INT DEFAULT 0,
  preparation_instructions TEXT DEFAULT '',
  estimated_report_hours INT,
  is_active BOOLEAN DEFAULT true,               -- the enable/disable switch
  created_by UUID, updated_by UUID,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)

home_service_tubes (
  home_service_id UUID REFERENCES home_services(id) ON DELETE CASCADE,
  tube_type_code TEXT REFERENCES tube_types(code),
  volume_ml NUMERIC(5,2),
  PRIMARY KEY (home_service_id, tube_type_code)
)

home_service_city_pricing (
  id UUID PK,
  home_service_id UUID NOT NULL REFERENCES home_services(id) ON DELETE CASCADE,
  processing_center_id UUID NOT NULL REFERENCES processing_centers(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  UNIQUE (home_service_id, processing_center_id)
)
```

**Naming:** the table is `home_services`, not `blood_tests`. Task 1 seeds and exposes
only `service_kind = 'blood_test'`; ECG and home vitals are later rows, not a later
migration. `home_service_tubes` is meaningful only for the `blood_test` kind.

**Catalog CRUD is admin-only.** A Processing Center reads the catalog — useful during
verification, to know that this booking should have produced a lavender EDTA tube — but
cannot alter a clinical definition or a price. `home_service_city_pricing` lets CallMedex
price Vizag differently from Hyderabad; the centre has no write access to it.

`catalog_id` links each home service to the existing `service_catalog` row so the
synonym search already in place ("Haemogram" → CBC, "TFT" → Thyroid Profile) keeps
working without duplication. `service_catalog` remains the naming and synonym
dictionary spanning both service families; `home_services` is the orderable,
CallMedex-priced product.

Seed the ten named tests — CBC, LFT, KFT, Lipid Profile, HbA1c, Thyroid Profile,
Vitamin D, Vitamin B12, ESR, CRP — joining to existing `service_catalog` rows where a
slug already matches. ESR and CRP are new to `service_catalog` and need rows there too.

### 3.4 Family members and booking subjects

```sql
family_members (
  id UUID PK,
  account_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT DEFAULT '',          -- 'self', 'mother', 'spouse', ...
  gender TEXT DEFAULT '',
  date_of_birth DATE,
  mobile TEXT DEFAULT '',
  abha_number TEXT DEFAULT '',           -- future per-member ABHA linkage
  is_self BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)

booking_subjects (
  id UUID PK,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  family_member_id UUID NOT NULL REFERENCES family_members(id),
  UNIQUE (booking_id, family_member_id)
)

booking_tests (
  id UUID PK,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  booking_subject_id UUID NOT NULL REFERENCES booking_subjects(id) ON DELETE CASCADE,
  home_service_id UUID NOT NULL REFERENCES home_services(id),
  price_charged NUMERIC(10,2) NOT NULL,
  urgent_surcharge NUMERIC(10,2) DEFAULT 0.00,
  source TEXT NOT NULL DEFAULT 'booking'
      CHECK (source IN ('booking', 'doorstep_addon')),
  added_by UUID REFERENCES users(id),    -- the phlebo, for doorstep add-ons
  added_at TIMESTAMPTZ,
  UNIQUE (booking_subject_id, home_service_id)
)
```

An `is_self` row is auto-created for the account holder on first booking, so every
booking subject is uniformly a `family_members` row. This is what makes "each patient
receives a separate barcode, separate sample, separate report" fall out of the schema
rather than requiring special-casing for the account holder.

`booking_tests.source = 'doorstep_addon'` with `added_by` is the hook Spec 3 uses for
add-on tests at the doorstep, and it is what the existing `PHLEBO_UPSELL_SVC` incentive
rule already expects to find.

### 3.5 Booking extension

```sql
ALTER TABLE bookings
  ADD COLUMN processing_center_id UUID REFERENCES processing_centers(id),
  ADD COLUMN booking_kind TEXT DEFAULT 'legacy'
      CHECK (booking_kind IN ('legacy', 'home_collection', 'walk_in'));
```

`bookings.provider_id` is `NOT NULL` today and is referenced across existing queries.
Rather than loosen the constraint, a home-collection booking sets
`provider_id = processing_center_id` and `provider_type = 'processing_center'`, with
`processing_center_id` as the real, explicit reference used by all new code. No
patient-facing response reads either column.

### 3.6 Samples

The existing `samples` / `sample_events` / `sample_handovers` tables from
`database/phase1_sample_lifecycle.sql` are extended in place. The phlebo wallet payout
path (`uq_wallet_tx_sample_reason`) and the existing tracking endpoints keep working
throughout.

```sql
ALTER TABLE samples
  ADD COLUMN processing_center_id UUID REFERENCES processing_centers(id),
  ADD COLUMN booking_subject_id UUID REFERENCES booking_subjects(id) ON DELETE CASCADE,
  ADD COLUMN tube_type_code TEXT REFERENCES tube_types(code),
  ADD COLUMN expected_tube_type_code TEXT REFERENCES tube_types(code),
  ADD COLUMN tube_mismatch_ack BOOLEAN DEFAULT false,
  ADD COLUMN batch_id UUID REFERENCES sample_batches(id) ON DELETE SET NULL,
  ADD COLUMN verified_at TIMESTAMPTZ,
  ADD COLUMN verified_by UUID REFERENCES users(id),
  ADD COLUMN verification JSONB DEFAULT '{}',
  ADD COLUMN rejection_code TEXT,
  ADD COLUMN sent_to_lab_at TIMESTAMPTZ,
  ADD COLUMN lab_reference TEXT DEFAULT '',
  ADD COLUMN report_status TEXT DEFAULT 'pending';

sample_tests (
  sample_id UUID REFERENCES samples(id) ON DELETE CASCADE,
  booking_test_id UUID REFERENCES booking_tests(id) ON DELETE CASCADE,
  PRIMARY KEY (sample_id, booking_test_id)
)
```

**Grain: one sample row per (booking subject × tube type).** A patient booking
CBC + LFT + KFT for themselves and CBC for their mother produces three rows — one
lavender EDTA (CBC) and one SST (LFT + KFT) for the patient, one lavender EDTA for the
mother — with `sample_tests` recording which ordered tests ride on which tube.

The barcode is on a tube, so the barcode is on the row that represents a tube. This is
what makes "Tube Type Correct?" answerable, makes a partial rejection representable
(one hemolysed tube of three), and gives the future MocDoc lookup a barcode that maps
to exactly what the laboratory received.

**Samples are created at booking time**, not at collection, with
`expected_tube_type_code` derived from `home_service_tubes` and
`status = 'pending_collection'`. Consequences:

- `samples.barcode` becomes nullable — it is bound when the phlebo scans a physical
  pre-printed sticker. The existing `NOT NULL UNIQUE` is replaced by a partial unique
  index on `barcode WHERE barcode IS NOT NULL`.
- The centre knows tomorrow's expected tube count before anything is collected, which
  is what Spec 2's booking queue and capacity tiles read.
- Smart validation at scan time is a comparison of `tube_type_code` against
  `expected_tube_type_code` on a row that already exists, rather than a lookup.

Status CHECK widens to:

```
pending_collection → collected → in_transit → received
                                            → verified → batched → sent_to_lab
                                            → rejected
```

with `report_pending` and `report_ready` reserved for the future task. `handover_requested`,
`processing` and the old `report_ready` value are retained for existing rows and mapped
during migration.

`verification` JSONB records the five-point check as booleans with the actor and
timestamp: `tube_received`, `barcode_match`, `tube_type_correct`, `label_present`,
`sample_quality_acceptable`.

`rejection_code` is constrained to: `wrong_tube`, `barcode_missing`, `label_missing`,
`broken_tube`, `leaking_tube`, `hemolyzed`, `insufficient_sample`, `other`.

### 3.7 Batches — the centre → laboratory leg

```sql
sample_batches (
  id UUID PK,
  batch_code TEXT UNIQUE NOT NULL,        -- 'HYD-01/2026-07-28/001'
  processing_center_id UUID NOT NULL REFERENCES processing_centers(id),
  laboratory_name TEXT DEFAULT '',        -- internal only
  laboratory_org_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open', 'sealed', 'sent_to_lab', 'acknowledged', 'cancelled')),
  sample_count INT DEFAULT 0,
  created_by UUID, created_at TIMESTAMPTZ,
  sealed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ, sent_by UUID,
  courier_reference TEXT DEFAULT '',
  notes TEXT DEFAULT ''
)
```

Only verified samples may join a batch. Sealing a batch is what makes it immutable;
`sent_to_lab` is the terminal state of this entire task.

`sample_handovers` is retained and repurposed as the **phlebo → centre transit
manifest**, with `destination_org_user_id` superseded by a new
`destination_processing_center_id`. The two legs stay separate tables because they
carry genuinely different fields — GPS and OTP on the inbound leg, courier reference on
the outbound.

### 3.8 Chain of custody

`sample_events` is reused. Its event CHECK widens to the full chain:

```
registered → assigned → collected → barcode_bound → in_transit
           → received → verified | rejected → batched → sent_to_lab
```

Every row already carries `actor_id`, `actor_role`, `lat`, `lng`, `photo_url` and
`created_at`. Add `location_label TEXT` (a human-readable place, e.g. the collection
address or "HYD-01 intake desk") and `processing_center_id`, so a custody timeline is
readable without reverse-geocoding.

The custody log is append-only. No endpoint updates or deletes a `sample_events` row.

### 3.9 Coverage demand capture

```sql
service_area_requests (
  id UUID PK,
  user_id UUID REFERENCES users(id),      -- nullable; guests may request
  mobile TEXT NOT NULL,
  city TEXT, pincode TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  requested_service_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ
)
```

This is the demand list that answers "which city has earned a centre next", and it is
the same signal that justifies a second centre in an existing city.

### 3.10 Future report automation — tables only

```sql
lab_reports (
  id UUID PK,
  sample_id UUID REFERENCES samples(id) ON DELETE CASCADE,
  booking_subject_id UUID REFERENCES booking_subjects(id),
  barcode TEXT,
  source TEXT DEFAULT 'mocdoc_automation',
  status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'fetching', 'ready', 'failed', 'manual')),
  file_url TEXT DEFAULT '',
  fetched_at TIMESTAMPTZ,
  attempts INT DEFAULT 0,
  last_error TEXT DEFAULT '',
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)

report_fetch_jobs (
  id UUID PK,
  sample_id UUID REFERENCES samples(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
      CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'abandoned')),
  scheduled_for TIMESTAMPTZ,
  attempts INT DEFAULT 0,
  last_error TEXT DEFAULT '',
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
```

**No worker, no automation, no endpoint is implemented in this spec.** These tables and
the `report_status` column on `samples` exist so the MocDoc agent can later be added
without redesigning the workflow.

---

## 4. Services

### 4.1 `app/services/processing_center.py`

One module, three responsibilities, each independently testable.

```
resolve_center(city, pincode, lat, lng) -> ProcessingCenter | None
```
Resolution order, first match wins:
1. Active `processing_center_areas` row with an exact `pincode` match.
2. Active row whose `city` matches the normalised input, resolved through `city_aliases`.
3. Nearest active centre whose `radius_km` covers the point, by haversine.

Ties break on `priority` ascending, then distance ascending. This is what lets HYD-02
be added later as data.

```
check_coverage(city, pincode, lat, lng) -> {serviceable: bool}
```
The patient-facing wrapper. **Returns a boolean and nothing else** — no centre id, no
centre name, no laboratory name. This is the seam where a leak would be easiest, so it
is deliberately a different function from `resolve_center`.

```
assign_booking(booking_id) -> processing_center_id
```
Called during booking creation. Sets `processing_center_id`, `provider_id`,
`provider_type`, derives the required tubes for every `booking_test`, creates the
`samples` rows at `pending_collection` with their `expected_tube_type_code`, and writes
a `registered` custody event per sample. Idempotent — re-running on an already-assigned
booking is a no-op rather than a duplicate sample set.

### 4.2 Tube derivation

Given the `booking_tests` for one subject, group by `tube_type_code` from
`home_service_tubes`, and emit one sample per distinct tube type. A test requiring two
tube types contributes to two samples. This is a pure function over the catalog, so it
is unit-testable without a database.

### 4.3 Dispatch binding

```sql
ALTER TABLE phlebotomists
  ADD COLUMN processing_center_id UUID REFERENCES processing_centers(id),
  ADD COLUMN base_lat DOUBLE PRECISION,      -- home / start point, set at signup
  ADD COLUMN base_lng DOUBLE PRECISION,
  ADD COLUMN base_pincode TEXT DEFAULT '';
```

`processing_center_id` supersedes `home_lab_org_user_id` as the routing key. The old
column is retained but no longer read by the home-collection path.

The centre filter applies to **every** home-collection assignment: a phlebo is only ever
considered for a booking whose `processing_center_id` matches their own. The city
distribution follows from this — a Vizag phlebo is never offered a Hyderabad job
regardless of distance, because they could not submit the tube afterwards.

There are three assignment modes, distinguished by
`dispatch_requests.assignment_mode ∈ (advance, realtime, urgent)`.

**Advance (next-day slots) — the default path.** See Section 4.4.

**Realtime (same-day slots).** The existing offer/accept flow.
`UniversalDispatchEngine.find_candidates` gains the centre filter; candidates are
on-duty phlebos of that centre within 10 km of the collection address by **live**
location. The 10 km default and the haversine helper already exist at
`app/services/dispatch_engine.py:121` and `:85`.

**Urgent.** Bypasses the distance cap entirely and fans out to every on-duty phlebo of
the booking's centre, replacing `URGENT_RADIUS_MULTIPLIER = 2.0` for home-collection
dispatch. "All of them" is centre-scoped by design: notifying a Hyderabad phlebo about
a Vizag urgent tube is noise, and the tube could not be submitted anywhere valid. The
multiplier is retained for the non-home-collection dispatch paths that still use it.

**Urgent pricing** reuses `platform_settings.urgent_surcharge` through the existing
`PricingService.urgent_surcharge_for()` at `app/services/marketplace.py:82`, with
`home_services.urgent_surcharge_override` taking precedence when set — so an urgent CBC
can be priced differently from an urgent Vitamin D.

### 4.4 Advance rostering — tomorrow's slots assigned today

Tomorrow's bookings are assigned to phlebotomists this evening, not at collection time.
Live GPS is meaningless for a job twelve hours out, so advance assignment anchors on the
phlebo's **base location** instead.

```sql
phlebotomist_roster (
  id UUID PK,
  processing_center_id UUID NOT NULL REFERENCES processing_centers(id),
  phlebotomist_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roster_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
      CHECK (status IN ('available', 'unavailable', 'leave')),
  max_jobs INT DEFAULT 0,                   -- 0 = centre default
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  UNIQUE (phlebotomist_user_id, roster_date)
)

ALTER TABLE dispatch_requests
  ADD COLUMN assignment_mode TEXT NOT NULL DEFAULT 'realtime'
      CHECK (assignment_mode IN ('advance', 'realtime', 'urgent')),
  ADD COLUMN scheduled_for DATE,
  ADD COLUMN declined_by UUID[] DEFAULT '{}';
```

A scheduled job runs at a configurable cutoff — a new
`platform_settings.roster_cutoff` knob, defaulting to 18:00 Asia/Kolkata, alongside the
existing `phlebo_offer_window_minutes` and `phlebo_attendance_deadline` entries. Celery
is already configured at `app/workers/celery_app.py`.

For each centre, the job takes every next-day home-collection booking and assigns it to
the nearest rostered-available phlebo within 10 km of their `base_lat/base_lng`,
balancing by current assigned load so one phlebo does not absorb a whole locality.
Assignment is direct, not an offer — a `dispatch_requests` row at
`assignment_mode = 'advance'` with the provider already set.

The phlebo sees tomorrow's list that evening and **may decline** a job. Declining
appends their id to `declined_by`, returns the request to the roster queue, and triggers
immediate reassignment to the next-nearest available phlebo who is not already in
`declined_by`. A booking that exhausts every candidate surfaces to the centre for manual
assignment rather than silently going unassigned — Spec 2 renders that queue.

Bookings that remain unassigned at the start of the collection day fall back to the
realtime offer flow, so a roster gap degrades to today's behaviour rather than to a
missed collection.

`assign_booking` (Section 4.1) creates the sample rows regardless of mode; rostering
only decides *who* collects, never *what* is collected.

### 4.5 Auth

`app/middleware/pc_auth.py` provides `get_current_pc_staff`, which resolves the JWT user
to an active `processing_center_staff` row and injects `processing_center_id` and
`pc_role`. Every PC endpoint is scoped by the injected centre id — a centre id in a
request path or body is never trusted.

`require_pc_admin` is a thin wrapper rejecting `pc_role = 'technician'`.

---

## 5. API Surface

No UI in this spec. These endpoints are what Specs 2 and 3 consume.

**Admin — centres**
```
POST   /api/admin/processing-centers
GET    /api/admin/processing-centers
PATCH  /api/admin/processing-centers/{id}
POST   /api/admin/processing-centers/{id}/staff        provision a login
DELETE /api/admin/processing-centers/{id}/staff/{uid}
POST   /api/admin/processing-centers/{id}/areas
```

**Admin — catalog**
```
GET    /api/admin/home-services
POST   /api/admin/home-services
PATCH  /api/admin/home-services/{id}                    includes is_active toggle
DELETE /api/admin/home-services/{id}                    see deletion rule below
PUT    /api/admin/home-services/{id}/tubes
PUT    /api/admin/home-services/{id}/pricing/{center_id}
```

**Patient**
```
GET    /api/home-services?city=&q=          price resolved for the city; no centre identity
GET    /api/coverage?city=|lat=&lng=        -> {serviceable: bool}
POST   /api/service-area-requests
GET    /api/family-members
POST   /api/family-members
PATCH  /api/family-members/{id}
DELETE /api/family-members/{id}
```

**Processing centre (read-only in this spec; Spec 2 adds the write paths)**
```
GET    /api/pc/me                            centre profile + staff role
GET    /api/pc/home-services                 read-only catalog
```

**Deletion rule.** "Delete Blood Test" is a soft delete: `is_active = false`, which
removes it from patient search while leaving historical `booking_tests` rows intact and
readable. A hard delete is permitted only when no `booking_tests` row has ever
referenced the service, and is rejected with a clear error otherwise. Disabling a
service never affects a booking already placed against it.

**Roster**
```
GET    /api/pc/roster?date=                  centre's roster for a date
PUT    /api/pc/roster/{date}                 mark phlebos available/leave
POST   /api/pc/roster/{date}/run             force the assignment pass early
GET    /api/phlebo/jobs?date=                phlebo's own advance list
POST   /api/phlebo/jobs/{dispatch_id}/decline
```

---

## 6. Testing

`backend/tests/` already exists with pytest configured.

**Pure unit, no database**
- Tube derivation: the CBC + LFT + KFT + mother's CBC case yields exactly three samples
  with the correct tube types and `sample_tests` mapping.
- City normalisation through `city_aliases`.
- Urgent price resolution: override present, override absent, flat vs percent config.

**Resolver**
- Pincode beats city beats geo.
- Inactive area rows and `paused` centres are never selected.
- A point outside every radius returns `None`.
- Two centres in one city resolve deterministically by priority — proving HYD-02 needs
  no code change.

**Lifecycle**
- Every legal status transition succeeds; illegal ones are rejected.
- Only verified samples may be batched; a sealed batch is immutable.
- A partial rejection leaves sibling samples on the same booking unaffected.
- `assign_booking` is idempotent.
- The custody chain for a completed sample contains every expected event in order,
  each with an actor.

**Rostering**
- A next-day booking is assigned to the nearest available phlebo within 10 km of their
  base, not the nearest by live GPS.
- A phlebo of a different centre is never assigned, even when strictly nearer.
- Load balancing: two phlebos equidistant from a cluster split it rather than one taking
  all of it.
- Declining reassigns to the next-nearest and never re-offers to anyone in `declined_by`.
- Exhausting every candidate surfaces the booking for manual assignment rather than
  leaving it silently unassigned.
- A booking still unassigned on the collection day falls back to the realtime offer flow.
- The roster pass is idempotent — running it twice does not double-assign.

**Leak guards — these are the tests that protect the business model**
- No patient-facing response payload contains `processing_center`, `partner_lab_name`,
  `laboratory_name`, or a centre code. Assert against the serialised JSON of every
  patient route, so a future careless `select("*")` fails the build.
- `/api/coverage` returns only `serviceable`.
- The home-service search and the walk-in provider search never return each other's
  rows.
- No `home_services` row is reachable through `provider_services`.

**Migration**
- Existing `samples` rows survive with a mapped status and a null
  `processing_center_id`.
- The existing wallet payout on handover acceptance still credits exactly once.

---

## 7. Migration

One idempotent migration, `database/task1_processing_center_foundation.sql`. Statement
order matters in two places: `sample_batches` and `booking_subjects` must be created
before the `ALTER TABLE samples` that references them, and `processing_centers` before
everything. Otherwise it follows
the conventions already established in `phase1_sample_lifecycle.sql`: `BEGIN`/`COMMIT`,
`IF NOT EXISTS` throughout, `search_path` pinned on every new function, explicit
deny-all RLS policy on every new table (the FastAPI backend uses the service key and
bypasses RLS; the frontend has no Supabase client), and a closing
`NOTIFY pgrst, 'reload schema'`.

Seed data: five tube types, the ten blood tests with their tube requirements, the
`roster_cutoff` platform setting (default 18:00 Asia/Kolkata), and the two centres
HYD-01 and VSP-01 with one `processing_center_areas` row each. Consistent
with commits `c5d0fb3` and `68ea5eb`, **no fictitious partner laboratory name, staff
account, or verified status is seeded** — `partner_lab_name` stays empty and centres are
seeded at `status = 'onboarding'` until a real admin activates them.

---

## 8. Open Questions

None blocking. Two noted for later specs:

- Whether a second centre in the same city splits by pincode or by load is a Spec 2
  operational question; the schema supports either.
- ABHA linkage per family member (`family_members.abha_number`) is a column now and a
  flow later.
