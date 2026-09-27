# CallMedex Forensic Intelligence: Dependency Audit & Supply Chain Analysis

> **Analysis Scope**: Deep-dive forensic review of all dependency specifications across Backend (`backend/requirements.txt`), Web Frontend (`frontend/package.json`), and Mobile (`mobile/package.json`), evaluating pinning hygiene, absent dependencies, license footprints, supply-chain vulnerabilities, and operational architectural implications.

---

## 1. Executive Summary & Critical Observations

1. **Absence of Direct Database Drivers & ORMs**:
   - The Python backend contains **no direct PostgreSQL driver** (`psycopg2`, `psycopg3`, `asyncpg`) and **no ORM** (`SQLAlchemy`, `Tortoise`, `Django ORM`).
   - Database persistence relies solely on `supabase>=2.15.0` (which wraps `postgrest-py` and `httpx`). All database operations travel over HTTP/REST rather than persistent binary wire protocols (libpq).
2. **Absence of WhatsApp & Browser Scraping Libraries in Backend**:
   - Despite extensive documentation referencing WhatsApp Cloud API and MocDoc EHR scraping, the backend contains **zero Meta Cloud SDKs** and **zero browser automation packages** (`playwright`, `selenium`, `pyppeteer`).
   - As established in `docs/forensics/10-WHATSAPP-FORENSICS.md` and `13-CONNECTOR-FORENSICS.md`, WhatsApp and MocDoc are completely offloaded to MediAssist AI (`ZukoLabs`/`KriyaAI`).
3. **Frontend / Mobile Framework Skew**:
   - **Web Frontend**: Built on **Next.js 16.2.10** with **React 19.2.4** (`frontend/package.json`).
   - **Mobile Client**: Built on **Expo SDK 52** (`~52.0.0`) with **React Native 0.76.6** and **React 18.3.1**.
   - Shared code between web and mobile must respect React 18 vs React 19 differences (e.g., hooks behavior, React Server Components vs Native components).
4. **Dangerous Unpinned Dependencies**:
   - Backend specifies `Pillow` completely unpinned, and packages like `groq>=0.9.0`, `google-generativeai>=0.8.3`, `redis>=5.0.0`, `celery>=5.3.0`, and `razorpay>=1.4.0` without upper bounds (`<`), creating major risks of breaking changes during automated Docker builds.

---

## 2. Backend Dependency Tree (`backend/requirements.txt`)

### 2.1 Manifest Specification Table

| Package | Version Specified | Pinning Category | Functional Role | Architectural Risk / Notes |
| :--- | :--- | :--- | :--- | :--- |
| `fastapi` | `0.115.0` | Exact (`==`) | Core ASGI REST Web Framework | Stable, modern ASGI framework. |
| `uvicorn[standard]` | `0.30.0` | Exact (`==`) | ASGI Application Server | Standard extras pull `uvloop`, `httptools`, `websockets`. |
| `supabase` | `>=2.15.0` | Open Minimum (`>=`) | Supabase Client Wrapper | Bypasses direct SQL wire; wraps `postgrest-py` via HTTP. |
| `python-jose[cryptography]` | `3.3.0` | Exact (`==`) | JWT Token Encode/Decode | Cryptography extra provides secure signature verification. |
| `passlib[bcrypt]` | `1.7.4` | Exact (`==`) | Password Hashing Abstraction | Deprecated internally in favor of direct `bcrypt` calls. |
| `python-multipart` | `0.0.9` | Exact (`==`) | Multipart Form Data Parser | Required for file uploads (MOU, medical reports, certificates). |
| `python-dotenv` | `1.0.1` | Exact (`==`) | Environment Variable Loader | Loads `.env` during local dev bootstrap. |
| `pydantic[email]` | `2.9.0` | Exact (`==`) | Data Validation & Settings | V2 Pydantic core with email validation extras. |
| `email-validator` | `>=2.0.0` | Open Minimum (`>=`) | RFC Email Syntax Validation | Dependency for `pydantic.EmailStr`. |
| `httpx` | `0.27.0` | Exact (`==`) | Async HTTP Client | Powers outbound calls to MediAssist, Gemini, OpenRouter, Daily.co. |
| `bcrypt` | `3.2.2` | Exact (`==`) | Cryptographic Key Derivation | Hard-pinned to 3.2.2 to prevent passlib 4.0 breakage. |
| `Pillow` | *(none)* | **Unpinned** | Image Processing & Manipulation | **HIGH RISK**: Any major Pillow release could break image verification. |
| `groq` | `>=0.9.0` | Open Minimum (`>=`) | Groq Cloud AI Inference SDK | Used for Llama 3.3-70b clinical voice scribe. |
| `google-generativeai` | `>=0.8.3` | Open Minimum (`>=`) | Google Gemini Vision & LLM SDK | Used for Aadhaar, degree, and sample label vision parsing. |
| `google-auth` | `>=2.35.0` | Open Minimum (`>=`) | Google Service Account Auth | Required for FCM HTTP v1 push notifications (`app/services/push.py`). |
| `pymupdf` | `>=1.24.0` | Open Minimum (`>=`) | In-Memory PDF Processing | Used for MOU generation and report watermarking/stamping. |
| `twilio` | `>=9.0.0` | Open Minimum (`>=`) | Telephony Masked Calling SDK | Masked calling between phlebotomist and patient. |
| `redis` | `>=5.0.0` | Open Minimum (`>=`) | Redis In-Memory Client | Caching, rate limiting, and Celery broker transport. |
| `celery` | `>=5.3.0` | Open Minimum (`>=`) | Distributed Task Queue | Scheduled sweeps, reminders, and background retry loops. |
| `razorpay` | `>=1.4.0` | Open Minimum (`>=`) | Razorpay Payment Gateway SDK | Order creation, payment capture, refund execution. |
| `uvloop` | `>=0.19.0` | Platform Constrained | High-performance Event Loop | Skipped on Windows (`sys_platform != 'win32'`). |
| `httptools` | `>=0.6.0` | Platform Constrained | C-based HTTP Parser | Skipped on Windows (`sys_platform != 'win32'`). |

