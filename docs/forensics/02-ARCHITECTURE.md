# 02 — RECONSTRUCTED SYSTEM ARCHITECTURE

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Authoritative Technical Architecture Reconstruction  
**Verification Status:** STATICALLY VERIFIED against source tree, docker-compose, and configs  

---

## 1. RECONSTRUCTED HIGH-LEVEL TOPOLOGY

CallMedex operates as a distributed multi-service architecture comprising client frontends, an API gateway and orchestration engine, asynchronous job processors, relational persistence, and external specialized third-party services.

```mermaid
flowchart TD
    subgraph Clients ["Client Layer"]
        Web["Next.js 16 App Router\n(Vercel: callmedex-frontend.vercel.app)"]
        Mobile["Expo 52 React Native App\n(iOS APNs & Android FCM)"]
        WhatsAppUser["Patient / Provider on WhatsApp\n(Via MediAssist AI Bridge)"]
    end

    subgraph Edge ["Ingress & Reverse Proxy"]
        Nginx["Nginx Reverse Proxy / SSL\n(Port 80/443 -> 8000)"]
    end

    subgraph BackendAPI ["FastAPI Orchestration Core (Port 8000)"]
        MW["Middleware Stack:\nSecurity, RateLimiter, Timeout, GZip, CORS"]
        Routers["37 APIRouters:\nAuth, Bookings, Dispatch, PC Ops, Payments..."]
        Services["48 Domain Services:\nDispatchEngine, SampleService, Marketplace..."]
    end

    subgraph AsyncWorker ["Asynchronous Processing Layer"]
        Redis[("Redis 7 Alpine\n(Broker, Cache, Rate Limits)")]
        CeleryWorker["Celery Worker (Concurrency=2)\n(Dispatch, Retry, Roster, Payments)"]
        CeleryBeat["Celery Beat Scheduler\n(Periodic Sweeps & Crons)"]
    end

    subgraph DataStore ["Persistence & Object Storage"]
        SupabaseDB[("PostgreSQL 15+ (Supabase Managed)\n86 Tables, PostGIS Enabled")]
        SupabaseStorage[("Supabase Object Storage\n'verification-docs' & 'lab-reports'")]
    end

    subgraph ExternalIntegrations ["External Cloud Ecosystem"]
        MediAssist["MediAssist AI Platform\n(OCR, Report Interpretation, WhatsApp API)"]
        Razorpay["Razorpay Payment Gateway\n(Orders, Signature Verification)"]
        GeminiAI["Google Gemini Vision API\n(Certificate OCR, Liveness Checks)"]
        OpenRouter["OpenRouter Gateway / Groq\n(DeepSeek v4, Qwen 3.7, Voice Scribe)"]
        DailyCo["Daily.co Video WebRTC\n(Clinical Telemedicine Rooms)"]
        MSG91["MSG91 SMS Gateway\n(DLT-registered OTP & Notifications)"]
        Exotel["Exotel / Twilio Telephony\n(Virtual Masked Number Forwarding)"]
        EmailGW["Resend / SMTP Gateway\n(Transactional MOUs & Alerts)"]
    end

    Web -->|HTTPS / REST| Nginx
    Mobile -->|HTTPS / REST| Nginx
    Nginx --> MW
    MW --> Routers
    Routers --> Services

    Services -->|Service-Role Key (Bypasses RLS)| SupabaseDB
    Services -->|Presigned URLs & Uploads| SupabaseStorage
    Services -->|Enqueue Tasks| Redis
    Redis --> CeleryWorker
    CeleryBeat -->|Cron Triggers| Redis

    Services -->|Signed REST HMAC-SHA256| MediAssist
    MediAssist -->|Callbacks HMAC-SHA256| Routers
    WhatsAppUser <--> MediAssist

    Services --> Razorpay
    Services --> GeminiAI
    Services --> OpenRouter
    Services --> DailyCo
    Services --> MSG91
    Services --> Exotel
    Services --> EmailGW
```

---

## 2. SYSTEM TIER SPECIFICATIONS

