# Technical Design Specification: Universal Self-Service Account Deletion Engine

**Document Date:** September 20, 2026  
**Status:** Approved  
**Author:** Antigravity AI Engineering & CallMedex Core Architecture  
**Target Systems:** `backend/app/routers/auth.py`, `backend/app/services/email.py`, `frontend/src/app/components/DeleteAccountModal.tsx`, `frontend/src/app/(app)/dashboard/components/PatientNavSidebar.tsx`, `frontend/src/app/(app)/dashboard/components/DashboardShell.tsx`, `frontend/src/app/(app)/dashboard/patient/page.tsx`

---

## 1. Executive Summary & Context

Under Indian data privacy guidelines (DPDP Act 2023) and consumer digital healthcare platform standards (comparable to Swiggy, Practo, and Apollo 24/7), platform users across **all roles** (patients, doctors, phlebotomists, nurses, organizations, pharmacies, dentists, dietitians, physiotherapists, and staff) must be provided a secure, self-service mechanism to permanently delete their account and associated data directly from within their authenticated workspace.

This specification details the end-to-end architecture of CallMedex's Universal Account Deletion Engine:
1. A **Royal Blue Glassmorphic UI Widget** (`<DeleteAccountModal />`) embedded into `DashboardShell` (for all provider/admin roles) and `PatientNavSidebar` / Patient Dashboard (for patients).
2. An **Active Clinical Safety Pre-flight** that blocks deletion if the account has ongoing, active, or in-progress clinical bookings, pending sample collections, active dispatches, or unfulfilled pharmacy orders.
3. A **Cryptographic 6-Digit Email OTP Verification Flow** via CallMedex's transactional email service (`EmailService`).
4. An **Atomic Cascading Deletion Engine** that purges records across child role tables, documents, historical logs, dispatch offers, appointments, and Supabase Auth admin before removing the user from `public.users`.
5. An **Automated Session Invalidation & State Purge** on the client.

---

## 2. Safety Invariants & Pre-flight Gates

To prevent operational disruptions, orphan orders, or clinical safety hazards, an account cannot be deleted while active workflows are open.

### 2.1 Active Status Checks
Before issuing a deletion OTP or executing deletion, the backend checks:
1. **`bookings` table**:
   - Condition: `(patient_id = :uid OR provider_id = :uid)`
   - Blocking Statuses: `['pending', 'searching', 'provider_notified', 'provider_accepted', 'confirmed', 'checked_in', 'in_progress']`
2. **`dispatch_requests` table**:
   - Condition: `(patient_id = :uid OR assigned_provider_id = :uid)`
   - Blocking Statuses: `['searching', 'offered', 'accepted', 'in_transit', 'arrived', 'sample_collected']`
3. **`pharmacy_orders` table**:
   - Condition: `(patient_id = :uid OR pharmacy_id = :uid)`
   - Blocking Statuses: `['pending', 'confirmed', 'preparing', 'out_for_delivery']`

### 2.2 Rejection Behavior
If any active workflow exists:
- HTTP 400 Bad Request is returned immediately with `code="ACTIVE_BOOKINGS_EXIST"`.
- The user is provided a structured list of active booking/dispatch references.
- The UI renders an informative warning instructing them to either complete or cancel the active booking/service before deleting the account.

---

## 3. Backend Architecture & Endpoints

All endpoints reside in `backend/app/routers/auth.py` and require Bearer JWT authentication (`Depends(get_current_user)`).

### 3.1 `POST /api/auth/delete-account/request-otp`
* **Purpose:** Validates active orders, generates a secure 6-digit deletion OTP, records it with a 10-minute expiry, and sends the CallMedex royal blue styled verification email.
* **Security:**
  * Rate-limited: Maximum 3 OTP requests per 15 minutes per user.
  * OTP generation: `secrets.randbelow(900000) + 100000` (cryptographically uniform 6 digits).
  * Storage: Stored with `user_id`, `purpose="account_deletion"`, `expires_at = now() + 10 mins`, and `failed_attempts = 0`.
* **Response:**
  ```json
  {
    "success": true,
    "message": "A 6-digit verification code has been sent to your registered email.",
    "masked_email": "ch****@gmail.com",
    "expires_in_seconds": 600
  }
  ```

### 3.2 `POST /api/auth/delete-account/verify`
* **Purpose:** Verifies the 6-digit OTP and initiates the atomic cascading database wipe.
* **Payload:**
  ```json
  {
    "otp": "481923",
    "reason": "Privacy preference"
  }
  ```
* **Validation:**
  * Checks code match and timestamp < `expires_at`.
  * Increments `failed_attempts`; locks OTP after 3 consecutive failures.
