# 03 — COMPONENT MAP & REPOSITORY INVENTORY

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Complete Structural & Component Inventory  
**Verification Status:** STATICALLY VERIFIED against source code AST and filesystem  

---

## 1. BACKEND ROUTERS INVENTORY (`backend/app/routers/`)

The backend exposes **37 APIRouter modules** mounted onto the main FastAPI application:

| Router File | Lines | Route Prefix | Primary Domain / Purpose | Key Endpoints | Auth Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `provider_management.py`| 2,980 | `/api/providers` | Comprehensive provider directory, branch locations, doctor schedules, practice mappings | `GET /search`, `GET /doctors`, `POST /branches` | Public & Bearer JWT |
| `bookings.py` | 2,935 | `/api/bookings` | Slot booking, partner-blind diagnostic allocation, slot allotment workflow, history | `POST /`, `GET /my`, `POST /{id}/allot-slot` | `get_current_user` |
| `auth.py` | 2,538 | `/api/auth` | User signup, login, password reset, SMS OTP, biometric authentication, MOU acceptance | `POST /signup`, `POST /login`, `POST /otp/verify`| Public & Bearer JWT |
| `dispatch.py` | 1,480 | `/api/dispatch` | Phlebotomist & nurse dispatch, tracking tokens, offer acceptance, status transitions | `POST /request`, `GET /track/{token}`, `POST /offers/{id}/accept` | `get_current_user` & Public |
| `pc_operations.py` | 890 | `/api/pc` | Processing Center sample intake, barcode scan, batch creation, lab transfer, testing | `POST /intake`, `POST /batches`, `POST /verify` | `require_role('staff')` |
| `phlebo_doorstep.py` | 850 | `/api/phlebo` | Phlebotomist collection workflow, patient address lookup, kit barcode assignment | `GET /active-job`, `POST /collect`, `POST /handover` | `require_role('phlebotomist')` |
| `patient_ai.py` | 680 | `/api/patient/ai` | AI clinical triage, biomarker trends, doctor briefing generation, symptoms chat | `POST /triage`, `GET /biomarkers`, `GET /briefing` | `get_current_user` |
| `mediassist_inbound.py` | 676 | `/api/v1/integrations/mediassist` | Inbound callbacks from MediAssist AI: report OCR status, delivery, WhatsApp booking | `POST /callbacks/*`, `POST /whatsapp-bookings` | `verify_mediassist_signature` |
| `telemedicine.py` | 550 | `/api/telemed` | Video room generation (Daily.co), digital consent, e-prescription generation | `POST /rooms`, `POST /finalize`, `GET /prescriptions` | `get_current_user` |
| `admin_analytics.py` | 540 | `/api/admin/analytics`| High-level platform KPIs, revenue splits, geographic density, clinical turnaround | `GET /kpi`, `GET /revenue`, `GET /geographic` | `check_admin_access` |
| `roster.py` | 510 | `/api/pc/roster` | Phlebotomist shift scheduling, leave management, automated roster generation | `GET /`, `PUT /{id}`, `POST /generate` | `require_role('staff')` |
| `pharmacy_orders.py` | 490 | `/api/pharmacy` | Pharmacy inventory management, prescription upload, order fulfillment, generic savings| `GET /orders`, `POST /inventory`, `GET /savings` | `require_role('pharmacy')` |
| `samples.py` | 480 | `/api/samples` | Barcode verification, custody event logging, sample status inquiries | `GET /{barcode}`, `GET /{id}/events` | `get_current_user` |
| `admin.py` | 511 | `/api/admin` | User management, supervisor management, global metrics, fraud quality control | `GET /metrics`, `GET /users`, `POST /supervisors` | `check_admin_access` |
| `ai_reports.py` | 460 | `/api/reports` | Clinical report PDF upload, OpenRouter OCR, clinical summary generation | `POST /upload`, `POST /analyze`, `GET /{id}` | `get_current_user` |
| `patient_samples.py` | 390 | `/api/patient/samples`| Patient view of collected specimens, live tracking, estimated report completion | `GET /`, `GET /{id}/track` | `get_current_user` |
| `patient_sos.py` | 370 | `/api/patient/sos` | Emergency SOS trigger, trusted emergency contact notifications, ambulance alert | `POST /trigger`, `GET /contacts`, `POST /contacts` | `get_current_user` |
| `verification.py` | 380 | `/api/verification` | Upload and verify provider identity, medical degrees, council licenses (AI + Gov) | `POST /verify`, `POST /aadhaar`, `POST /liveness` | `get_current_user` |
| `patient_handoff.py` | 340 | `/api/patient/handoff`| Shift change handover between nursing staff, clinical vitals summary | `POST /`, `GET /active` | `get_current_user` |
| `processing_center_admin.py`| 330 | `/api/admin/processing-centers`| Processing Center master records, staff assignment, district area mappings | `POST /`, `GET /`, `PUT /{id}` | `check_admin_access` |
| `provider_scope.py` | 310 | `/api/provider-scope`| Custom tariff and scope of service configuration for clinical partners | `GET /`, `PUT /update-tariffs` | `get_current_user` |
| `phlebo_stats.py` | 280 | `/api/phlebo/stats` | Phlebotomist collection count, earnings, payout ledger, ratings | `GET /daily`, `GET /earnings` | `require_role('phlebotomist')` |
| `lab_team.py` | 270 | `/api/lab-team` | Organization lab technicians, phlebotomist team invitations, affiliations | `GET /mine`, `POST /invite`, `POST /join` | `require_role('organization')` |
| `communications.py` | 260 | `/api/communications`| Push notifications, in-app notification center, SMS dispatch history, telephony | `GET /notifications`, `POST /webhook/telephony` | `get_current_user` & Public |
| `phlebo_stock.py` | 240 | `/api/phlebo/stock` | Phlebotomist collection kit inventory (vacutainers, needles, alcohol swabs) | `GET /`, `POST /replenish`, `POST /decrement`| `require_role('phlebotomist')` |
| `home_services.py` | 230 | `/api/home-services`| Master catalog of home-deliverable tests and procedures, tube requirements | `GET /catalog`, `GET /{id}/tubes` | Public |
| `care_circle.py` | 210 | `/api/care-circle` | Chronic disease management care team (doctor, nurse, family guardian) | `GET /`, `POST /add-member` | `get_current_user` |
| `payments.py` | 144 | `/api/payments` | Razorpay order creation, client-side signature verification, transactions | `POST /create-order`, `POST /verify`, `GET /my` | `get_current_user` |
| `patient_health.py` | 170 | `/api/patient/health` | Longitudinal vitals recording (BP, Sugar, SpO2, Heart Rate) | `GET /vitals`, `POST /vitals` | `get_current_user` |
| `marketplace.py` | 160 | `/api/marketplace` | Regional pricing rules, district mapping, commission splits | `GET /pricing`, `GET /districts` | Public |
| `nurse_visits.py` | 150 | `/api/nurse` | Nursing clinical notes, wound dressing logs, injection verification | `GET /jobs`, `POST /complete-visit` | `require_role('nurse')` |
| `family_members.py` | 130 | `/api/family` | Family member sub-profiles, relationships, independent addresses | `GET /`, `POST /`, `DELETE /{id}` | `get_current_user` |
| `admin_verification.py`| 130 | `/api/admin/verification`| Admin review queue for flagged provider credentials and manual approvals | `GET /pending`, `POST /{id}/approve` | `check_admin_access` |
| `device_tokens.py` | 120 | `/api/devices` | FCM and APNs push notification token registration and unregistration | `POST /register`, `POST /unregister` | `get_current_user` |
| `insurance.py` | 110 | `/api/insurance` | ABHA policy discovery, cashless claim status (NHCX mock) | `GET /policy`, `POST /claims` | `get_current_user` |
| `ai_features.py` | 80 | `/api/ai` | Helper endpoints for voice scribe and prescription translation | `POST /scribe` | `get_current_user` |

