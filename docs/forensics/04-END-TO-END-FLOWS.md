# 04 — END-TO-END EXECUTION FLOWS

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Deep Execution-Path Reconstruction  
**Verification Level:** STATICALLY VERIFIED against source code AST and test suites  

---

## 1. FLOW 1: PATIENT REGISTRATION & AUTHENTICATION

```text
Trigger: Patient submits signup form or requests SMS OTP
  ↓
Ingress: POST /api/auth/signup OR POST /api/auth/otp/send
  ↓
Validation:
  - Password complexity checked (validate_password_strength: 8+ chars, upper, lower, digit, special)
  - Mobile normalized to E.164 via normalize_indian_phone (+91XXXXXXXXXX)
  - Duplicate check against users table on email and mobile
  ↓
Processing:
  - For Password Signup: Hash password via bcrypt (hash_password). Insert into users table (role='patient').
    Insert into patients table (blood_group, medical_history, emergency_contacts).
    Create default self family_members entry via ensure_self_member.
  - For SMS OTP: Generate 6-digit OTP code (secrets.randbelow). Hash OTP and store in verification_otps table
    with 5-minute expiry. Call MSG91 REST API (send_otp).
  ↓
Session Issuance:
  - Token minting: create_access_token(sub=user_id, role='patient', ver=token_version)
  - Token signed with JWT_SECRET (HS256). Expiry: 60 minutes.
  - Refresh token minted with 7-day expiry and stored in refresh_tokens table.
  ↓
Response: TokenResponse { access_token, refresh_token, user_profile }
```

---

## 2. FLOW 2: WHATSAPP-ORIGINATED BOOKING (VIA MEDIASSIST AI)

This flow traces how a patient interacting with CallMedex over WhatsApp is ingested into the core platform without direct Meta Cloud API integration in CallMedex:

```text
Trigger: Patient messages WhatsApp bot ("Book CBC test in Visakhapatnam tomorrow")
  ↓
Ingress: MediAssist AI parses natural language intent using Groq LLM (KriyaAI engine).
  MediAssist AI issues signed HTTP request to CallMedex:
  POST /api/v1/integrations/mediassist/whatsapp-bookings
  Headers:
    Authorization: Bearer <MEDIASSIST_BEARER_TOKEN>
    X-Signature: sha256=<HMAC-SHA256(timestamp + "." + raw_body, MEDIASSIST_HMAC_SECRET)>
    X-Timestamp: <Unix epoch seconds>
    X-Idempotency-Key: <UUIDv4>
  ↓
Security Verification (app/middleware/mediassist_auth.py):
  - verify_mediassist_signature computes expected HMAC over raw body bytes. Constant-time comparison.
  - Checks abs(now - timestamp) <= 300 seconds (Replay protection).
  - Checks mediassist_inbound_requests table for existing X-Idempotency-Key. If found, replays cached response.
  ↓
Headless Patient Resolution:
  - Normalize patient phone number.
  - Query users table by mobile.
  - If user does not exist: Provision "headless" patient account:
    - users.id = UUIDv4
    - users.full_name = payload.patient_name or "WhatsApp Patient"
    - users.email = "wa_{normalized_phone}@callmedex.local" (synthetic placeholder)
    - users.password_hash = bcrypt(secrets.token_urlsafe(32))
    - users.role = 'patient'
    - Insert default self record in family_members.
  ↓
Booking & Processing Center Allocation:
  - Resolve home_services for requested test ("CBC").
  - Resolve nearest processing_centers matching patient district/city via ProcessingCenterService.
  - Insert row into bookings table:
    - provider_type = 'processing_center'
    - provider_id = processing_center_id
    - service_type = 'home_collection'
    - status = 'pending'
  - Insert rows into booking_subjects and booking_tests.
  - Call assign_booking(booking_id):
    - Derives required tubes (e.g. Purple Top K2 EDTA for CBC).
    - Inserts sample records in samples table (status='pending_collection').
    - Generates unique barcode (CMX-YYMMDD-XXXXXX).
  ↓
Asynchronous Handoff:
  - Enqueue Celery task: scheduled_dispatch.py or immediate dispatch if slot is today.
  ↓
Cache & Response:
  - Cache response in mediassist_inbound_requests table against X-Idempotency-Key.
  - Return HTTP 201 { success: true, booking_id, patient_id, barcode }.
  - MediAssist AI receives response and replies on WhatsApp to patient with booking reference and payment link.
```

---

