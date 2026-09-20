# Universal Self-Service Account Deletion Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a 100% genuine production-level, universal self-service account deletion system with active clinical booking pre-flight checks, 6-digit email OTP verification, atomic cascade database wipe, and a premium CallMedex Royal Blue glassmorphic modal accessible across all user roles.

**Architecture:** 
- Backend: REST endpoints `POST /api/auth/delete-account/request-otp` and `POST /api/auth/delete-account/verify` in `backend/app/routers/auth.py`, backed by active clinical safety validation in `bookings`/`dispatch_requests`/`pharmacy_orders`, transactional email dispatch in `backend/app/services/email.py`, and comprehensive multi-table cascade purging.
- Frontend: Shared `<DeleteAccountModal />` with CallMedex royal blue glassmorphism, 6-digit auto-advancing OTP inputs, countdown timer, and automated session invalidation. Integrated seamlessly into `PatientNavSidebar.tsx`, `patient/page.tsx`, and `DashboardShell.tsx` (for all 14 provider/admin roles).

**Tech Stack:** FastAPI, Python 3.11, Supabase (PostgreSQL), Pytest, Next.js 14 (App Router), React, TypeScript, CSS Glassmorphic Tokens, Lucide Icons, Sonner.

## Global Constraints
- Zero disruption or bugs introduced to existing booking, dispatch, or authentication workflows.
- Active bookings (`pending`, `confirmed`, `in_progress`, etc.) strictly block deletion to prevent orphan clinical dispatches.
- Rate-limited cryptographic 6-digit numeric OTP with 10-minute expiry and max 3 failed attempts.
- Deletion removes user from Supabase Auth admin and all relational tables before deleting from `public.users`.
- Design aesthetics: Deep CallMedex Royal Blue gradient palette (`#1e40af`, `#1d4ed8`, `#0f172a`), `backdrop-filter: blur(20px)`, crisp typography, no generic placeholder styles.

---

### Task 1: Backend Email Service — Royal Blue Deletion OTP Template

**Files:**
- Modify: `backend/app/services/email.py`
- Test: `backend/tests/test_account_deletion.py`

**Interfaces:**
- Produces: `EmailService.send_account_deletion_otp_email(to_email: str, user_name: str, otp: str) -> bool`

- [ ] **Step 1: Write the failing test for email dispatch**
  Add unit test in `backend/tests/test_account_deletion.py` verifying that `send_account_deletion_otp_email` formats HTML content with royal blue branding, displays the OTP, includes security notice, and calls `_send_real_email`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest backend/tests/test_account_deletion.py::test_send_deletion_otp_email -v`
  Expected: FAIL (AttributeError: `send_account_deletion_otp_email` not found).

- [ ] **Step 3: Implement `send_account_deletion_otp_email` in `email.py`**
  Add method with:
  - Subject: `CallMedex Account Deletion Security Code: [OTP]`
  - Official Royal Blue (#1e40af / #1d4ed8) container with CallMedex header
  - Large monospace styled 6-digit OTP code with letter-spacing
  - 10-minute expiration notice
  - Security warning: *"If you did not initiate this request, change your password immediately or contact support@callmedex.in"*
  - Plaintext fallback

- [ ] **Step 4: Run test to verify it passes**
  Run: `pytest backend/tests/test_account_deletion.py::test_send_deletion_otp_email -v`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add backend/app/services/email.py backend/tests/test_account_deletion.py
  git commit -m "feat(auth): add royal blue account deletion otp email service"
  ```

---

### Task 2: Backend API — Active Clinical Safety Check & OTP Request Endpoint

**Files:**
- Modify: `backend/app/routers/auth.py`
- Test: `backend/tests/test_account_deletion.py`

**Interfaces:**
- Produces: `POST /api/auth/delete-account/request-otp`
- Consumes: `get_current_user` dependency, `EmailService.send_account_deletion_otp_email`

