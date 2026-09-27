# 09 — AUTHORIZATION & IDENTITY FORENSICS

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Complete Authentication, RBAC & Token Security Audit  
**Verification Level:** STATICALLY VERIFIED against auth middleware, JWT validators, and database schemas  

---

## 1. ROLE-BASED ACCESS CONTROL (RBAC) HIERARCHY

CallMedex enforces a 12-role identity model defined in `backend/app/models/schemas.py`:

```text
                          ┌────────────────────────┐
                          │   SUPER ADMIN (Global) │
                          └───────────┬────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │ CITY SUPERVISOR (City)  │
                         └────────────┬────────────┘
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       │                              │                              │
┌──────▼──────┐               ┌───────▼───────┐              ┌───────▼───────┐
│ CLINICAL    │               │ LOGISTICS &   │              │ CONSUMER &    │
│ PROVIDERS   │               │ OPERATIONS    │              │ SUPPORT       │
├─────────────┤               ├───────────────┤              ├───────────────┤
│ Doctor      │               │ Phlebotomist  │              │ Patient       │
│ Nurse       │               │ Pharmacy      │              │ Staff         │
│ Dentist     │               │ Ambulance     │              │               │
│ Dietitian   │               │ Org / Clinic  │              │               │
│ Physio      │               │               │              │               │
└─────────────┘               └───────────────┘              └───────────────┘
```

### RBAC Enforcement Mechanics:
- `require_role(required_role)`: Protects role-specific endpoints (e.g. `require_role("pharmacy")`).
- **Admin Elevation:** Admins automatically satisfy any `require_role` gate due to the explicit `or user.get("role") == "admin"` bypass in `app/middleware/auth.py`.
- **City Scoping for Supervisors:** Handled inside specific admin routes via `check_admin_access(current_user)` which inspects `users.managed_city`. If populated, queries add `.eq("city", managed_city)`.

---

## 2. JWT TOKEN SPECIFICATION & LIFECYCLE

All authenticated user requests transmit a signed JSON Web Token (JWT) in the `Authorization: Bearer <token>` header:

### A. Access Token Claims Schema
```json
{
  "sub": "b2f67a21-91ef-493e-862d-6e3e57140b90",
  "role": "doctor",
  "email": "dr.sharma@callmedex.com",
  "ver": 3,
  "iat": 1727020800,
  "exp": 1727024400
}
```

| Claim | Type | Description | Security Enforcement |
| :--- | :--- | :--- | :--- |
| `sub` | `UUIDv4` | Unique User ID in `users.id` | Used for all user/tenant database scoping. |
| `role` | `string` | User Role string from `UserRole` enum | Gated by `require_role` dependency. |
| `ver` | `integer`| Active session token version | Validated on every request against `users.token_version`. |
| `exp` | `timestamp`| Expiry timestamp | Set to 60 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES=60`). |
| `iat` | `timestamp`| Issued-at timestamp | Enforced by PyJWT / Python-Jose. |

### B. Instant Session Revocation via Token Versioning
To mitigate the risk of stolen 60-minute JWTs, CallMedex implements active token versioning:
1. Every user row in the `users` table contains `token_version INT DEFAULT 1`.
2. Every issued access token contains the claim `"ver": token_version`.
3. In `app/middleware/auth.py` (`get_current_user`), the token's `ver` is checked:
   ```python
   user_id = payload.get("sub")
   token_ver = payload.get("ver", 1)
   if user_id and token_ver:
       if not await validate_token_version(user_id, token_ver):
           raise HTTPException(status_code=401, detail="Session has been revoked.")
   ```
4. When a user logs out (`POST /api/auth/logout`), changes their password, or is banned, the backend executes:
   `UPDATE users SET token_version = token_version + 1 WHERE id = user_id`.
   Every previously minted JWT becomes immediately invalid.

---

## 3. REFRESH TOKEN ROTATION & STORAGE

- **Storage:** Persisted in PostgreSQL table `refresh_tokens` (`id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`).
- **Expiry:** 7 days (`REFRESH_TOKEN_EXPIRE_DAYS=7`).
- **Single-Use Rotation:**
  When `/api/auth/refresh` is called:
  1. The presented refresh token is verified against the database.
  2. The old refresh token is marked `revoked_at = now()`.
  3. A brand new refresh token is minted, hashed, and inserted.
  4. If a revoked token is ever presented again, CallMedex detects a **token replay attack**, immediately revokes all refresh tokens for that user, and increments `users.token_version`.

---

## 4. SPECIALIZED CRYPTOGRAPHIC AUTHORIZATION MECHANISMS

### A. Mobile Hardware Biometric Authentication
- **Registration:** Mobile device generates a public/private keypair in the iOS Secure Enclave or Android Keystore. Sends public key to `POST /api/auth/biometric/register`.
- **Challenge:** Mobile requests a challenge: `POST /api/auth/biometric/challenge` -> receives 32-byte hex challenge with 2-minute TTL.
- **Verification:** Device signs challenge with private key. Server verifies signature against stored public key using `cryptography` library. Upon success, server mints access token without requiring password re-entry.

### B. Single-Use Magic Links for Dispatch Offers
- When an urgent phlebotomist dispatch is raised, an email is sent to the collector containing an ephemeral magic link.
- **HMAC Signature:** `HMAC-SHA256(provider_id + "." + dispatch_id + "." + expires_at, MAGIC_LINK_SECRET)`.
- **Validity:** 10 minutes. Allows field collectors to accept jobs directly from notification banners.

### C. Digital MOU Cryptographic Acceptance
- Non-patient partners cannot access clinical dashboards until accepting an MOU.
- Activation link sent to owner email with token: `HMAC-SHA256(user_id + "." + email + "." + document_hash, EMAIL_TOKEN_SECRET)`.
- Clicking "Accept MOU" captures IP address, user agent, document hash, and timestamp, persisting an immutable record in `mou_acceptances`.
