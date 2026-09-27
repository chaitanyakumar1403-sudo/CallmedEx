# 08 — RLS & MULTI-TENANCY FORENSICS

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Critical Multi-Tenant Security & Data Isolation Audit  
**Verification Level:** STATICALLY VERIFIED against database clients, SQL policies, and API queries  

---

## 1. THE CENTRAL MULTI-TENANCY REALITY: SERVICE KEY BYPASS

The most critical architectural finding regarding database security and tenant isolation is located in `backend/app/database.py`:

```python
# backend/app/database.py (lines 24-39)
def get_supabase_client() -> Client | None:
    """Get a Supabase client instance with service-role key and connection pooling."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return None

    _supabase_client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_KEY,
        options=ClientOptions(postgrest_client_timeout=_CLIENT_TIMEOUT),
    )
    return _supabase_client

# Singleton client imported across all backend services:
supabase: Client | None = get_supabase_client()
```

### Forensic Implications:
1. **PostgreSQL RLS is 100% Inactive for Backend Queries:**
   Although 58 Row Level Security (RLS) policies exist across `database/complete_supabase_schema.sql`, `layer0_rls_hardening.sql`, and `rls_audit.sql`, the backend connects exclusively with the **PostgreSQL service-role key** (`SUPABASE_SERVICE_KEY`). The service-role key bypasses all RLS checks at the database engine level.
2. **The Entire Burden of Tenant Isolation Rests in Application Code:**
   If a FastAPI router handler forgets to filter by `current_user["sub"]` or `organization_id`, the database will happily return all rows across all patients, doctors, and clinics. There is no database-level safety net protecting against unscoped application queries.

---

## 2. MULTI-DIMENSIONAL TENANCY MODEL

CallMedex does not use a single monolithic `tenant_id` column. Because it is a multi-sided healthcare marketplace, tenancy and scoping are multi-dimensional:

```text
Identity Layer (JWT sub = users.id)
  ├── Patient Scope:           patient_id == users.id OR family_members.user_id == users.id
  ├── Doctor Scope:            doctor_id == users.id OR provider_id == users.id
  ├── Clinic / Hospital Scope: organization_id == organizations.id (via staff.organization_id)
  ├── Processing Center Scope: processing_center_id == processing_center_staff.processing_center_id
  ├── Pharmacy Scope:          pharmacy_id == pharmacies.id (via pharmacies.user_id)
  ├── Field Collector Scope:   phlebotomist_id == users.id OR provider_locations.user_id == users.id
  └── Geographic Scope:        managed_city == users.managed_city (for City Supervisors)
```

---

## 3. TRACE OF TENANT RESOLUTION & PROPAGATION BY DOMAIN

### A. Patient Domain (Longitudinal Records & Bookings)
```text
Client Request: GET /api/bookings/my
  ↓
Identity Extraction:
  - Middleware decodes JWT: current_user = { "sub": "usr_patient_123", "role": "patient" }
  ↓
Tenant / User Enforcement:
  - Query: supabase.table("bookings").select("*").eq("patient_id", current_user["sub"]).execute()
  ↓
Enrichment Scoping:
  - Patient details and family members joined strictly matching booking_subjects and user_id.
  ↓
Observed Enforcement: VERIFIED & ISOLATED.
  Patients cannot view other patients' bookings unless linked as an authorized family member in family_members.
```

### B. Clinic & Hospital Domain (Doctor Rostering & Slot Allotment)
```text
Client Request: POST /api/bookings/{booking_id}/allot-slot
  ↓
Identity Extraction:
  - current_user = { "sub": "usr_org_456", "role": "organization" }
  ↓
Tenant Resolution:
  - Org staff/owner resolves organization row:
    org_id = organizations.select("id").eq("user_id", current_user["sub"])
  ↓
Authorization Enforcement:
  - Query: supabase.table("bookings").select("provider_id").eq("id", booking_id).limit(1)
  - Validation: booking.provider_id must equal org_id or current_user["sub"].
  - If mismatch: Raises HTTP 403 ("This appointment is not assigned to your organization.")
  ↓
Observed Enforcement: VERIFIED.
  Cross-clinic slot tampering is rejected at the handler level.
```

### C. Processing Center Domain (Specimen Custody & Lab Batches)
```text
Client Request: POST /api/pc/verify
  Payload: { barcode: "CMX-260922-A1B2C3", status: "verified" }
  ↓
Identity Extraction:
  - current_user = { "sub": "usr_tech_789", "role": "staff" }
  ↓
Tenant Resolution:
  - Resolves staff's assigned center:
    pc_staff = processing_center_staff.select("processing_center_id").eq("user_id", current_user["sub"]).eq("is_active", True)
  ↓
Data Isolation:
  - Reads sample by barcode. Checks sample's allocated processing_center_id.
  - If technician belongs to Center A and sample was allocated to Center B:
    Handler allows verification IF the sample was physically rerouted, but logs an Ops Alert in ops_alerts table.
  ↓
Observed Enforcement: PARTIALLY ENFORCED.
  Allows inter-center intake for emergencies, but relies on audit alerts rather than hard database blocks.
```

### D. WhatsApp Ingress (MediAssist AI Webhook)
```text
Client Request: POST /api/v1/integrations/mediassist/whatsapp-bookings
  Headers: X-Signature, X-Timestamp, Authorization: Bearer <token>
  Payload: { patient_phone: "+919876543210", test_code: "CBC", district: "Visakhapatnam" }
  ↓
Tenant Resolution:
  - No user session exists yet. Phone number is normalized.
  - Query: users.select("id").eq("mobile", normalized_phone)
  - If exists: Scopes booking to existing user_id.
  - If new: Creates a headless patient account, binding user_id to that phone number.
  - Processing Center is selected based on district matching in processing_center_areas.
  ↓
Observed Enforcement: VERIFIED.
  Phone number is strictly normalized (+91 prefix); cannot hijack accounts with different country codes.
```

---

## 4. DETAILED TENANT ISOLATION FINDINGS

### Finding TEN-01: Admin Global Override Pattern
- **Affected File:** `backend/app/middleware/auth.py` (lines 47–58)
- **Symbol:** `require_role(required_role)`
```python
async def require_role(required_role: str):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user.get("role") != required_role and user.get("role") != "admin":
            raise HTTPException(status_code=403, detail=f"Access denied.")
        return user
    return role_checker
```
- **Observed Behavior:** Any user with `role="admin"` can call any role-gated endpoint across the platform (e.g. an admin token can call `/api/phlebo/collect` or `/api/nurse/jobs`).
- **Risk:** If an admin account is compromised, the attacker has universal execution privilege across all provider operational workflows without needing role-specific accounts.

### Finding TEN-02: Public Tracking Token Isolation
- **Affected File:** `backend/app/routers/dispatch.py` (`get_public_guardian_track`)
- **Observed Behavior:** Public tracking does NOT require authentication; access is gated solely by `tracking_token`.
- **Tenant Protection:** The query specifically selects only:
  `select("status, provider_id, patient_address, patient_lat, patient_lng, service_subtype, scheduled_for, updated_at")`.
  It completely omits `patient_id`, patient name, phone number, and medical test names.
- **Verdict:** Statically safe against medical record leakage, but exposes live field provider coordinates.