### 2.2 Critical Dependency Gaps (What is NOT in `requirements.txt`)

1. **No Database Driver**: Neither `psycopg2-binary` nor `asyncpg` is present.
   - *Impact*: CallMedex cannot perform native database connection pooling (e.g. PgBouncer binary protocol), native transactional block rollbacks (`BEGIN ... COMMIT`), or raw advisory locks.
2. **No Meta WhatsApp Business SDK**:
   - *Impact*: Backend does not communicate with Meta Graph API directly. It only receives webhook-like calls from MediAssist AI.
3. **No Web Scraping Framework**:
   - *Impact*: `playwright`, `selenium`, `beautifulsoup4` are completely absent. All hospital EHR automation is externalized.
4. **No Health / HL7 / FHIR SDK**:
   - *Impact*: No `fhir.resources` or HL7 v2 parser. ABDM compliance payloads are constructed manually via raw Pydantic dictionaries.

---

## 3. Web Frontend Dependency Tree (`frontend/package.json`)

### 3.1 Production Dependencies

```json
{
  "dependencies": {
    "@types/three": "^0.185.4",
    "html5-qrcode": "^2.3.8",
    "lucide-react": "^1.27.0",
    "next": "16.2.10",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "sonner": "^2.0.7",
    "three": "^0.185.1",
    "xlsx": "^0.18.5"
  }
}
```

### 3.2 Evaluation of Web Dependencies

| Package | Version | Purpose | Architectural Implications |
| :--- | :--- | :--- | :--- |
| `next` | `16.2.10` | Fullstack SSR / Static Web Framework | Bleeding-edge Next.js App Router; React Server Components. |
| `react` / `react-dom` | `19.2.4` | Core UI View Engine | React 19 production build. Uses standard React Actions & compiler hooks. |
| `three` | `^0.185.1` | WebGL 3D Anatomy Render Engine | Powers the 3D interactive human body map for anatomical symptom selection. |
| `html5-qrcode` | `^2.3.8` | Browser Camera Barcode / QR Scanner | Enables processing center accessioning and phlebotomist tube verification via laptop/webcam. |
| `sonner` | `^2.0.7` | UI Notification / Toast Engine | Lightweight toast notification stack. |
| `lucide-react` | `^1.27.0` | Iconography System | Universal SVG icons matching mobile icon tokens. |
| `xlsx` | `^0.18.5` | SheetJS Excel Import / Export | Enables export of supervisor logs, audit reports, and billing rosters. |

### 3.3 Dev & Test Dependencies
- `@playwright/test` (`^1.61.1`): End-to-end headless browser regression suite (`frontend/e2e/`).
- `@axe-core/playwright` (`^4.12.1`): Automated WCAG / accessibility auditing in CI pipelines.
- `typescript` (`^5`): Modern TypeScript compilation.

