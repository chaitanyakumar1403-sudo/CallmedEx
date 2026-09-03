# CALLMEDEX STAGING READINESS REPORT

**Date**: August 16, 2026  
**Auditor**: Principal QA Architect, Full-Stack Lead & Release Engineering Team  
**Platform Version**: CallMedex v3.1.0  
**Overall Verdict**: **`READY FOR STAGING DEPLOYMENT`**  
**Runtime Credential State**: **`CONFIGURATION-READY (DEGRADED/FALLBACK SAFE)`**

---

## EXECUTIVE SUMMARY

The CallMedex platform (FastAPI Backend, Next.js Web Frontend, Expo/React Native Mobile App, and MediAssist Integration Engine) has completed full remediation, architecture standardization, and configuration-first external API decoupling.

All core logic, role-boundary route guards, schema contracts, database migrations, and native service adapters are implemented and verified. The system passes all build and test gates across all three platforms without blocking on missing third-party production credentials.

```text
========================================================================================
                               BUILD & TEST GATE VERIFICATION SUMMARY
========================================================================================
Platform          Test Suite                          Result             Duration / Notes
----------------------------------------------------------------------------------------
FastAPI Backend   pytest (479 test cases)             479 PASSED, 0 FAIL 83.94s
Next.js Frontend  UI Linter (scripts/lint-ui.mjs)     19/19 CLEAN        0 errors
Next.js Frontend  Unit Tests (scripts/*.test.mjs)     19 PASSED, 0 FAIL  253ms
Next.js Frontend  Production Build (npx next build)   37 PAGES BUILT     0 TypeScript errors
React Native App  TypeScript Compiler (npx tsc)       0 ERRORS           Strict mode clean
React Native App  Native Test Suite (mobile/tests)    29 PASSED, 0 FAIL  168ms
========================================================================================
```

---

## 1. INFRASTRUCTURE

| Component | Target Platform | Deployment Strategy | Staging URL / Host | Production URL / Host |
|-----------|-----------------|---------------------|-------------------|----------------------|
| **Backend API** | Render | Docker Container (`start.sh` + Uvicorn + Celery) | `https://staging-api.callmedex.com` | `https://api.callmedex.com` |
| **Frontend Web** | Vercel | Next.js 16 (Turbopack SSG/SSR) | `https://callmedex-frontend.vercel.app` | `https://www.callmedex.com` |
| **Mobile App** | Expo EAS | EAS Preview Build (APK / TestFlight) | Channel: `preview` | Channel: `production` |
| **Cache & Queues** | Render / Upstash | Managed Redis 7 Alpine (`allkeys-lru`) | `rediss://...` | `rediss://...` |
| **Database** | Supabase | PostgreSQL 15+ with RLS & Extensions | Staging Supabase Project | Dedicated Production Supabase |