- [ ] **Step 1: Write the failing test for active bookings block and OTP generation**
  Add tests in `backend/tests/test_account_deletion.py`:
  - `test_request_otp_blocked_when_active_bookings_exist`: user with `confirmed` booking receives HTTP 400 with active booking warning.
  - `test_request_otp_succeeds_when_no_active_bookings`: user with no active bookings receives HTTP 200, masked email, and OTP is generated.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest backend/tests/test_account_deletion.py::test_request_otp_blocked_when_active_bookings_exist -v`
  Expected: FAIL (HTTP 404 or route not defined).

- [ ] **Step 3: Implement active booking check & `request-otp` route in `auth.py`**
  - Add helper function `_check_active_clinical_records(user_id: str) -> list[str]` querying `bookings`, `dispatch_requests`, and `pharmacy_orders`.
  - Add thread-safe OTP storage structure `_deletion_otps: dict[str, dict]` with fields `{otp, expires_at, attempts, created_at}`.
  - Add rate-limiter check (max 3 requests per 15 minutes).
  - Add endpoint `@router.post("/delete-account/request-otp")` validating current user, checking active records, creating OTP, sending email, and returning masked email + expiration time.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pytest backend/tests/test_account_deletion.py::test_request_otp_blocked_when_active_bookings_exist backend/tests/test_account_deletion.py::test_request_otp_succeeds_when_no_active_bookings -v`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add backend/app/routers/auth.py backend/tests/test_account_deletion.py
  git commit -m "feat(auth): add active booking safety gate and delete-account request-otp endpoint"
  ```

---

### Task 3: Backend API — OTP Verification & Atomic Multi-Table Cascade Purge

**Files:**
- Modify: `backend/app/routers/auth.py`
- Test: `backend/tests/test_account_deletion.py`

**Interfaces:**
- Produces: `POST /api/auth/delete-account/verify`
- Consumes: `get_current_user`, `supabase.auth.admin.delete_user`, `_deletion_otps`

- [ ] **Step 1: Write the failing test for OTP verification and cascading deletion**
  Add tests in `backend/tests/test_account_deletion.py`:
  - `test_verify_otp_invalid_code`: Rejects incorrect OTP and increments attempt counter.
  - `test_verify_otp_locks_after_3_attempts`: Rejects and expires after 3 failures.
  - `test_verify_otp_executes_cascade_deletion`: Confirms complete deletion from `patients`/role profile, `documents`, `family_members`, `slots`, Supabase Auth admin, and `public.users`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pytest backend/tests/test_account_deletion.py::test_verify_otp_executes_cascade_deletion -v`
  Expected: FAIL.

- [ ] **Step 3: Implement `verify` route and atomic cascade deletion logic**
  In `backend/app/routers/auth.py`:
  - Define `DeleteAccountVerifyRequest(BaseModel)` with `otp: str` and `reason: Optional[str] = None`.
  - Validate OTP against stored record in `_deletion_otps`.
  - Execute multi-table cascading delete:
    1. `audit_log` intent capture.
    2. `dispatch_offers` & `dispatch_requests`.
    3. `booking_subjects`, `booking_tests`, `booking_history`, `bookings`.
    4. `family_members`, `ai_report_analyses`, `patient_samples`, `sample_events`, `lab_reports`.
    5. `documents`, `pharmacy_orders`, `consultations`, `chat_messages`, `notifications`, `device_tokens`, `biometric_credentials`, `legal_acceptances`.
    6. Role table deletion (`patients`, `doctors`, `organizations`, `phlebotomists`, `nurses`, `pharmacies`, `dentists`, `dietitians`, `physiotherapists`, `staff`, `provider_locations`, `organization_doctors`, `slots`).
    7. Supabase Auth admin purge: `supabase.auth.admin.delete_user(user_id)`.
    8. `public.users` table delete: `supabase.table("users").delete().eq("id", user_id).execute()`.
    9. Evict from local in-memory stores (`_local_users`, `_local_profiles`, `_deletion_otps`).

