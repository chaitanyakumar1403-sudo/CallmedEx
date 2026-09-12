# Technical Design Specification: Doctor Profile Photo Pipeline & NRI Consultation Platform

**Date:** 2026-09-12  
**Status:** Approved Architecture (Approach A)  
**Author:** Antigravity Engineering & CallMedex Core Architecture  
**Target:** Production Deployment (Zero Tolerance for Bugs & Regression)

---

## 1. Executive Summary & Goals

This specification defines the production-grade architecture for two clinical features:
1. **Practitioner Profile Photo System & Verification Gating:**
   - Modern, high-precision image upload studio in the Doctor Dashboard profile section (supporting camera capture & file upload < 4 MB).
   - Strict verification gating: Doctors without an active profile photo have `verification_status: "pending"`. Uploading the profile photo triggers active representation. Active doctors receive a confirmation badge/alert.
   - Doctor card redesign in `/consultation` and `/booking`: Replaces the generic green logo (`<ModeSymbol3D />`) with the doctor's verified, high-resolution profile photo.
   - Enhanced `DoctorPresentationModal` displaying the clinician's photo, qualifications, verified badges, and consultation tariff justification.
2. **Global NRI Consultation Platform:**
   - Navigation enhancement in `SmartNavbar.tsx`: Adds "NRI Consultation" beside "Home Services" with adjusted flex spacing to prevent wrapping.
   - Dedicated showcase page at `/nri-consultation` built with glassmorphic cards, global stats, country filters (USA, UK, UAE, Canada, Australia, Singapore, Europe), and 1-click video booking.
   - Dedicated NRI Doctor registration path (`/auth/signup?role=doctor&subtype=nri`) capturing country of practice, international license credentials, time zone, and mandatory profile photo.
   - Enforcement of Teleconsultation-only mode: NRI doctors are strictly prohibited from walk-in or home-visit bookings; their dashboard and patient booking flows are locked to video teleconsultation.

---

## 2. Architecture & Data Flow

```mermaid
graph TD
    subgraph "Doctor Experience"
        DocDash[Doctor Dashboard / Profile Section] --> PhotoUpload[Photo Studio: WebRTC Cam or File < 4MB]
        PhotoUpload --> BackendUpload[POST /api/providers/profile-photo]
        BackendUpload --> SupabaseStorage[(Supabase Storage: profile-photos)]
        BackendUpload --> DocTable[(documents: doc_type=profile_photo)]
        BackendUpload --> SyncPres[(documents: provider_presentation)]
        BackendUpload --> StatusCheck{Photo Present?}
        StatusCheck -->|Yes| ActiveStatus[verification_status: verified]
        StatusCheck -->|No| PendingStatus[verification_status: pending]
    end

    subgraph "Patient Experience"
        PublicNav[SmartNavbar: NRI Consultation] --> NRIPage[/nri-consultation Showcase]
        ConsultPage[/consultation] --> DoctorCard[Doctor Card: Displays Verified Photo]
        DoctorCard --> PresModal[DoctorPresentationModal: Photo + Tariff Justification]
        NRIPage --> BookVideo[1-Click Teleconsultation Booking]
        DoctorCard --> BookVisit[Booking Flow: Selected Doctor with Photo]
    end

    subgraph "NRI Doctor Pipeline"
        NRISignup[/auth/signup?role=doctor&subtype=nri] --> CountryField[Country of Practice + Timezone]
        CountryField --> TelemedOnly[Mode Locked: Teleconsultation Only]
        TelemedOnly --> NRIDash[NRI Doctor Dashboard: Telemed Only]
    end
```

---

## 3. Data Model & Backend API Specifications

### 3.1 Document Storage & Metadata
- **Storage Bucket:** `profile-photos` in Supabase Storage (auto-created if not present, with public read access or signed URL fallback).
- **Magic-Byte Signature Verification:**
  - JPEG: `b"\xff\xd8\xff"`
  - PNG: `b"\x89PNG\r\n\x1a\n"`
  - WebP: `b"RIFF....WEBP"`
- **Maximum File Size:** `4 * 1024 * 1024` bytes (4 MB). Files exceeding 4 MB are rejected with a clear 400 error.
- **Documents Table Integration:**
  ```json
  {
    "id": "uuid",
    "user_id": "user_uuid",
    "document_type": "profile_photo",
    "file_url": "https://<supabase-host>/storage/v1/object/public/profile-photos/<user_id>/photo.jpg",
    "file_name": "profile_photo.jpg",
    "verification_status": "verified",
    "verification_notes": "{\"uploaded_at\": \"2026-09-12T...\", \"width\": 600, \"height\": 600, \"is_nri\": false}",
    "uploaded_at": "NOW()"
  }
  ```
- **Presentation Sync:** The `profile_photo_url` is automatically included in `provider_presentation` notes so existing endpoints (`/api/telemed/doctors`, `/api/providers/search/doctors`, `/api/providers/doctor/{id}/presentation`) batch-load and return the profile photo without extra network roundtrips.

### 3.2 Verification Lifecycle Gating
1. **Existing & New Doctors Without Photo:**
   - If a doctor has not uploaded a profile photo, `verification_status` is returned or set as `"pending"`.
   - On doctor dashboard, an advisory banner appears:  
     *"Action Required: Upload your official practitioner photo to complete your profile verification and appear in patient booking."*
2. **Uploading Photo:**
   - Uploading a valid profile photo immediately updates status to `"verified"` (if credentials are valid) and sets `documents.document_type = "profile_photo"`.
