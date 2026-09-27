# CallMedex Forensic Intelligence: Unknown Areas & Runtime Verification Boundaries

> **Analysis Scope**: Explicit enumeration of architectural components, external third-party dependencies, physical hardware integrations, and runtime behaviors that CANNOT be conclusively verified through static source code analysis alone and require live environment testing.

---

## 1. Third-Party Gateway & Cloud Provider Unknowns

| Integration / Subsystem | External Dependency | Unknown Runtime Factor | Verification Method Required |
| :--- | :--- | :--- | :--- |
| **SMS OTP Delivery** | MSG91 DLT Gateway | Delivery latency across Indian telecom operators (Jio, Airtel, Vi); DLT template approval status; carrier scrubbing of OTP messages. | Live mobile number testing with real Indian SIM cards across multiple telecom circles. |
| **Online Payments** | Razorpay Route / Marketplace | Real-time webhook delivery latency; UPI auto-debit failure handling; split-settlement processing time to vendor bank accounts. | End-to-end sandbox and live penny-testing using live Razorpay merchant dashboard. |
| **Telemedicine Video** | Daily.co WebRTC | WebRTC connection success rates behind enterprise hospital firewalls and cellular NATs; video frame-rate degradation on 3G/4G connections. | Multi-participant video calls across varied network topologies (Wi-Fi, 4G, throttled 3G). |
| **AI LLM Inference** | Groq & OpenRouter | API rate limits under burst load (e.g. 50 concurrent consultation summaries); token quota exhaustion handling; fallback latency. | Load testing using Locust or k6 simulating concurrent clinical summary generation. |
| **Geocoding & Matrix** | Geoapify Routing API | Geocoding resolution accuracy for informal Indian street addresses; daily query quota limits. | Batch testing with 1,000 representative Indian delivery addresses across Tier-1 and Tier-2 cities. |

---

## 2. Hardware & Native Mobile Device Unknowns

1. **Bedside Optical Barcode Scanning**:
   - *Static Knowledge*: Uses `expo-camera` on mobile and `html5-qrcode` on web.
   - *Runtime Unknown*: Optical focus speed and decode accuracy on curved, reflective vacutainer blood tubes under dim lighting in rural or semi-urban patient homes.
   - *Verification Needed*: Physical testing with various tube sizes (2ml, 4ml, 6ml) and barcode formats (Code 128, QR Code).
2. **Background Location Tracking & OEM Battery Killers**:
   - *Static Knowledge*: Code requests `expo-location` background permissions.
   - *Runtime Unknown*: Aggressive battery management software on popular Indian smartphone brands (Xiaomi MIUI, Vivo FuntouchOS, Realme UI) often terminates background location tasks within 10 minutes of screen lock.
   - *Verification Needed*: Field testing on low-end Android devices across 4-hour simulated phlebotomist shifts.
3. **Biometric Hardware Keystore Binding**:
   - *Static Knowledge*: Implements `expo-local-authentication` challenge/response.
   - *Runtime Unknown*: Hardware Keystore key invalidation behavior when a user adds a new fingerprint to the Android OS settings.

---

## 3. Scale, Concurrency & Database Saturation

1. **PostgREST HTTP Connection Pool Exhaustion**:
   - Because the backend communicates with PostgreSQL via HTTP REST (`supabase-py`), every database query incurs HTTP connection overhead.
   - *Runtime Unknown*: The exact latency overhead and connection pool exhaustion thresholds under 500+ requests per second compared to native libpq connection pooling (e.g., PgBouncer).
2. **Partial Index Performance on Millions of Records**:
   - Partial index `idx_bookings_unique_active_slot` ensures slot locking.
   - *Runtime Unknown*: Query planner performance and cache hit ratio once the `bookings` table surpasses 1,000,000 historical rows.
3. **Redis LRU Cache Eviction Impact**:
   - Redis is configured with `maxmemory 256mb` and `maxmemory-policy allkeys-lru` in Docker/Render.
   - *Runtime Unknown*: Under high load, whether rate-limit counters or phlebotomist geocache keys are prematurely evicted, causing erratic rate limiting.