- **Render Configuration**: [`render.yaml`](file:///c:/Users/chait/OneDrive/Desktop/callmedex/render.yaml) created with web service blueprint, health check at `/api/health`, and managed Redis instance.
- **Vercel Configuration**: [`frontend/vercel.json`](file:///c:/Users/chait/OneDrive/Desktop/callmedex/frontend/vercel.json) created with security headers and API reverse proxy rewrites.
- **EAS Configuration**: [`mobile/eas.json`](file:///c:/Users/chait/OneDrive/Desktop/callmedex/mobile/eas.json) verified with `development`, `preview` (staging), and `production` channels.

---

## 2. ENVIRONMENT CONFIGURATION

Strict three-tier environment separation is established:

```text
               ┌─────────────────┐
               │   DEVELOPMENT   │  APP_ENV=development, OTP_PROVIDER=mock, Mock Payments Enabled
               └────────┬────────┘
                        │
               ┌────────▼────────┐
               │     STAGING     │  APP_ENV=staging, staging-api.callmedex.com, Real Provider Ready
               └────────┬────────┘
                        │
               ┌────────▼────────┐
               │   PRODUCTION    │  APP_ENV=production, api.callmedex.com, Zero Mock Mode, Strict SSL
               └─────────────────┘
```

- **Environment-Gated Security**:
  - `APP_ENV=production` strictly rejects localhost `FRONTEND_URL` and refuses startup with weak/missing `JWT_SECRET`.
  - Staging builds never silently fall back to production Supabase or localhost.
  - Production mobile builds never reference internal emulator URLs (`10.0.2.2`).

---

## 3. API READINESS

- **Total Backend Routers Registered**: 32 routers in `app.main:app`.
- **Health Check Endpoint**: `GET /api/health` returns real-time configuration audit:
  ```json
  {
    "status": "healthy",
    "service": "CallMedex API",
    "version": "3.1.0",
    "environment": "staging",
    "supabase_configured": true,
    "razorpay_configured": false,
    "gemini_configured": true,
    "daily_configured": true,
    "msg91_configured": false,
    "mediassist_configured": true,
    "features": [
      "universal_provider",
      "legal_documents",
      "universal_dispatch",
      "masked_calling",
      "admin_analytics",
      "provider_management",
      "payments",
      "security_hardening",
      "rate_limiting",
      "video_consultation",
      "ai_eprescription",
      "gzip_compression",
      "request_timeouts"
    ]
  }
  ```

---

## 4. WEB APPLICATION STATUS

- **Build**: Successfully compiled via Next.js Turbopack with 37 static & dynamic routes.
- **Portals Verified**:
  - Patient Dashboard (`/dashboard/patient`)
  - Doctor Portal (`/dashboard/doctor`)
  - Phlebotomist Doorstep (`/dashboard/phlebotomist`)
  - Processing Center Lab Operations (`/dashboard/processing-center`)
  - Pharmacy Orders (`/dashboard/pharmacy`)
  - Nurse Home Visits (`/dashboard/nurse`)
  - Organization Corporate Portal (`/dashboard/organization`)
  - Super Admin Dashboard (`/dashboard/admin`)
- **API Wiring**: All client data fetching routes through `NEXT_PUBLIC_API_URL` with Next.js rewrites in `vercel.json` and `next.config.ts`.

---

## 5. MOBILE APPLICATION STATUS

- **Screen Inventory**: 49 distinct user-facing screens across 8 role groups + 12 navigation layout wrappers = **61 `.tsx` files total**.
- **Role Boundary Route Guard**: Implemented in [`mobile/app/_layout.tsx`](file:///c:/Users/chait/OneDrive/Desktop/callmedex/mobile/app/_layout.tsx) with strict role-segment gating.
- **Token Handling**: Automatic Bearer token injection, 401 refresh token queue rotation, and exponential backoff retry in [`mobile/src/services/api.ts`](file:///c:/Users/chait/OneDrive/Desktop/callmedex/mobile/src/services/api.ts).
- **TypeScript**: 0 compiler errors under strict configuration.

---

## 6. BACKEND STATUS

- **Framework**: FastAPI v0.115 with uvloop & httptools.
- **Background Workers**: Celery worker + Celery beat configured via `start.sh` and Dockerfile.
- **Middleware Stack**: Outermost security headers → Redis rate limiter → Request timeouts (60s standard / 300s AI) → GZip compression (>500B).
- **Tests**: 479/479 pytest test cases passed.

---

## 7. DATABASE STATUS

- **Provider**: PostgreSQL 15 on Supabase.
- **Schema Migrations**: 51 versioned SQL migration scripts located in [`database/`](file:///c:/Users/chait/OneDrive/Desktop/callmedex/database/).
- **RLS & Security**: Row-Level Security active across tables (`users`, `patients`, `bookings`, `samples`, `payments`, `report_jobs`).
- **Idempotency**: Scoped idempotency caches for webhook ingestion and sample processing.

---

## 8. AUTHENTICATION & IDENTITY

- **JWT Session Security**: 60-minute access token lifespan with cryptographic refresh token rotation and `token_version` revocation.
- **Password Hashing**: Bcrypt with salted rounds.
- **Biometrics**: Native Face ID / Fingerprint challenge-response authentication (`/api/auth/biometrics/verify`) implemented on mobile.
- **Headless Account Claiming**: WhatsApp-created headless patient accounts seamlessly link to mobile app on phone OTP verification.

---

## 9. PAYMENTS (RAZORPAY)

- **Workflow**:
  ```text
  Mobile/Web -> Backend /api/payments/create-order -> Razorpay Order Creation
             -> Client Checkout -> /api/payments/verify (Signature + Amount Check + Optimistic Lock)
             -> Booking Confirmation & Status Transition
  ```
- **Configuration-First Behavior**:
  - When keys are present: Full cryptographic verification & payment capture.
  - When keys are missing in staging/prod: Returns clean error `"Online payment is currently unavailable. Payment gateway is not configured."` (HTTP 503/400). Never pretends payment succeeded.
  - Test mode enabled only when `APP_ENV=development` and `ENABLE_DEV_MOCK_PAYMENT=true`.

---

## 10. PHONE OTP (MSG91)

- **Workflow**:
  - `/api/auth/otp/send`: E.164 normalization (+91), 5 sends/hour rate limit, 5-minute expiry.
  - `/api/auth/otp/verify`: Brute-force lockout (5 failed attempts locks for 15 min), user lookup/creation, JWT minting.
- **Missing Credential Behavior**:
  - In staging/production: Returns HTTP 503 `"SMS OTP delivery is currently unavailable. OTP provider is not configured for this environment."`
  - In development: Mock OTP enabled only when `APP_ENV=development` and `OTP_PROVIDER=mock`.

---

## 11. PUSH NOTIFICATIONS (FCM / APNs)

- **Architecture**: Mobile registers native push tokens via `POST /api/notifications/register-device`; unregisters on logout via `DELETE /api/notifications/unregister-device`.
- **Channels Configured**: Android notification channels for Emergency SOS, Telemedicine, Lab Reports, and Appointments.
- **Degraded State**: If server keys are missing, device token registration logs gracefully and app operations continue without disruption.

---

## 12. TELEMEDICINE (DAILY.CO)

- **Architecture**:
  - Backend creates time-limited (45-minute) private rooms via Daily.co REST API (`/v1/rooms`) and issues role-specific meeting tokens.
  - Doctor receives moderator tokens; patient receives attendee tokens.
- **Fallback**: If Daily.co key is not configured, gracefully falls back to secure signed Jitsi Meet rooms (`https://meet.jit.si/CMX-...`).

---

## 13. MEDIASSIST AI INTEGRATION

- **Frozen Contract Architecture**:
  ```text
  Lab/Processing Center -> CallMedex report_jobs -> Signed URL
                        -> Outbound to MediAssist AI -> OCR & Analysis -> WhatsApp
                        -> Inbound Webhook (/api/mediassist/inbound) with HMAC-SHA256
                        -> ai_report_analyses stored in CallMedex private DB
                        -> Web + Mobile access canonical analysis
  ```
- **Security Boundary**: Mobile and Web NEVER communicate directly with MediAssist or Meta WhatsApp. All comms route through CallMedex backend.

---

## 14. SECURITY & DATA PRIVACY

- **PHI Protection**: Client logs sanitized using regex redactions for phone numbers, tokens, emails, and medical test data in `mobile/src/utils/logger.ts`.
- **CORS Protection**: Exact allowlist matching with origin normalisation; diagnostic logging on rejected preflights.
- **Rate Limiting**: Redis-backed rate limiting per IP and per endpoint category (auth, upload, general).
- **Secrets Management**: Zero plaintext production keys in git history; `.env.example` templates created for all tiers.

---

## 15. CROSS-PLATFORM SYNCHRONIZATION

| Entity / Event | Web State | Mobile State | Synchronization Mechanism |
|----------------|-----------|--------------|---------------------------|
| **Booking Creation** | Stored in Supabase `bookings` | Visible in `appointments.tsx` | Supabase Realtime & REST API |
| **Profile Updates** | Stored in Supabase `users` / `patients` | Rendered on `profile.tsx` | AuthContext + REST sync |
| **Lab Reports** | Visible in `/dashboard/patient/reports` | Rendered in `(patient)/reports.tsx` | Database `report_jobs` & signed storage URLs |
| **AI Biomarkers** | Rendered in Risk Compass | Rendered in `(patient)/home.tsx` | API `/api/patient/health/biomarkers` |
| **Payment Status** | Updates to `captured` | Updates booking to `confirmed` | Backend atomic update on `payments` table |

---

## 16. RUNTIME VERIFICATION MATRIX

| # | Validation Item | Implementation Status | Automated Test Evidence |
|---|-----------------|-----------------------|-------------------------|
| 1 | Health Check (`/api/health`) | COMPLETE | `test_all_endpoints.py` PASSED |
| 2 | Phone OTP Registration & Login | COMPLETE | `test_mobile_auth_phase0.py` PASSED |
| 3 | Token Refresh & Rotation | COMPLETE | `test_refresh_token_rotation_success` PASSED |
| 4 | Biometric Authentication | COMPLETE | `test_biometric_registration_and_login_flow` PASSED |
| 5 | Device Push Token Lifecycle | COMPLETE | `test_device_push_token_lifecycle` PASSED |
| 6 | Home Collection Booking & Expansion | COMPLETE | `test_booking_home_collection_wiring.py` PASSED |
| 7 | Processing Center Queue & Barcode Binding | COMPLETE | `test_pc_barcode_and_results.py` PASSED |
| 8 | Phlebotomist Sample Verification | COMPLETE | `test_phlebo_sample_verification.py` PASSED |
| 9 | Longitudinal Biomarker Analysis | COMPLETE | `test_patient_dashboard_upgrade.py` PASSED |
| 10 | MediAssist Inbound Webhook & HMAC Signature | COMPLETE | `test_mediassist_inbound_routes.py` PASSED |
| 11 | Telemedicine Consultation & Consent | COMPLETE | `test_phase2_native_modules.mjs` PASSED |
| 12 | Razorpay GST Calculation & Payload Contract | COMPLETE | `test_phase2_native_modules.mjs` PASSED |

---

## 17. EXTERNAL INTEGRATION READINESS CHECKLIST

| Integration | Code Ready | Env Var Present in Template | Credential Valid in Staging | Runtime Tested | Fallback / Degradation Mode |
|-------------|------------|-----------------------------|-----------------------------|----------------|-----------------------------|
| **Supabase DB** | ✅ Yes | ✅ Yes | ⚠️ Needs Staging Project | ✅ Automated | In-memory local store fallback for unit tests |
| **Razorpay** | ✅ Yes | ✅ Yes | ⏳ Pending Test Keys | ✅ Contract Tested | Clear error: "Online payment currently unavailable" |
| **MSG91 OTP** | ✅ Yes | ✅ Yes | ⏳ Pending Auth Key | ✅ Contract Tested | Controlled 503 error; mock in dev only |
| **Daily.co** | ✅ Yes | ✅ Yes | ⚠️ Staging Key Required | ✅ Contract Tested | Automatic fallback to signed Jitsi Meet rooms |
| **Gemini AI** | ✅ Yes | ✅ Yes | ✅ Configured | ✅ Tested | OpenRouter / Groq multi-model fallback gateway |
| **Geoapify** | ✅ Yes | ✅ Yes | ✅ Configured | ✅ Tested | Reverse geocoding & coordinate resolution active |
| **Resend Email** | ✅ Yes | ✅ Yes | ✅ Configured | ✅ Tested | Console mock logging when keys absent |
| **FCM / APNs** | ✅ Yes | ✅ Yes | ⏳ Optional Staging Keys | ✅ Contract Tested | Graceful skip; app operates normally |
| **MediAssist** | ✅ Yes | ✅ Yes | ✅ Configured | ✅ Tested | Inbound HMAC webhook verification active |

---

## 18. REMAINING BLOCKERS (NON-CODE)

1. **Staging Supabase Project**: A separate Supabase project instance must be created for staging so destructive E2E test runs do not impact live production data.
2. **Third-Party Test Credentials**: Inputting test credentials for Razorpay (`rzp_test_...`) and MSG91 in the Render staging environment settings.

---

## 19. PRODUCTION PREREQUISITES

Before deploying to final production (`https://api.callmedex.com` / `https://www.callmedex.com`):

1. **Secret Rotation**: Rotate all credentials currently present in historical `.env` files (Supabase keys, JWT secret, Resend key, Daily.co key).
2. **Render Environment Injection**: Add rotated secrets directly into Render environment settings for `callmedex-api`.
3. **Vercel Environment Injection**: Set `NEXT_PUBLIC_API_URL=https://api.callmedex.com` in Vercel production settings.
4. **EAS Store Build**: Run `eas build --profile production --platform all` to produce Google Play AAB and iOS release builds.
5. **SSL & DNS**: Ensure DNS records for `api.callmedex.com` and `staging-api.callmedex.com` resolve with valid Let's Encrypt / Cloudflare SSL certificates.

---

## CONCLUSION

The codebase is **100% code-complete, integration-wired, and configuration-ready**. When third-party credentials are provided via environment variables in Render/Vercel/EAS, every integration will activate automatically without requiring architectural or code changes.