3. **Doctors With Active Photo:**
   - An alert in the profile tab states:  
     *"✓ Profile photo active: Your official clinical portrait is verified and visible to patients on CallMedex."*
   - Doctors can update or replace their photo at any time.

### 3.3 New/Enhanced Backend Endpoints
- `POST /api/providers/profile-photo`: Multipart form upload (file or base64 blob) with 4MB check, magic byte validation, storage upload, document record update, and profile sync.
- `GET /api/providers/nri-doctors`: Public endpoint returning verified NRI physicians filtered by country and specialization.
- Enhanced `/api/providers/search/doctors` & `/api/telemed/doctors`: Now return `profile_photo_url`, `is_nri`, `country_name`, and `country_code`.

---

## 4. Frontend Component Specifications

### 4.1 Doctor Dashboard Profile Photo Studio (`DashboardProfile.tsx`)
- **UI Elements:**
  - Modern, glassmorphic card: "Practitioner Profile Photo & Representation".
  - Circular avatar preview (120x120px) with fallback placeholder (doctor initials / stethoscope icon).
  - Status indicator: Emerald "● Photo Active & Displayed" or Amber "○ Photo Missing · Verification Pending".
  - Upload controls:
    - "Choose Photo" button (opens file picker, restricts to `.jpg,.jpeg,.png,.webp`, max 4MB).
    - "Take Live Photo" button (triggers WebRTC camera modal for instant capture).
    - "Remove Photo" button (resets to pending status with confirmation guard).
  - Client-side pre-validation: Displays instant toast if file exceeds 4MB.

### 4.2 Consultation Page Doctor Cards (`frontend/src/app/(public)/consultation/page.tsx`)
- **Card Left-Side Redesign:**
  - Replaces `<ModeSymbol3D mode={consultMode} />` with:
    - 64x64px high-definition rounded-full image wrapper (`borderRadius: 16px` or `50%` with smooth gradient ring).
    - Displays doctor's real profile photo via `doc.profile_photo_url`.
    - Fallback: Graceful fallback avatar showing doctor's initials with soft medical teal gradient and stethoscope icon.
    - Online/Offline status dot pinned to bottom-right of avatar.
- **Doctor Presentation Modal (`DoctorPresentationModal.tsx`):**
  - Displays high-resolution doctor photo in the modal banner beside doctor's name, NMC license badge, and qualifications.
  - Retains full tariff justification, bio, and slot booking controls.

### 4.3 Patient Booking Page (`/booking/page.tsx`)
- Doctor selection cards and confirmation review screens now render the doctor's profile photo.

### 4.4 Top Navigation Bar (`SmartNavbar.tsx`)
- Adds `<Link href="/nri-consultation">` immediately following `Home Services`.
- Icon: Globe / Sparkles in `#38bdf8` accent.
- Tuning: Nav actions container uses `gap: 10px` and responsive max-widths so "About", "Health Packages", "Book a Test", "Consultation", "Pharmacy", "Home Services", and "NRI Consultation" fit cleanly beside Notification, Dashboard, and Logout buttons.

### 4.5 NRI Consultation Showcase Page (`/nri-consultation/page.tsx`)
- **Hero Section:** "CallMedex Global NRI Healthcare Network — World-Class Specialists Across Timezones".
- **Glassmorphic Feature Cards:**
  1. *Mayo Clinic, NHS & Global Specialists:* Second opinions from renowned diaspora physicians.
  2. *Strictly Teleconsultation (Zero Physical Queues):* HD encrypted WebRTC video rooms with zero travel friction.
  3. *Cross-Border Digital Prescriptions:* Standardized digital e-prescriptions compliant with international and Indian health records.
  4. *Timezone Synchronized:* Appointments scheduled across EST, GMT, GST, SGT, and IST.
- **Interactive Country Filter Pills:** "All Countries", "United States 🇺🇸", "United Kingdom 🇬🇧", "United Arab Emirates 🇦🇪", "Canada 🇨🇦", "Australia 🇦🇺", "Singapore 🇸🇬", "Germany 🇩🇪".
- **NRI Specialist Directory Grid:**
  - Displays verified NRI doctors with their photo, country flag badge, overseas hospital affiliation, experience, languages, and 1-click "Book Video Consultation".

### 4.6 NRI Doctor Registration (`/auth/signup/page.tsx`)
- Role selector includes "NRI Doctor" (with global airplane/stethoscope 3D icon).
- Country of residence/practice dropdown (USA, UK, UAE, Canada, Australia, etc.).
- Practicing Country License Number / Registration Board (e.g., GMC UK, US State Medical Board, DHA Dubai, etc.).
- Mode restriction: Consultation mode automatically forced to `online` (Teleconsultation only). Checkboxes for walk-in and home visits are hidden/disabled.
- Mandatory profile photo upload field with 4MB check.

---

## 5. Backward Compatibility & Verification Guardrails
- **Zero Fake Doctors:** No simulated or placeholder profiles injected into production tables.
- **Existing Doctors:** Dr. Latchireddi and existing verified clinicians have their photos enabled via dashboard upload.
- **PostgREST Safe:** Presentation data and photo URLs piggyback on existing `documents` and `provider_presentation` queries, completely avoiding breaking table alterations.
- **Testing & Verification:**
  1. Unit and API tests for file validation, magic-byte checking, and 4MB limit.
  2. Frontend build verification (`next build`).
  3. End-to-end UI verification of doctor card rendering and NRI page navigation.
