# 06 — FRONTEND & CLIENT FORENSICS

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Web & Mobile Client Architecture Audit  
**Verification Level:** STATICALLY VERIFIED against Next.js and Expo source trees  

---

## 1. DUAL CLIENT ARCHITECTURE OVERVIEW

CallMedex maintains two production client applications within the monorepo:
1. **Web Client (`frontend/`):** Next.js 16.2.10 (App Router), React 19.2.4, TypeScript 5, Tailwind CSS, Lucide icons, Sonner toast notifications, Playwright E2E test harness.
2. **Mobile Client (`mobile/`):** Expo 52.0.0, React Native 0.76.6, Expo Router 4.0.0, TypeScript 5.3, supporting iOS and Android.

---

## 2. WEB APPLICATION INVENTORY (`frontend/src/app/`)

### A. Layouts & Global Providers
- `src/app/layout.tsx`: Root shell setting up global font (`Inter`), meta tags, viewports, Sonner `<Toaster position="top-right" richColors />`, and the global CSS stylesheet (`globals.css`, 51.5 KB).
- `src/app/(app)/layout.tsx`: Authenticated application shell checking session presence, wrapping children with role-aware navigational headers.
- `src/app/(public)/layout.tsx`: Public header and footer wrapper with responsive navigation, login modal launcher, and partner onboarding links.

### B. Route Groups & Page Hierarchy
```text
frontend/src/app/
├── (public)/
│   ├── page.tsx                      # Landing page (Hero, value propositions, service categories)
│   ├── about/page.tsx                # Corporate overview, clinical advisory board, mission
│   ├── diagnostics/page.tsx          # Diagnostic test search, multi-test selection cart
│   ├── home-services/page.tsx        # Home collection & nursing services catalog
│   ├── tracking/page.tsx             # Public tracking portal entrypoint (prompts for token)
│   └── partner-register/             # In-site native partner onboarding wizard (12 roles)
│
├── (app)/
│   ├── booking/
│   │   ├── page.tsx                  # Core booking wizard (test confirmation, address, slot)
│   │   ├── hospital/page.tsx         # Hospital OPD appointment booking
│   │   ├── nurse/page.tsx            # Home nursing appointment booking
│   │   └── therapy/page.tsx          # Physiotherapy & dental appointment booking
│   │
│   ├── consultation/
│   │   └── [doctorId]/page.tsx       # Daily.co WebRTC video room, consent modal, e-prescription
│   │
│   ├── tracking/
│   │   └── [token]/page.tsx          # Live dispatch radar, phlebotomist GPS coordinates, ETA
│   │
│   └── dashboard/
│       ├── page.tsx                  # Role redirector (routes user to their specific dashboard)
│       ├── patient/                  # Patient Portal: vitals rail, biomarkers, family swiper, SOS
│       ├── doctor/                   # Doctor Portal: appointment queue, consultation launcher
│       ├── nurse/                    # Nurse Portal: assigned home visits, wound dressing logs
│       ├── phlebotomist/             # Phlebotomist Portal: job radar, tube stock, payout ledger
│       ├── processing-center/        # Processing Center: tube verification, batch sealing, report upload
│       ├── pharmacy/                 # Pharmacy Terminal: incoming orders, stock updater, generic savings
│       ├── admin/                    # Super Admin Portal: KPIs, supervisor manager, fraud quality control
│       ├── supervisor/               # City Supervisor Portal: city-scoped operational monitor
│       ├── dentist/                  # Dental Clinic: chair availability, procedure tariffs
│       ├── dietitian/                # Dietitian Clinic: diet plans, teleconsultation queue
│       ├── physiotherapist/          # Physiotherapy Center: home visit queue, rehabilitation logs
│       └── organization/             # Hospital / Polyclinic: department doctors, slot allotments
```

---

## 3. MOBILE APPLICATION INVENTORY (`mobile/app/`)

The mobile application utilizes `expo-router` v4 file-based routing:

```text
mobile/app/
├── _layout.tsx                       # Root mobile stack layout, fonts, splash screen controller
├── index.tsx                         # Entry gateway (redirects to auth or role dashboard)
├── notifications.tsx                 # Central push and in-app notification center
├── (auth)/
│   ├── login.tsx                     # Mobile password and OTP login
│   ├── otp.tsx                       # 6-digit SMS OTP verification screen
│   └── biometric.tsx                 # Fingerprint / FaceID setup via expo-local-authentication
│
├── (patient)/
│   ├── _layout.tsx                   # Bottom tab navigator (Home, Bookings, Health, Profile)
│   ├── index.tsx                     # Patient home: quick booking, recent vitals, active orders
│   ├── appointments.tsx              # Active and historical appointments with status badges
│   ├── biomarkers.tsx                # Trend graphs of HbA1c, Cholesterol, CBC markers
│   └── emergency.tsx                 # Prominent 1-tap SOS trigger with countdown cancel
│
├── (phlebotomist)/
│   ├── _layout.tsx                   # Bottom tab navigator (Active Job, Stock, History, Profile)
│   ├── index.tsx                     # Live dispatch radar with sound alerts on new offers
│   ├── scanner.tsx                   # Camera-based barcode scanner (expo-camera) for tubes
│   └── stock.tsx                     # Real-time collection kit tube inventory counter
│
├── (nurse)/                          # Field nursing queue, wound care documentation
├── (doctor)/                         # Mobile teleconsultation queue, schedule controller
├── (processing-center)/              # Handheld intake scanner for incoming specimen batches
├── (pharmacy)/                       # Dark-store order terminal with audio chime alerts
├── (admin)/                          # Mobile executive dashboard
└── tracking/
    └── [token].tsx                   # Native MapView rendering live provider pin and patient pin
```

---

## 4. CLIENT STATE MANAGEMENT & API INTEGRATION

### A. Web API Client
- **Implementation:** `frontend/src/lib/api.ts` (and per-feature service files).
- **Session Transport:** Reads JWT from `localStorage.getItem("callmedex_token")`.
- **Request Interceptor:** Automatically appends `Authorization: Bearer <token>` and `Content-Type: application/json`.
- **Response Handling:** Unwraps internal `APIResponse` envelope (`{ success, message, data }`).
- **Error Interceptor:**
  - HTTP 401: Clears token and redirects to `/login`.
  - HTTP 403: Displays access denied toast via Sonner.
  - HTTP 504: Informs user that AI analysis timed out and will complete in the background.

### B. Mobile API Client
- **Implementation:** `mobile/src/services/api.ts`.
- **Secure Storage:** Uses `expo-secure-store` to encrypt JWT access tokens and refresh tokens on the device's hardware keychain.
- **Biometric Integration:** When biometric login is enabled, the device generates a private key in the hardware secure enclave. The server challenge is signed using `expo-crypto` and verified on the backend without transmitting the master password.

---

## 5. FRONTEND/BACKEND CONTRACT MISMATCHES & RISKS

### Finding FE-01: District vs City Nomenclature Discrepancy
- **Location:** `frontend/src/app/partner-register/` vs `backend/app/models/schemas.py` (`AddressInfo`).
- **Observed Behavior:** The frontend signup forms collect `city` as free text in older components while newer components enforce a dropdown list of Andhra Pradesh districts (`Visakhapatnam`, `Vijayawada`, `Guntur`).
- **Backend Remediation in Code:** `AddressInfo._derive_city_from_district` was introduced to automatically copy `district` to `city` and vice versa, preventing city-equality filter misses. However, older frontend bundles without district validation can still send free-text strings like "Vizag" that fail downstream processing center area matching.

### Finding FE-02: Duplicate Dashboard Directory Ambiguity
- **Location:** `frontend/src/app/(app)/dashboard/processing-center/` AND `frontend/src/app/(app)/dashboard/processing_center/`.
- **Observed Behavior:** Both hyphenated and underscored directories exist in the Next.js source tree. While one acts as the active dashboard and the other as a compatibility stub, this creates bundle duplication and potential routing conflicts on case-insensitive deployment filesystems.

### Finding FE-03: Client-Side Pricing Calculation Risk
- **Location:** `frontend/src/app/(app)/booking/page.tsx` line 210.
- **Observed Behavior:** The booking page computes a cart subtotal in JavaScript and submits `total_price` in the `BookingCreate` payload.
- **Backend Mitigation:** The backend (`bookings.py` lines 158–173) deliberately ignores `body.total_price` and re-calculates the amount from `home_services` and `scope_catalogs` before writing to the database. While secure, this causes a contract mismatch if catalog prices update while a patient's browser cart is open.