* **Execution Sequence (Atomic Cleanup):**
  1. **Log Audit Intent:** Insert record into `audit_log` with `event="account_self_deleted"`, capturing user ID, role, and timestamp before primary foreign key destruction.
  2. **Child Dispatch & Offers:**
     - Delete `dispatch_offers` for requests where `patient_id` or `assigned_provider_id` matches.
     - Delete `dispatch_requests` for user.
  3. **Bookings & Tests:**
     - Delete `booking_subjects` and `booking_tests` for patient bookings.
     - Delete `booking_history` for user bookings.
     - Delete `bookings` where `patient_id = :uid` or `provider_id = :uid`.
  4. **Health & Clinical Auxiliary:**
     - Delete `family_members` where `account_user_id = :uid`.
     - Delete `ai_report_analyses`, `patient_samples`, `sample_events`, `lab_reports`.
     - Delete `documents` where `user_id = :uid`.
     - Delete `pharmacy_orders` where `patient_id = :uid`.
     - Delete `consultations` where `patient_id = :uid` or `provider_id = :uid`.
  5. **Communications & Messaging:**
     - Delete `chat_messages` where `sender_id = :uid` or `receiver_id = :uid`.
     - Delete `notifications` where `user_id = :uid`.
     - Delete `device_tokens` and `biometric_credentials` where `user_id = :uid`.
     - Delete `legal_acceptances` where `user_id = :uid`.
  6. **Role Profiles:**
     - Delete from specific profile table: `patients`, `doctors`, `phlebotomists`, `nurses`, `organizations`, `staff`, `pharmacies`, `dentists`, `dietitians`, `physiotherapists`.
     - Delete from `provider_locations`, `organization_doctors`, `slots`.
  7. **Identity Deletion:**
     - Invoke `supabase.auth.admin.delete_user(user_id)` to permanently destroy Supabase Auth identity.
     - Execute `DELETE FROM users WHERE id = :uid`.
     - Clear local in-memory dictionaries (`_local_users`, `_local_profiles`).
* **Response:**
  ```json
  {
    "success": true,
    "message": "Account and all associated records have been permanently deleted."
  }
  ```

---

## 4. Email Service Integration (`EmailService`)

A new method in `backend/app/services/email.py`:
`send_account_deletion_otp_email(to_email: str, user_name: str, otp: str)`:
* **Branding:** Official CallMedex Royal Blue theme (`#1e40af`, `#1d4ed8`, `#0f172a`).
* **Visual Elements:**
  * CallMedex Healthcare Shield Icon header.
  * Prominent 6-digit OTP card formatted in 32px monospace font with letter spacing.
  * Explicit 10-minute validity notice.
  * Red security callout: *"If you did not initiate this account deletion request, please log in immediately and change your password or contact CallMedex Security Support at support@callmedex.in."*

---

## 5. Frontend Architecture & Glassmorphic Design

### 5.1 `<DeleteAccountModal />` Component
* **Path:** `frontend/src/app/components/DeleteAccountModal.tsx`
* **Styling Tokens:**
  * Overlay: `background: rgba(10, 15, 30, 0.78); backdrop-filter: blur(20px) saturate(180%);`
  * Card Container:
    * `background: linear-gradient(145deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 58, 138, 0.88) 50%, rgba(15, 23, 42, 0.96) 100%)`
    * `border: 1px solid rgba(59, 130, 246, 0.35)`
    * `box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.7), 0 0 45px rgba(37, 99, 235, 0.25)`
    * `border-radius: 20px`
* **Interaction Workflow:**
  * **Step 1 (Danger Review):** Details what data will be erased. Displays active booking check pill. Clicking *"Send Verification Code"* triggers `request-otp`.
  * **Step 2 (OTP Input):** Six auto-advancing single-character input boxes. Supports keyboard backspace, paste, and 60s cooldown timer for resend.
  * **Step 3 (Confirmation):** On successful verification, triggers celebratory/fade animation, clears tokens, notifies user with toast, and executes clean navigation to `/`.

### 5.2 Patient Dashboard Placement
* **`frontend/src/app/(app)/dashboard/components/PatientNavSidebar.tsx`**:
  * Added to `DASHBOARD_SECTIONS` below `recent-bookings`:
    ```ts
    {
      id: "account-settings",
      label: "Account & Privacy",
      icon: ShieldAlert,
      type: "anchor",
      target: "#account-settings",
    }
    ```
  * Added subtle "Delete Account" button directly in the sidebar widget footer.
* **`frontend/src/app/(app)/dashboard/patient/page.tsx`**:
  * Below the Recent Bookings section: Renders the `#account-settings` section with account overview, data management information, and the "Delete Account" trigger button.

### 5.3 Universal Provider Placement (`DashboardShell.tsx`)
* **`frontend/src/app/(app)/dashboard/components/DashboardShell.tsx`**:
  * In the provider sidebar widget (above `cm-provider-nav-footer`): Renders an **Account Security & Deletion** trigger.
  * Clicking it opens the same `<DeleteAccountModal />` for any logged-in provider role (Doctor, Organization, Phlebotomist, Nurse, Pharmacy, Dentist, Dietitian, Physiotherapist, Staff, Processing Center, Supervisor, Admin).

---

## 6. Verification & Automated Testing Plan

1. **Safety Pre-Flight Verification:**
   - Create test user with an active booking (`confirmed`). Call `request-otp` and verify `HTTP 400` with active booking notice.
   - Transition booking to `completed`. Re-call `request-otp` and verify `HTTP 200` with masked email.
2. **OTP Verification & Cascade Delete Verification:**
   - Submit invalid OTP; verify failure and attempt increment.
   - Submit valid OTP; verify `HTTP 200`.
   - Verify `users`, `patients` (or provider table), `family_members`, `slots`, and `documents` have 0 remaining rows for this ID.
   - Verify Supabase Auth user is removed.
3. **Frontend E2E / Build Smoke Test:**
   - Execute TypeScript compiler check (`npm run build` or Next.js lint/typecheck).
   - Test modal opening from Patient Sidebar, Patient main page, and Provider DashboardShell.
   - Test OTP input interaction, resend timer, and client logout redirect.
