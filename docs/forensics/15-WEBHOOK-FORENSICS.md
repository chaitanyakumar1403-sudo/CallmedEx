# 15 — WEBHOOK FORENSICS & EVENT INGRESS

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Webhook Ingress, Cryptographic Verification & Replay Protection Audit  
**Verification Level:** STATICALLY VERIFIED against webhook middleware, handlers, and schemas  

---

## 1. COMPREHENSIVE WEBHOOK INVENTORY

CallMedex exposes **6 active webhook ingress endpoints**:

| Subsystem / Source | Endpoint Path | HTTP Method | Authentication Scheme | Idempotency Key Required | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MediAssist AI** | `/api/v1/integrations/mediassist/callbacks/report-processing` | `POST` | HMAC-SHA256 (`X-Signature`) | Yes (`X-Idempotency-Key`) | Notifies CallMedex that OCR/interpretation has begun. |
| **MediAssist AI** | `/api/v1/integrations/mediassist/callbacks/report-delivered` | `POST` | HMAC-SHA256 (`X-Signature`) | Yes (`X-Idempotency-Key`) | Delivers AI interpretation and abnormal lab flags. |
| **MediAssist AI** | `/api/v1/integrations/mediassist/callbacks/report-failed` | `POST` | HMAC-SHA256 (`X-Signature`) | Yes (`X-Idempotency-Key`) | Reports OCR or delivery failure codes. |
| **MediAssist AI** | `/api/v1/integrations/mediassist/callbacks/notification-status` | `POST` | HMAC-SHA256 (`X-Signature`) | Yes (`X-Idempotency-Key`) | WhatsApp message delivery confirmation / failure. |
| **MediAssist AI** | `/api/v1/integrations/mediassist/whatsapp-bookings` | `POST` | HMAC-SHA256 (`X-Signature`) | Yes (`X-Idempotency-Key`) | Forwards parsed WhatsApp booking into CallMedex. |
| **Telephony Gateway**| `/api/communications/webhook/telephony` | `POST` | None (Unsigned Provider Body) | No | Twilio / Exotel masked call duration & status callback. |

---

## 2. CRYPTOGRAPHIC SIGNATURE VERIFICATION PIPELINE

The cryptographic gate protecting MediAssist webhooks is implemented in `backend/app/middleware/mediassist_auth.py`:

```python
# backend/app/middleware/mediassist_auth.py
async def verify_mediassist_signature(request: Request):
    """
    Cryptographically verify incoming MediAssist requests:
      1. Replay prevention: abs(now - X-Timestamp) <= 300s
      2. HMAC-SHA256 signature verification over (timestamp + "." + raw_body)
      3. Service-to-service Bearer token validation
    """
    timestamp = request.headers.get("X-Timestamp")
    signature = request.headers.get("X-Signature", "")
    auth_header = request.headers.get("Authorization", "")
    
    # 1. Bearer Token Check
    expected_token = settings.MEDIASSIST_INBOUND_BEARER_TOKEN or settings.MEDIASSIST_BEARER_TOKEN
    if not auth_header.startswith("Bearer ") or auth_header.split(" ")[1] != expected_token:
        raise HTTPException(status_code=401, detail="Invalid MediAssist bearer token")

    # 2. Replay Protection (5-minute window)
    try:
        req_time = int(timestamp)
        now = int(datetime.now(timezone.utc).timestamp())
        if abs(now - req_time) > 300:
            raise HTTPException(status_code=401, detail="Webhook timestamp expired or clock skewed (>300s)")
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Malformed or missing X-Timestamp")

    # 3. Raw Body HMAC Verification
    raw_body = await request.body()
    if request.method == "GET":
        # GET requests sign the raw query string to prevent parameter tampering
        message = f"{timestamp}.{request.url.query}".encode("utf-8")
    else:
        message = f"{timestamp}.".encode("utf-8") + raw_body

    expected_sig = "sha256=" + hmac.new(
        settings.MEDIASSIST_HMAC_SECRET.encode("utf-8"),
        message,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, signature):
        logger.warning("MediAssist HMAC signature mismatch")
        raise HTTPException(status_code=401, detail="Invalid MediAssist HMAC signature")
```

---

## 3. CRITICAL INTERACTION: MIDDLEWARE SANITIZATION BYPASS

A major architectural trap was identified and handled in `backend/app/middleware/security.py`:
- `SecurityMiddleware` by default reads every incoming JSON POST request, parses it, recursively cleans HTML/script tags, and re-dumps it as a JSON string (`json.dumps`).
- **The Problem:** Re-serializing JSON almost never reproduces the identical byte stream originally sent by MediAssist AI (e.g. whitespace differences, key ordering). Re-serializing breaks `verify_mediassist_signature` on every real webhook.
- **The Fix in Code:**
  ```python
  # backend/app/middleware/security.py (lines 28-36)
  SKIP_SANITIZE_PATHS = (
      "/api/v1/integrations/mediassist/",
      "/api/reports/upload",
      "/api/verification/verify",
      "/webhooks/razorpay",
  )
  ```
  The entire MediAssist integration prefix is excluded from string re-serialization, preserving exact raw bytes for cryptographic hashing.

---

## 4. IDEMPOTENCY & REPLAY PROTECTION IN PRACTICE

### The `mediassist_inbound_requests` Table:
Every inbound POST webhook carries an `X-Idempotency-Key` header generated by MediAssist (UUIDv4).
1. **Pre-Flight Lookup:** Before executing business logic, the router calls `get_cached_idempotent_response(idempotency_key)`.
2. **Cache Hit:** If found, the stored `response_payload` and `status_code` are immediately returned with `X-Cache: HIT`. No database mutations, notifications, or sample derivations are re-executed.
3. **Cache Miss:** The endpoint executes normally, captures the response dict, and calls `store_idempotent_response(idempotency_key, payload, status_code)`.

### Database Schema Constraint:
`mediassist_inbound_requests` has a strict unique constraint:
`CREATE UNIQUE INDEX idx_mediassist_inbound_idempotency_key ON mediassist_inbound_requests (idempotency_key);`
This guarantees that even under extreme concurrent retry bursts from MediAssist, Postgres rejects duplicate writes at the storage layer.

---

## 5. TELEPHONY WEBHOOK VULNERABILITY

### Finding WHK-01: Unsigned Telephony Ingress
- **Affected File:** `backend/app/routers/communications.py` (`telephony_webhook`, line 250)
- **Observed Behavior:**
  ```python
  @router.post("/webhook/telephony")
  async def telephony_webhook(request_data: dict):
      # Parse the webhook payload (format depends on provider)
  ```
  The telephony webhook endpoint does NOT validate Twilio or Exotel cryptographic signature headers (`X-Twilio-Signature` or `X-Exotel-Signature`).
- **Risk:** Any external client on the public internet can POST arbitrary JSON payloads to `/api/communications/webhook/telephony`, potentially spoofing call durations or doctor-patient connection logs.