## 3. FLOW 3: PARTNER-BLIND DIAGNOSTIC HOME COLLECTION

```text
Trigger: Patient selects tests on web/mobile and clicks "Book Home Collection"
  ↓
Ingress: POST /api/bookings
  Payload: BookingCreate {
    service_type: "home_collection",
    selected_tests: ["CBC", "Lipid Profile"],
    collection_lat: 17.6868, collection_lng: 83.2185,
    collection_address: "D.No 4-50, MVP Colony, Visakhapatnam",
    district: "Visakhapatnam", preferred_date: "2026-09-23"
  }
  Auth: Bearer JWT (role='patient')
  ↓
Server-Side Pricing & Verification:
  - Client-supplied total_price is ignored. Server computes sum of base_price from home_services.
  - Resolves district mapping via processing_center_areas.
  ↓
Database Writes:
  - INSERT INTO bookings (patient_id, service_type='home_collection', status='pending', total_price, collection_district)
  - INSERT INTO booking_subjects (booking_id, family_member_id)
  - INSERT INTO booking_tests (booking_id, booking_subject_id, home_service_id, price_charged)
  ↓
Specimen & Tube Derivation (_provision_home_collection):
  - assign_booking reads booking_tests.
  - Looks up tube_requirements for each test:
    - CBC -> 1x Lavender Top (K2 EDTA)
    - Lipid Profile -> 1x Yellow Top (SST / Gel Tube)
  - INSERT INTO samples (booking_id, tube_type_id, status='pending_collection', barcode=generate_barcode())
  - INSERT INTO sample_events (sample_id, event_type='derived', actor_id=patient_id, role='system')
  ↓
Dispatch Trigger:
  - If preferred_date is today or within 4 hours:
    UniversalDispatchEngine.create_dispatch_request(
      provider_type='phlebotomist', lat, lng, booking_id
    )
    - Finds verified on-duty phlebotomists within 15 km via provider_locations.
    - Creates dispatch_requests row (status='searching').
    - Inserts dispatch_offers for top candidates with 10-minute expiration.
    - Issues push notification and SMS to candidate phlebotomists.
  - If preferred_date is in the future:
    - Booking remains in pending. Picked up by Celery beat task scheduled_dispatch_sweep on booking date.
  ↓
Response: HTTP 201 BookingResponse (centre identity is stripped; patient sees booking confirmed).
```

---

## 4. FLOW 4: PHLEBOTOMIST FIELD COLLECTION & SPECIMEN CUSTODY

```text
Trigger: Phlebotomist taps "Accept Offer" on mobile app
  ↓
Ingress: POST /api/dispatch/offers/{offer_id}/accept
  ↓
State Transition:
  - dispatch_offers.status = 'accepted'
  - dispatch_requests.status = 'provider_accepted'
  - bookings.status = 'confirmed'
  - Generate secure public tracking token (UUIDv4) stored in dispatch_requests.tracking_token.
  - SMS & Push sent to patient with tracking link: https://callmedex.com/track/{token}
  ↓
Field Execution:
  1. Phlebotomist taps "En Route" -> dispatch_requests.status = 'en_route'.
  2. Phlebotomist taps "Arrived" -> dispatch_requests.status = 'arrived'.
  3. Patient Identity Verification: Phlebotomist asks patient for collection OTP (sent to patient via SMS/WhatsApp).
     Phlebotomist enters OTP -> POST /api/dispatch/{id}/verify-otp.
  4. Specimen Draw & Barcode Binding:
     - Phlebotomist opens physical collection kit.
     - Scans pre-printed tube barcode using phone camera -> POST /api/phlebo/bind-barcode
     - Validates barcode matches sample record in samples table.
     - samples.status = 'collected'
     - sample_events logged (event_type='collected', phlebo_id, GPS coordinates).
     - Decrements phlebotomist kit stock in phlebo_stock table.
  5. Handover to Processing Center:
     - Phlebotomist transports samples in cold box.
     - Arrives at designated Processing Center.
     - Taps "Handover Batch" -> samples.status = 'handover_requested'.
  ↓
Processing Center Intake:
  - Lab technician at Processing Center scans tube barcode -> POST /api/pc/verify
  - Technician checks hemolysis, volume, and label clarity:
    - If Approved: samples.status = 'received' -> 'verified' -> 'batched'.
      Wallet credit awarded to part-time phlebotomist (Rs 150) in wallet_transactions table.
    - If Rejected: samples.status = 'rejected'. Reason logged (e.g. 'hemolyzed', 'insufficient_volume').
      New sample automatically queued for recollect. Phlebotomist receives zero payout.
```

