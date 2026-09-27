# 07 — DATABASE FORENSICS & SCHEMA RECONSTRUCTION

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Authoritative Database Schema & Relationship Audit  
**Verification Level:** STATICALLY VERIFIED against 65 SQL migration files and ORM models  

---

## 1. DATABASE ARCHITECTURE OVERVIEW

The CallMedex persistence tier runs on **PostgreSQL 15+ (Supabase Managed)** with the **PostGIS extension** enabled for spatial queries (`ST_DWithin`, `ST_Distance`).

- **Total Tables:** 86 tables verified across 65 SQL migration scripts in `database/`.
- **Migration Tracking:** Tracked in `schema_migrations` table (`database/task7_schema_migrations_tracking.sql`).
- **Primary Schema Definition Files:**
  - `database/schema.sql`: Core baseline tables (users, roles, bookings, slots, dispatches).
  - `database/task1_processing_center_foundation.sql`: Processing centers, specimen tube types, custody batches, and lab reports (550+ lines).
  - `database/task2_mediassist_integration.sql`: `report_jobs` and `mediassist_inbound_requests`.
  - `database/task11_patient_dashboard_upgrade.sql`: Longitudinal biomarkers, doctor briefings, SOS alerts, medications.
  - `database/catalog_master_data.sql`: Master catalog of tests and home services (99.4 KB).

---

## 2. COMPREHENSIVE DOMAIN TABLE CATALOG

### Group 1: Identity & Multi-Role Profiles
| Table Name | Primary Key | Foreign Keys | Key Columns | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `users` | `id (UUID)` | None | `email`, `mobile`, `role`, `password_hash`, `token_version`, `is_active`, `city`, `district` | Master account ledger for all 12 roles. |
| `patients` | `id (UUID)` | `user_id -> users.id` | `blood_group`, `abha_number`, `medical_history`, `height_cm`, `weight_kg` | Patient-specific clinical demographics. |
| `doctors` | `id (UUID)` | `user_id -> users.id` | `medical_license_number`, `specialization`, `consultation_fee`, `home_visit_fee`, `is_verified` | Doctor professional qualifications & rates. |
| `phlebotomists`| `id (UUID)` | `user_id -> users.id` | `phleb_type` (full/part time), `certification_number`, `is_on_duty`, `current_lat`, `current_lng` | Specimen collector credentials & state. |
| `nurses` | `id (UUID)` | `user_id -> users.id` | `nursing_license_number`, `specializations`, `home_visit_fee`, `is_verified` | Field nursing certifications & rates. |
| `pharmacies` | `id (UUID)` | `user_id -> users.id` | `pharmacy_name`, `drug_license_number`, `gst_number`, `home_delivery`, `service_radius_km`| Retail pharmacy registration & radius. |
| `organizations`| `id (UUID)` | `user_id -> users.id` | `organization_name`, `organization_type`, `license_number`, `total_branches`, `is_verified`| Hospitals, polyclinics, diagnostic labs. |
| `staff` | `id (UUID)` | `user_id -> users.id`, `organization_id -> organizations.id` | `staff_role`, `department` | Clinic receptionists & lab technicians. |
| `family_members`| `id (UUID)`| `user_id -> users.id` | `full_name`, `relationship`, `is_self`, `gender`, `date_of_birth`, `address`, `city`, `district` | Patient family sub-profiles & addresses. |

### Group 2: Diagnostic & Laboratory Lifecycle
| Table Name | Primary Key | Foreign Keys | Key Columns | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `processing_centers` | `id (UUID)` | None | `name`, `code`, `city`, `district`, `address`, `lat`, `lng`, `is_active` | Central specimen collection hubs. |
| `processing_center_staff` | `id (UUID)` | `processing_center_id -> processing_centers.id`, `user_id -> users.id` | `role` ('technician', 'supervisor'), `is_active` | Access control for processing centers. |
| `processing_center_areas` | `id (UUID)` | `processing_center_id -> processing_centers.id` | `district`, `city`, `pincode_prefix`, `priority` | Geographic routing rules for bookings. |
| `tube_types` | `id (UUID)` | None | `code` (EDTA, SST, CIT), `cap_color` (Lavender, Yellow), `additive` | Specimen tube color and chemical type. |
| `home_services` | `id (UUID)` | None | `code`, `name`, `category`, `base_price`, `is_active`, `tat_hours` | Catalog of diagnostic tests. |
| `home_service_tubes` | `id (UUID)` | `home_service_id -> home_services.id`, `tube_type_id -> tube_types.id` | `quantity_required` | Defines which tubes are drawn for each test. |
| `booking_subjects` | `id (UUID)` | `booking_id -> bookings.id`, `family_member_id -> family_members.id` | `created_at` | Links booking to exact human patient. |
| `booking_tests` | `id (UUID)` | `booking_id -> bookings.id`, `home_service_id -> home_services.id` | `price_charged`, `source` | Specific lab tests requested in booking. |
| `samples` | `id (UUID)` | `booking_id -> bookings.id`, `tube_type_id -> tube_types.id` | `barcode` (CMX-...), `status`, `collected_at`, `received_at`, `batch_id` | Physical specimen tube tracking entity. |
| `sample_events` | `id (UUID)` | `sample_id -> samples.id` | `event_type`, `actor_id`, `role`, `lat`, `lng`, `metadata`, `created_at` | Immutable physical chain-of-custody audit. |
| `sample_batches` | `id (UUID)` | `processing_center_id -> processing_centers.id` | `batch_code`, `status` ('open', 'sealed', 'in_transit'), `sealed_at` | Cold-box transit batch between PC and lab. |
| `lab_reports` | `id (UUID)` | `booking_id -> bookings.id`, `sample_id -> samples.id` | `file_path`, `file_name`, `status`, `uploaded_by`, `verified_by` | Uploaded diagnostic PDF report files. |
| `report_jobs` | `id (UUID)` | `booking_id -> bookings.id`, `sample_id -> samples.id` | `status` ('queued', 'processing', 'delivered'), `mediassist_job_id` | MediAssist AI report analysis job tracking. |