---

## 4. Mobile Client Dependency Tree (`mobile/package.json`)

### 4.1 Production Dependencies

```json
{
  "expo": "~52.0.0",
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "react-native": "0.76.6",
  "expo-router": "~4.0.0",
  "expo-camera": "~16.0.0",
  "expo-location": "~18.0.2",
  "expo-local-authentication": "~15.0.1",
  "expo-notifications": "~0.29.11",
  "expo-secure-store": "~14.0.0",
  "expo-file-system": "~18.0.4",
  "expo-haptics": "~14.0.0",
  "expo-document-picker": "~13.0.1",
  "expo-image-picker": "~16.0.3",
  "expo-linear-gradient": "~14.0.1",
  "expo-linking": "^7.0.5",
  "expo-blur": "~14.0.1",
  "expo-crypto": "~14.0.1",
  "expo-device": "~7.0.1",
  "expo-splash-screen": "~0.29.18",
  "expo-status-bar": "~2.0.0",
  "expo-system-ui": "~4.0.4",
  "expo-web-browser": "~14.0.1",
  "lucide-react-native": "^0.475.0",
  "react-native-gesture-handler": "~2.20.2",
  "react-native-reanimated": "~3.16.1",
  "react-native-safe-area-context": "4.12.0",
  "react-native-screens": "~4.4.0",
  "react-native-svg": "15.8.0",
  "react-native-web": "~0.19.13",
  "@react-native-async-storage/async-storage": "1.23.1"
}
```

### 4.2 Hardware & Native Module Bindings

1. **Biometric Security**: `expo-local-authentication` (`~15.0.1`) interfaces with Android BiometricPrompt and iOS FaceID/TouchID for supervisor/phlebotomist attendance authentication.
2. **Secure Token Storage**: `expo-secure-store` (`~14.0.0`) stores JWT access tokens and biometric challenge private keys in hardware Keystore / Keychain.
3. **Real-Time GPS Tracking**: `expo-location` (`~18.0.2`) provides continuous foreground and background phlebotomist location updates to `/api/v1/dispatch/location`.
4. **Barcode Scanning**: `expo-camera` (`~16.0.0`) provides native camera frames to scan vacutainer sample barcodes at patient bedside.
5. **Push Notifications**: `expo-notifications` (`~0.29.11`) receives APNs (iOS) and FCM (Android) dispatch offers and emergency SOS alerts.

---

## 5. Security & Vulnerability Analysis

### 5.1 Supply Chain Risk Matrix

| Component | Package | Risk Level | Description & Vulnerability Vector | Mitigation / Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Backend** | `Pillow` | **HIGH** | Unpinned version. Historically susceptible to arbitrary code execution via crafted image headers (CVE-2023-50447, CVE-2024-28219). | Pin to specific patch version (e.g. `Pillow==10.4.0`) in `requirements.txt`. |
| **Backend** | `python-jose` | **MEDIUM** | Maintenance stalled on `python-jose`. Potential algorithm confusion bugs if cryptography backend isn't strictly enforced. | Uses `cryptography` extra (`python-jose[cryptography]==3.3.0`) with explicit algorithms `["HS256"]`. |
| **Backend** | `passlib` | **LOW** | Passlib is unmaintained; throws deprecation warnings on newer Python/bcrypt versions. | Pinned to `bcrypt==3.2.2` to prevent hash format incompatibility. |
| **Frontend** | `xlsx` | **MEDIUM** | Older SheetJS versions have documented prototype pollution and ReDoS vulnerabilities (CVE-2023-30533). | Pinned to `0.18.5`. Upgrade to official `@sheet/sheetjs` registry release recommended. |
| **Frontend** | `html5-qrcode` | **LOW** | Client-side only. Camera access requires user permission; no server execution. | Verified contained within browser sandbox. |

---

## 6. License Footprint Analysis

| Manifest | Dominant Licenses | High-Risk Copyleft Licenses | Compliance Assessment |
| :--- | :--- | :--- | :--- |
| **Backend** | MIT, Apache 2.0, BSD-3-Clause | None (No GPL / AGPL detected) | **CLEAN**: Permissive commercial use. |
| **Frontend** | MIT, Apache 2.0 | None (SheetJS 0.18.5 is Apache 2.0) | **CLEAN**: Permissive commercial use. |
| **Mobile** | MIT, Apache 2.0 | None | **CLEAN**: Permissive commercial use. |