### Tier 1: Client Frontends
1. **Next.js Web Client (`frontend/`):**
   - **Framework:** Next.js 16.2.10 (React 19.2.4, TypeScript 5).
   - **Deployment Target:** Vercel (`https://callmedex-frontend.vercel.app` and `https://callmedex-v1.vercel.app`).
   - **State & Routing:** Next.js App Router with Route Groups:
     - `(public)`: Public marketing, test catalog, provider directory, tracking gateway.
     - `(app)/dashboard`: 11 role-specific dashboards (`patient`, `doctor`, `nurse`, `phlebotomist`, `pharmacy`, `organization`, `processing-center`, `admin`, `supervisor`, `dentist`, `dietitian`, `physiotherapist`).
     - `(app)/booking`: Partner-blind multi-test booking, home collection checkout.
     - `(app)/consultation`: WebRTC telemedicine room, digital consent modal, prescription renderer.
   - **Authentication Transport:** JWT stored in browser local storage / cookies, transmitted via `Authorization: Bearer <token>`.

2. **Mobile Client (`mobile/`):**
   - **Framework:** Expo 52.0.0 (React Native 0.76.6, Expo Router 4.0.0, TypeScript 5.3).
   - **Deployment Target:** iOS (via EAS / TestFlight) and Android (APK / Google Play).
   - **Push Notification Infrastructure:** Native Expo notifications supporting dual delivery:
     - Android: FCM HTTP v1 (`FCM_SERVICE_ACCOUNT_JSON`).
     - iOS: Direct APNs connection (`APNS_KEY_ID`, `APNS_PRIVATE_KEY`).
   - **Hardware Capabilities:** Native biometric authentication (FaceID/TouchID via `expo-local-authentication`), QR/Barcode scanner (`expo-camera`), background geolocation (`expo-location`).

### Tier 2: API Gateway & Orchestration Core (`backend/app/`)
1. **Runtime & Framework:**
   - **Engine:** FastAPI 0.115.0 on Python 3.11+.
   - **Server:** Uvicorn 0.30.0 (with `uvloop` and `httptools` enabled in Linux deployments).
   - **Application Entrypoint:** `backend/app/main.py`.

2. **Middleware Order of Execution (Outermost to Innermost):**
   ```text
   HTTP Request Ingress
     │
     ▼
   1. SecurityMiddleware (app/middleware/security.py)
      - Assigns or extracts X-Request-ID (UUIDv4)
      - Enforces Security Headers (HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: DENY)
      - JSON Body Sanitization (Recursively strips XSS/HTML tags; bypassed for file uploads and MediAssist HMAC webhooks)
     │
     ▼
   2. RateLimitMiddleware (app/middleware/rate_limiter.py)
      - Redis-backed sliding window rate limiter
      - Rate limit: 60 requests/minute per IP (configured via RATE_LIMIT_PER_MINUTE)
      - Adds X-RateLimit-Remaining, X-RateLimit-Limit, X-RateLimit-Reset headers
     │
     ▼
   3. RequestTimeoutMiddleware (app/main.py)
      - Default endpoint timeout: 60 seconds
      - AI & Report analysis timeout: 300 seconds (/api/reports/analyze, /api/telemed/finalize, /api/verification/verify)
      - Returns HTTP 504 Gateway Timeout on expiry
     │
     ▼
   4. GZipMiddleware (starlette)
      - Compresses responses exceeding 500 bytes
     │
     ▼
   5. CORSMiddleware (fastapi)
      - Explicit allowlist: ALLOWED_ORIGINS + FRONTEND_URL
      - Dynamic Vercel preview deployment regex: ^https://(callmedex-v1|callmedex-frontend)(-[a-z0-9\-]+)?\.vercel\.app$
      - Credentials allowed: True
     │
     ▼
   6. CacheControlMiddleware (app/main.py)
      - Public caching headers on static endpoints:
        - /api/health: 30s
        - /api/telemed/doctors: 300s
        - /api/providers/search/: 60s
        - /api/home-services/catalog: 600s
     │
     ▼
   Target APIRouter Handler
   ```

