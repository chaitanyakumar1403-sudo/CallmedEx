# 21 — CONFIGURATION & SECRET HYGIENE FORENSICS

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Configuration Audit, Secret Hygiene & Environment Variable Catalog  
**Verification Level:** STATICALLY VERIFIED against `app/config.py`, `render.yaml`, and `.env.example`  

---

## 1. COMPREHENSIVE ENVIRONMENT VARIABLES CATALOG

All backend configuration variables are loaded and validated in `backend/app/config.py`:

| Variable Name | Required / Optional | Default Value (Dev) | Consuming Service | Security Implications |
| :--- | :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | **Required** | `""` | `app/database.py` | Connection endpoint for database and private storage. |
| `SUPABASE_KEY` | Optional | `""` | `app/database.py` | Anonymous client key (respects RLS, rarely used). |
| `SUPABASE_SERVICE_KEY` | **Required** | `""` | `app/database.py` | **Superuser Service Key (bypasses RLS entirely).** |
| `JWT_SECRET` | **Required** | `""` (No default in prod) | `app/utils/security.py` | Signs session JWTs. If weak, startup is blocked. |
| `JWT_ALGORITHM` | Optional | `"HS256"` | `app/utils/security.py` | HMAC algorithm for JWT signing. |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| Optional | `60` | `app/utils/security.py` | Session duration (60 minutes). |
| `REFRESH_TOKEN_EXPIRE_DAYS`| Optional | `7` | `app/utils/security.py` | Refresh token lifecycle window. |
| `EMAIL_TOKEN_SECRET` | Optional | Falls back to `JWT_SECRET` | `app/services/email.py` | Signs single-use digital MOU email links. |
| `MAGIC_LINK_SECRET` | Optional | Falls back to `JWT_SECRET` | `app/services/magic_link.py`| Signs ephemeral 10-minute dispatch acceptance links. |
| `APP_ENV` | **Required** | `"development"` | Multiple modules | Toggles mock behaviors vs strict production gates. |
| `OTP_PROVIDER` | Optional | `"mock"` (dev) / `"msg91"` | `app/services/sms_otp.py` | If `"mock"`, logs OTP to console without SMS dispatch. |
| `ENABLE_DEV_MOCK_PAYMENT` | Optional | `True` (dev) / `False` (prod) | `app/services/payment.py` | Simulates Razorpay order creation in local dev. |
| `BACKEND_PORT` | Optional | `8000` | `app/main.py` | Local HTTP binding port. |
| `FRONTEND_URL` | **Required** | `"https://callmedex-frontend.vercel.app"` | `app/main.py` | CORS allowlist base; prod refuses localhost. |
| `ALLOWED_ORIGINS` | Optional | Comma-separated list | `app/main.py` | CORS allowed origins list. |
| `REDIS_URL` | **Required** | `"redis://localhost:6379/0"` | Rate limiter, Celery | Message broker and sliding window cache. |
| `RATE_LIMIT_PER_MINUTE` | Optional | `60` | `app/middleware/rate_limiter.py` | Max HTTP requests per minute per IP. |
| `GEMINI_API_KEY` | **Required (AI)** | `""` | `app/services/ai_ocr.py` | Google Gemini Vision key for document OCR & liveness. |
| `OPENROUTER_API_KEY` | **Required (Reports)**| `""` | `app/services/openrouter_client.py` | Multi-model gateway for lab report interpretation. |
| `OPENROUTER_VISION_MODEL` | Optional | `"qwen/qwen3.7-flash"` | `app/services/openrouter_client.py` | Primary OCR model ID. |
| `OPENROUTER_ANALYSIS_MODEL`| Optional | `"deepseek/deepseek-v4-flash-0731"`| `app/services/openrouter_client.py` | Clinical report analysis model ID. |
| `GROQ_API_KEY` | Optional | `""` | `app/services/ai_voice_scribe.py` | Fast Llama 3.3-70b voice consultation transcription. |
| `DAILY_API_KEY` | Optional | `""` | `app/services/telemedicine.py` | Clinical WebRTC video room creation. |
| `RAZORPAY_KEY_ID` | **Required (Payments)**| `""` | `app/services/payment.py` | Razorpay public key for checkout modal. |
| `RAZORPAY_KEY_SECRET` | **Required (Payments)**| `""` | `app/services/payment.py` | Razorpay private secret for HMAC verification. |
| `MEDIASSIST_BASE_URL` | **Required (WhatsApp)**| `"http://localhost:8000"` | `app/integrations/mediassist_client.py` | External MediAssist AI platform base URL. |
| `MEDIASSIST_BEARER_TOKEN` | **Required (WhatsApp)**| `""` | `app/integrations/mediassist_client.py` | Service token presented to MediAssist AI. |
| `MEDIASSIST_HMAC_SECRET` | **Required (WhatsApp)**| `""` | `app/middleware/mediassist_auth.py` | Shared symmetric secret for webhook HMAC-SHA256. |
| `MEDIASSIST_INBOUND_BEARER_TOKEN`| Optional | Falls back to bearer token | `app/middleware/mediassist_auth.py` | Token required on incoming MediAssist callbacks. |
| `MSG91_AUTH_KEY` | Optional | `""` | `app/services/sms_otp.py` | MSG91 SMS gateway authentication key. |
| `MSG91_TEMPLATE_ID` | Optional | `""` | `app/services/sms_otp.py` | DLT-registered 6-digit OTP SMS template. |
| `MSG91_FLOW_ID` | Optional | `""` | `app/services/sms_otp.py` | DLT-registered notification SMS template. |
| `FCM_SERVICE_ACCOUNT_JSON` | Optional | `""` | `app/services/push.py` | Full Google Service Account JSON for FCM v1. |
| `APNS_PRIVATE_KEY` | Optional | `""` | `app/services/push.py` | Apple .p8 private key for direct iOS push. |
| `USE_MOCK_GOV_API` | **High Risk** | `False` | `app/services/gov_registry.py` | Auto-approves doctor licenses if True. |
| `VERIFICATION_AUTO_APPROVE`| Optional | `True` | `app/services/verification.py` | Auto-approves OCR matches without admin review. |
| `ENABLE_NHCX_INSURANCE` | Optional | `False` | `app/services/nhcx.py` | Toggles mock NHCX cashless insurance scaffolding. |

---

## 2. STARTUP SECRET HYGIENE GATES (`backend/app/main.py`)

The platform implements strict pre-flight assertions during `lifespan` initialization:

1. **Weak JWT Secret Rejection:**
   In `jwt_secret_warning()`:
   - Evaluates whether `JWT_SECRET` is blank, shorter than 32 characters, or matches known repo placeholders:
     `{"callmedex-dev-secret", "change-me", "secret", "changeme", "callmedex-jwt-secret-change-in-production"}`.
   - **Enforcement:** If `APP_ENV in ('production', 'staging')`, the application **terminates immediately with exit code 1** rather than starting with an insecure key.
2. **Localhost Frontend Rejection in Production:**
   If `APP_ENV == "production"` and `FRONTEND_URL.startswith("http://localhost")`, the server refuses to boot.
3. **Unauthenticated Redis Rejection in Production:**
   If `APP_ENV == "production"` and `REDIS_URL` points to an unauthenticated localhost instance, a critical security alert is emitted.