---

## 2. DOMAIN SERVICES INVENTORY (`backend/app/services/`)

The core business logic is encapsulated in **48 services**:

| Service Name | File | Primary Responsibility | Upstream Callers | Downstream Callees |
| :--- | :--- | :--- | :--- | :--- |
| `UniversalDispatchEngine` | `dispatch_engine.py` | Spatial matching, offer rotation, tracking token issuance | `routers/dispatch.py`, `routers/bookings.py` | `services/email.py`, `services/otp.py`, `Supabase` |
| `MarketplaceService` | `marketplace.py` | Partner-blind diagnostic allocation, fee derivation | `routers/bookings.py`, `routers/marketplace.py` | `Supabase` |
| `SampleService` | `samples.py` | Barcode minting, specimen FSM transitions, custody log | `routers/pc_operations.py`, `routers/samples.py` | `services/wallet.py`, `Supabase` |
| `PaymentService` | `payment.py` | Razorpay order generation, signature crypto verification | `routers/payments.py` | `Razorpay SDK`, `Supabase` |
| `EmailService` | `email.py` | Digital MOU delivery, dispatch notifications, verification | `routers/auth.py`, `services/dispatch_engine.py`| `Resend SDK`, `SMTP` |
| `LegalService` | `legal.py` | Cryptographic MOU manifest, acceptance hash verification | `routers/auth.py` | `services/mou_loader.py`, `Supabase`|
| `MouLoader` | `mou_loader.py` | Parses Markdown and HTML legal contracts for 12 roles | `services/legal.py` | Local filesystem (`legal_docs/`) |
| `AiOcrService` | `ai_ocr.py` | Gemini Vision extraction of medical degrees and Aadhaar | `routers/verification.py` | `Google GenerativeAI SDK` |
| `GroqReportAnalyzer` | `groq_report_analyzer.py` | Medical report analysis via Qwen / DeepSeek / Groq | `routers/ai_reports.py` | `OpenRouter API`, `Groq API` |
| `OpenRouterClient` | `openrouter_client.py` | Resilient multi-model gateway with exponential fallback | `services/groq_report_analyzer.py` | `OpenRouter HTTP` |
| `TelemedicineService` | `telemedicine.py` | Daily.co room creation, token issuance, Jitsi fallback | `routers/telemedicine.py` | `Daily.co REST API` |
| `PushNotificationService`| `push.py` | FCM HTTP v1 and APNs token-based push messaging | `services/notification_engine.py` | `Google Auth`, `FCM`, `APNs HTTP/2` |
| `NotificationEngine` | `notification_engine.py` | Multi-channel dispatch (Push, In-App, SMS, WhatsApp) | `routers/communications.py`, `routers/dispatch.py`| `push.py`, `sms_otp.py`, `mediassist_client.py` |
| `SmsOtpService` | `sms_otp.py` | MSG91 OTP generation, verification, and rate limiting | `routers/auth.py` | `MSG91 REST API`, `Supabase` |
| `GovRegistryService` | `gov_registry.py` | NMC and Nursing council credential verification | `routers/verification.py` | `NMC REST API` (or mock) |
| `ProcessingCenterService`| `processing_center.py`| Assigns bookings to nearest PC, district resolution | `routers/bookings.py`, `routers/pc_operations.py`| `Supabase` |
| `RosterService` | `roster.py` | Phlebotomist shift scheduling and automated assignment | `routers/roster.py`, `workers/tasks/roster.py` | `Supabase` |
| `ScopeCatalogService` | `scope_catalogs.py` | Manages 160+ clinical procedure tariffs and splits | `routers/provider_scope.py` | `Supabase` |
| `StorageService` | `storage.py` | Generates presigned URLs for private Supabase buckets | `routers/ai_reports.py`, `routers/verification.py`| `Supabase Storage S3 API` |
| `TelephonyService` | `telephony.py` | Initiates virtual masked phone calls | `routers/communications.py` | `Exotel API` / `Twilio API` |
| `WalletService` | `wallet.py` | Manages provider credit ledger for verified collections | `services/samples.py` | `Supabase` |
| `AuditService` | `audit.py` | Writes immutable administrative audit log entries | `routers/mediassist_inbound.py`, `routers/admin.py`| `Supabase` |