### Group 3: Bookings & Slots
| Table Name | Primary Key | Foreign Keys | Key Columns | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `slots` | `id (UUID)` | `provider_id -> users.id` | `date`, `start_time`, `end_time`, `is_available`, `capacity` | Provider time slots for clinic visits. |
| `bookings` | `id (UUID)` | `patient_id -> users.id`, `provider_id -> users.id` | `service_type`, `slot_start`, `status`, `total_price`, `collection_district` | Master healthcare appointment record. |
| `booking_history` | `id (UUID)` | `booking_id -> bookings.id` | `old_status`, `new_status`, `changed_by`, `notes`, `created_at` | Full state-transition audit log. |
| `phlebotomist_roster`| `id (UUID)`| `user_id -> users.id`, `processing_center_id -> processing_centers.id` | `shift_date`, `shift_start`, `shift_end`, `status` | Daily duty shifts for field collectors. |

### Group 4: Universal Dispatch & Logistics
| Table Name | Primary Key | Foreign Keys | Key Columns | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `dispatch_requests` | `id (UUID)` | `booking_id -> bookings.id`, `patient_id -> users.id` | `provider_type`, `status`, `patient_lat`, `patient_lng`, `tracking_token` | On-demand field visit dispatch header. |
| `dispatch_offers` | `id (UUID)` | `dispatch_request_id -> dispatch_requests.id`, `provider_id -> users.id` | `status` ('offered', 'accepted', 'declined', 'expired'), `expires_at` | Ephemeral offers rotated among providers. |
| `provider_locations`| `user_id (UUID)`| `user_id -> users.id` | `lat`, `lng`, `is_on_duty`, `battery_level`, `updated_at` | Real-time GPS coordinates of active staff. |
| `kit_items` | `id (UUID)` | None | `name`, `sku`, `unit` | Catalog of phlebotomy kit supplies. |
| `phlebo_stock` | `id (UUID)` | `user_id -> users.id`, `kit_item_id -> kit_items.id` | `quantity_on_hand`, `reorder_level` | Collector physical inventory counter. |

### Group 5: Telemedicine, Financials & AI
| Table Name | Primary Key | Foreign Keys | Key Columns | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `consultations` | `id (UUID)` | `booking_id -> bookings.id`, `doctor_id -> users.id` | `room_url`, `status`, `started_at`, `ended_at` | WebRTC video teleconsultation sessions. |
| `consent_records` | `id (UUID)` | `user_id -> users.id` | `consent_type`, `consent_given`, `consent_text`, `granted_at` | DPDP Act compliant consent ledger. |
| `payments` | `id (UUID)` | `booking_id -> bookings.id`, `patient_id -> users.id` | `amount`, `platform_fee`, `provider_payout`, `razorpay_order_id`, `status` | Razorpay billing and payout breakdown. |
| `settlements` | `id (UUID)` | `provider_id -> users.id`, `payment_id -> payments.id` | `amount`, `status`, `settlement_date` | Provider payout disbursement ledger. |
| `wallet_transactions`| `id (UUID)`| `user_id -> users.id` | `amount`, `transaction_type` ('credit', 'debit'), `balance_after` | Phlebotomist per-sample incentive credits. |
| `pharmacy_inventory`| `id (UUID)`| `pharmacy_id -> users.id` | `name`, `generic_name`, `price`, `stock_quantity`, `requires_prescription` | Dark-store medicine stock catalog. |
| `pharmacy_orders` | `id (UUID)` | `patient_id -> users.id`, `pharmacy_id -> users.id` | `total_amount`, `generic_savings`, `status`, `delivery_otp` | Prescription medicine fulfillment order. |
| `patient_biomarkers`| `id (UUID)`| `patient_id -> users.id` | `marker_name` (HbA1c), `value`, `unit`, `status` (normal/high), `test_date` | Longitudinal lab result trend data. |
| `emergency_sos_alerts`| `id (UUID)`| `patient_id -> users.id` | `lat`, `lng`, `status`, `triggered_at`, `resolved_at` | Active emergency panic events. |
| `mediassist_inbound_requests`| `id (UUID)`| None | `idempotency_key`, `endpoint`, `request_hash`, `response_payload`, `status_code` | MediAssist callback idempotency cache. |

---

## 3. DATABASE INTEGRITY & CONCURRENCY CONSTRAINTS

1. **Unique Barcodes:** `samples.barcode` has a strict `UNIQUE` constraint preventing duplicate specimen identification in the lab.
2. **Idempotent Webhooks:** `mediassist_inbound_requests.idempotency_key` has a `UNIQUE` index ensuring zero duplicate processing of MediAssist callbacks.
3. **Duplicate Booking Prevention:** `bookings` has a partial index `idx_bookings_unique_active_slot` on `(provider_id, slot_start) WHERE status NOT IN ('cancelled', 'no_show')` to mitigate concurrent double bookings.
4. **Single Active Duty Location:** `provider_locations.user_id` is the primary key; updates are atomic upserts.