### Tier 3: Asynchronous Background Layer
1. **Message Broker & Cache:**
   - Redis 7 Alpine (`REDIS_URL=redis://redis:6379/0`).
   - Configured with `maxmemory 256mb` and `maxmemory-policy allkeys-lru`.
2. **Celery Worker (`backend/app/workers/celery_app.py`):**
   - Concurrency: 2 worker processes.
   - Dedicated queues: `default`, `dispatch`, `notifications`, `payments`.
3. **Celery Beat Schedules:**
   - `scheduled-dispatch-sweep`: Every 5 minutes (locates bookings due within 4 hours, transitions them to searching, alerts on-duty phlebos).
   - `roster-generation`: Daily at midnight (evaluates active phlebos and assigns shifts).
   - `cleanup-stale-dispatches`: Hourly (cancels expired offers and clears unaccepted requests).
   - `settlement-batch`: Daily at 2:00 AM IST (marks captured payments as settled).

### Tier 4: Persistence & Storage
1. **Primary Database:**
   - Managed PostgreSQL 15+ hosted on Supabase.
   - PostGIS extension activated for geospatial distance calculations (`ST_DWithin`, `ST_Distance`).
   - 86 tables covering authentication, booking lifecycle, laboratory custody, and provider directories.
2. **Object Storage:**
   - Supabase S3-compatible Private Buckets:
     - `verification-docs`: Identity proofs, medical certificates, council registrations, drug licenses.
     - `lab-reports`: Diagnostic test PDF reports, analyzer output CSVs, scan images.
   - Access: Backend issues short-lived presigned URLs (expiry 15–60 minutes) to authorized users; public read is disabled.

### Tier 5: External Service Boundaries
1. **MediAssist AI (ZukoLabs Ecosystem):**
   - **Boundary:** Signed REST contract over HTTP.
   - **CallMedex Responsibilities:** Identity, bookings, billing, processing center operations, phlebotomist dispatch.
   - **MediAssist Responsibilities:** Meta WhatsApp Cloud API integration, document OCR, Groq LLM clinical interpretation.
2. **Payment Gateway (Razorpay):**
   - Generates INR payment orders (`amount_paise`).
   - Signature verification using HMAC-SHA256 with `RAZORPAY_KEY_SECRET`.
3. **AI Gateways:**
   - Google Gemini API (`google-generativeai`): Provider credential OCR and selfie liveness verification.
   - OpenRouter Gateway (`openrouter_client.py`): Multi-model fallback (Qwen 3.7 Flash, DeepSeek v4).
   - Groq (`groq`): Llama 3.3-70b-versatile for voice consultation clinical triage scribing.
4. **Telecommunications:**
   - Daily.co: WebRTC room creation and token generation for teleconsultations.
   - MSG91: Enterprise Indian SMS gateway for transactional OTP and booking SMS.
   - Exotel / Twilio: Masked virtual numbers to enable phone calls between patients and phlebotomists without exposing personal phone numbers.
   - Resend: Transactional email delivery for digital MOUs, account activation, and clinical dispatch alerts.

---

## 3. DEPENDENCY DIRECTION MATRIX

```text
[Client Tier] (Frontend / Mobile)
      │  Depends on API schemas (TokenResponse, BookingResponse)
      ▼
[API Gateway] (FastAPI Routers)
      │  Depends on Domain Services (Never imports database directly in clean routers)
      ▼
[Domain Services] (DispatchEngine, SampleService, MarketplaceService)
      │  Depends on Utilities (Security, Phone, Geocoding)
      │  Depends on Database Client (Supabase singleton)
      │  Enqueues to Celery Broker
      ▼
[Database / Storage Layer] (Supabase PostgreSQL / Redis)
      │
      ▼
[External APIs] (MediAssist, Razorpay, Gemini, Daily.co)
```

**Critical Architectural Rule:**
Under no circumstances does the Database Layer or External Integration call into CallMedex API Routers directly, with the strict exception of **signed webhook endpoints** (`/api/v1/integrations/mediassist/callbacks/*`), which act as ingress adaptors into internal domain events.