---

## 3. ASYNCHRONOUS WORKER TASKS (`backend/app/workers/tasks/`)

| Task Module | Registered Task Name | Trigger / Frequency | Payload / Input | Persistent Side Effect |
| :--- | :--- | :--- | :--- | :--- |
| `scheduled_dispatch.py` | `scheduled_dispatch_sweep` | Cron: Every 5 minutes | None (Queries DB) | Transitions bookings to `searching`, raises dispatch offers |
| `dispatch.py` | `rotate_unaccepted_offers` | Interval: Every 60s | None (Queries DB) | Cancels expired offers, notifies next provider in queue |
| `roster.py` | `generate_daily_roster` | Cron: Daily at 00:00 UTC | `target_date` | Inserts shifts into `phlebotomist_roster` |
| `payments.py` | `process_pending_settlements` | Cron: Daily at 02:00 IST | None (Queries DB) | Updates `payments` status to `settled`, writes `settlements` |
| `payments.py` | `send_payment_receipt` | Event: Post-payment | `patient_mobile`, `amount`, `booking_id` | Calls `mediassist_client.send_notification` (WhatsApp) |
| `notifications.py` | `send_appointment_reminders` | Cron: Every 15 minutes | None (Queries DB) | Sends WhatsApp & Push reminders for upcoming appointments |
| `cleanup.py` | `cleanup_stale_dispatches` | Cron: Hourly | None | Cancels unassigned requests older than 24 hours |
| `attendance.py` | `mark_absent_phlebotomists`| Cron: Daily at 12:00 IST | None | Marks rostered staff with no check-in as absent |
| `report_retry.py` | `retry_failed_report_jobs` | Interval: Every 10 minutes | None | Retries transient OCR failures against OpenRouter |