---

## 5. FLOW 5: TELEMEDICINE VIDEO CONSULTATION & E-PRESCRIPTION

```text
Trigger: Doctor or Patient initiates video call
  ↓
Ingress: POST /api/telemed/rooms
  Payload: { doctor_id, booking_id, consent_given: true }
  ↓
Room Provisioning (TelemedicineService):
  - Validates active booking in bookings table.
  - Calls Daily.co REST API:
    POST https://api.daily.co/v1/rooms
    Headers: Authorization: Bearer <DAILY_API_KEY>
    Body: { name: "cmd_{uuid}", privacy: "private", properties: { exp: now + 3600 } }
  - Daily.co creates room and returns room URL.
  - Generates meeting tokens for doctor and patient (with clinical recording capabilities).
  - INSERT INTO consultations (booking_id, doctor_id, patient_id, room_url, status='active')
  - INSERT INTO consent_records (user_id=patient_id, consent_type='teleconsultation_recording', consent_given=true)
  ↓
Video Call Execution:
  - Both parties connect to Daily.co room via WebRTC inside Next.js / Mobile app.
  - Audio transcript generated in real-time or uploaded at consultation close.
  ↓
Consultation Finalization:
  - Doctor taps "End & Generate Prescription" -> POST /api/telemed/finalize
  - Payload: { consultation_id, raw_transcript }
  - Backend invokes Groq Llama 3.3-70b / Gemini via AiVoiceScribeService:
    Prompt: "Extract chief complaints, clinical diagnosis, prescribed medications (name, dosage, frequency, duration), and follow-up advice."
  - Returns structured JSON matching PrescriptionSchema.
  - Doctor reviews and edits AI-suggested prescription in UI.
  - Doctor digitally signs -> POST /api/telemed/prescriptions/sign.
  - Prescription PDF generated and saved to private Supabase bucket lab-reports.
  - WhatsApp notification sent to patient via MediAssist AI with secure download link.
```

---

## 6. FLOW 6: PHARMACY ORDER FULFILLMENT & GENERIC SAVINGS

```text
Trigger: Patient uploads prescription or selects medications
  ↓
Ingress: POST /api/pharmacy/orders
  ↓
Processing:
  - Matches patient GPS coordinates to registered pharmacies within service radius (default 5 km) via pharmacies table.
  - Resolves generic drug equivalents via DrugShieldService / pharmacy_inventory:
    - Calculates cost of branded medicine vs generic alternative.
    - Computes "Patient Savings" metric (e.g. "You saved Rs 420 (65%)").
  - Orders assigned to nearest retail pharmacy:
    - INSERT INTO pharmacy_orders (patient_id, pharmacy_id, total_amount, generic_savings, status='pending')
  ↓
Fulfillment:
  - Pharmacist receives alert on pharmacy terminal dashboard (`/dashboard/pharmacy`).
  - Pharmacist confirms item availability and packs order -> status = 'packed'.
  - If home_delivery=true: Raises dispatch request to local delivery partner -> status = 'out_for_delivery'.
  - Patient verifies delivery via delivery OTP -> status = 'delivered'.
```

---

## 7. FLOW 7: EMERGENCY SOS ALERT WORKFLOW

```text
Trigger: Patient presses Emergency SOS button on mobile app
  ↓
Ingress: POST /api/patient/sos/trigger
  Payload: { lat: 17.6868, lng: 83.2185, notes: "Chest pain and dizziness" }
  ↓
Immediate Escalation:
  - INSERT INTO emergency_sos_alerts (patient_id, lat, lng, status='triggered', triggered_at=now)
  - Fetches trusted emergency contacts from emergency_sos_contacts table.
  - Multi-Channel Notification Blast:
    1. SMS via MSG91 to all emergency contacts with live GPS tracking link.
    2. WhatsApp alert via MediAssist AI with location coordinates and Google Maps pin.
    3. Push notification to patient's active mobile device.
  - Immediate Universal Dispatch:
    - UniversalDispatchEngine raises urgent ambulance / nearest doctor dispatch request (URGENT_RADIUS_MULTIPLIER = 2.0, searches up to 30 km).
  ↓
Monitoring:
  - Admin and City Supervisor dashboards trigger audio-visual siren in browser (`/dashboard/admin`).
  - Status updates broadcasted until alert is marked 'resolved' by emergency response team.
```