- [ ] **Step 4: Run test to verify it passes**
  Run: `pytest backend/tests/test_account_deletion.py -v`
  Expected: ALL PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add backend/app/routers/auth.py backend/tests/test_account_deletion.py
  git commit -m "feat(auth): implement delete-account verify endpoint with atomic cascade cleanup"
  ```

---

### Task 4: Frontend API Client Integration

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `authAPI.requestAccountDeletionOTP()`
- Produces: `authAPI.verifyAccountDeletion(otp: string, reason?: string)`

- [ ] **Step 1: Inspect `frontend/src/lib/api.ts` auth methods**
  Check existing token passing patterns and error handling in `authAPI`.

- [ ] **Step 2: Add account deletion client methods to `authAPI`**
  ```typescript
  requestAccountDeletionOTP: () =>
    apiRequest<any>("/api/auth/delete-account/request-otp", {
      method: "POST",
    }),
  verifyAccountDeletion: (otp: string, reason?: string) =>
    apiRequest<any>("/api/auth/delete-account/verify", {
      method: "POST",
      body: JSON.stringify({ otp, reason }),
    }),
  ```

- [ ] **Step 3: Verify TypeScript builds without errors**
  Run: `npx tsc --noEmit --project frontend/tsconfig.json`
  Expected: Clean compilation with 0 errors.

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/lib/api.ts
  git commit -m "feat(api): add account deletion api client endpoints"
  ```

---

### Task 5: Frontend Component — Royal Blue Glassmorphic `<DeleteAccountModal />`

**Files:**
- Create: `frontend/src/app/components/DeleteAccountModal.tsx`
- Modify: `frontend/src/app/styles/foundation.css` (if custom animation/glass classes needed)

**Interfaces:**
- Produces: `<DeleteAccountModal isOpen={boolean} onClose={() => void} userRole={string} userEmail?: string />`

- [ ] **Step 1: Build `<DeleteAccountModal />` component**
  - **Glassmorphic Royal Blue Styling:**
    - Gradient: `linear-gradient(145deg, rgba(15, 23, 42, 0.97) 0%, rgba(30, 58, 138, 0.92) 50%, rgba(15, 23, 42, 0.97) 100%)`
    - Backdrop: `backdrop-filter: blur(24px) saturate(180%)`
    - Royal Blue glow accents and 1px border `rgba(59, 130, 246, 0.4)`
  - **Stage 1 (Warning & Safety Check):**
    - ShieldAlert icon in royal blue / danger gradient.
    - Clinical safety pre-flight pill.
    - Summary of permanent data loss (medical records, prescriptions, family profiles, booking history).
    - "Send 6-Digit Code" button with loading spinner.
  - **Stage 2 (OTP Verification):**
    - 6 discrete single-digit input boxes with auto-focus, backspace jumping, paste handling.
    - Masked email label (`ch****@gmail.com`).
    - 60-second resend countdown timer.
    - Optional feedback reason selector.
    - Danger button: "Permanently Delete My Account".
  - **Stage 3 (Success & De-authentication):**
    - Animated completion badge.
    - Token wipe (`localStorage.removeItem('token')`, `localStorage.removeItem('user')`, cookie clean).
    - Toast notification via `toast.success`.
    - Clean redirect to `/`.

- [ ] **Step 2: Verify component TypeScript and JSX rendering**
  Run: `npx tsc --noEmit --project frontend/tsconfig.json`
  Expected: 0 errors.

- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/app/components/DeleteAccountModal.tsx frontend/src/app/styles/foundation.css
  git commit -m "feat(ui): create royal blue glassmorphic DeleteAccountModal component"
  ```

---

### Task 6: Patient Dashboard Integration (`PatientNavSidebar` & Main View)

**Files:**
- Modify: `frontend/src/app/(app)/dashboard/components/PatientNavSidebar.tsx`
- Modify: `frontend/src/app/(app)/dashboard/patient/page.tsx`

**Interfaces:**
- Consumes: `<DeleteAccountModal />`, `DASHBOARD_SECTIONS`

- [ ] **Step 1: Update `PatientNavSidebar.tsx`**
  - In `DASHBOARD_SECTIONS`, append below `recent-bookings`:
    ```typescript
    {
      id: "account-settings",
      label: "Account & Privacy",
      icon: ShieldAlert,
      type: "anchor",
      target: "#account-settings",
    }
    ```
  - In sidebar footer: Add subtle "Delete Account" action button that opens modal directly.

- [ ] **Step 2: Update `frontend/src/app/(app)/dashboard/patient/page.tsx`**
  - Add section `#account-settings` at the bottom of the main content column (below recent bookings card).
  - Design premium glassmorphic "Account & Data Management" card featuring:
    - User name, role badge, ABHA / Account ID.
    - Data retention & DPDP compliance note.
    - High-visibility "Delete Account" button opening the modal.
  - Mount `<DeleteAccountModal />` controlled by state `isDeleteModalOpen`.

- [ ] **Step 3: Verify TypeScript and layout compilation**
  Run: `npx tsc --noEmit --project frontend/tsconfig.json`
  Expected: 0 errors.

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/app/(app)/dashboard/components/PatientNavSidebar.tsx "frontend/src/app/(app)/dashboard/patient/page.tsx"
  git commit -m "feat(patient-dash): integrate account deletion in sidebar and main portal view"
  ```

---

### Task 7: Universal Provider Dashboards Integration (`DashboardShell.tsx`)

**Files:**
- Modify: `frontend/src/app/(app)/dashboard/components/DashboardShell.tsx`

**Interfaces:**
- Consumes: `<DeleteAccountModal />`, `role: DashRole`

- [ ] **Step 1: Update `DashboardShell.tsx`**
  - In the provider sidebar widget (above `cm-provider-nav-footer`), add an **Account Security & Deletion** trigger:
    ```tsx
    <div className="cm-provider-nav-danger-zone">
      <button
        type="button"
        onClick={() => setDeleteModalOpen(true)}
        className="cm-provider-nav-delete-btn"
      >
        <Trash2 size={13} />
        <span>Delete Account</span>
      </button>
    </div>
    ```
  - Mount `<DeleteAccountModal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} userRole={role} />`.
  - Add CSS styling in `foundation.css` for `.cm-provider-nav-danger-zone` and `.cm-provider-nav-delete-btn` with subtle, elegant glassmorphic styling that fits CallMedex aesthetics.

- [ ] **Step 2: Verify TypeScript compilation across all dashboards**
  Run: `npx tsc --noEmit --project frontend/tsconfig.json`
  Expected: 0 errors.

- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/app/(app)/dashboard/components/DashboardShell.tsx frontend/src/app/styles/foundation.css
  git commit -m "feat(dashboards): integrate universal account deletion trigger in DashboardShell"
  ```

---

### Task 8: End-to-End Verification & Session Documentation

**Files:**
- Create: `backend/tests/test_account_deletion_e2e.py`
- Create: `docs/sessions/SESSION_02_UNIVERSAL_ACCOUNT_DELETION_ENGINE.md`

- [ ] **Step 1: Execute Full Backend Test Suite**
  Run: `pytest backend/tests/test_account_deletion.py -v`
  Expected: 100% tests passing.

- [ ] **Step 2: Execute Frontend Production Build Check**
  Run: `npm run build` (or Next.js compile check) from `frontend/`.
  Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Write Session Memory Documentation**
  Create `docs/sessions/SESSION_02_UNIVERSAL_ACCOUNT_DELETION_ENGINE.md` capturing all changes, endpoints, security policies, UI tokens, and forensic verification receipts.

- [ ] **Step 4: Commit**
  ```bash
  git add docs/sessions/SESSION_02_UNIVERSAL_ACCOUNT_DELETION_ENGINE.md
  git commit -m "docs(session-02): forensic documentation of universal account deletion engine"
  ```