---

## 4. FRONTEND APPLICATIONS INVENTORY

### Next.js Web Application (`frontend/`)
- **Route Layout Structure:**
  - `src/app/layout.tsx`: Root shell, toast provider (Sonner), global theme.
  - `src/app/(public)/`: Public marketing site, service listings, diagnostic catalog, partner onboarding.
  - `src/app/(app)/dashboard/`: Authenticated role shell with `DashboardShell` layout and universal account deletion modal.
    - `patient/`: Longitudinal health records, biomarkers, family swiper, reports inbox, SOS configuration.
    - `doctor/`: Clinic queue, appointments, Daily.co teleconsultation launcher, e-prescription composer.
    - `nurse/`: Home visit assignments, wound care protocols, clinical vitals logging.
    - `phlebotomist/`: Duty toggle, live dispatch radar, collection kit stock, earnings summary.
    - `processing-center/`: Specimen tube verification, barcode scanner, batch assembly, report upload.
    - `pharmacy/`: Dark-store order terminal, stock inventory updater, generic medicine savings calculator.
    - `admin/`: Platform analytics, fraud quality monitor, supervisor provisioning, credential verification queue.
    - `supervisor/`: City-scoped operations monitor.
    - `dentist/`, `dietitian/`, `physiotherapist/`: Specialist clinic management and tariff controllers.

### Expo Mobile Application (`mobile/`)
- **Navigation Architecture (`mobile/app/`):**
  - Uses `expo-router` with role-based layout groups:
    - `(auth)/`: Mobile login, SMS OTP screen, biometric enrollment.
    - `(patient)/`: Mobile patient portal, home collection ordering, report viewer, SOS button.
    - `(phlebotomist)/`: Field collector terminal, GPS turn-by-turn navigation, barcode camera scanner (`expo-camera`), tube verification.
    - `(nurse)/`: Field nursing task list, patient address dispatch.
    - `(doctor)/`: Mobile teleconsultation room, schedule viewer.
    - `(processing-center)/`: Handheld sample intake and barcode validation.
    - `(pharmacy)/`: Rapid order notification and fulfillment.
    - `(admin)/`: Mobile KPI monitor.
    - `tracking/`: Live dispatch map with real-time phlebotomist coordinates.
