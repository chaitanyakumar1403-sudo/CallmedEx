# Session 02: Universal Self-Service Account Deletion Engine

- **Session**: 02
- **Date**: 2026-09-20
- **Scope**: Platform-wide Universal Self-Service Account Deletion Engine, Active Clinical Safety Gates, Email OTP Security Verification, Multi-Table Cascade Purge, Royal Blue Glassmorphism, and All-Role Dashboard Integration (Patient, Doctor, Nurse, Phlebotomist, Organization, Pharmacy, etc.).
- **Author**: Antigravity Assistant (Google DeepMind) & Engineering Pair

---

## 1. Executive Summary & Production Requirement

Modern digital health platforms (ABDM M1/M2/M3, ISO 27001, GDPR) require a self-service mechanism for users to exercise their Right to Erasure while protecting patient safety and clinical continuity.

### The Objective
Deliver a production-grade, universal self-service account deletion system across all 15 CallMedex user roles:
1. **Patient Dashboard**: Integrated into `PatientNavSidebar` below "Recent Bookings" and rendered at the bottom of the main patient portal view (`#account-settings`).
2. **Provider Dashboards (14 Roles)**: Universally embedded into `DashboardShell.tsx` workspace sidebar footer (`.cm-provider-nav-danger-zone`) covering Doctors, Phlebotomists, Nurses, Organizations, Pharmacies, Dentists, Dietitians, Physiotherapists, Staff, Supervisors, Processing Centers, and Admins.
3. **Royal Blue Glassmorphic Experience**: `<DeleteAccountModal />` with CallMedex brand colors (`#172554`, `#1e3a8a`, `#090e1a`), `backdrop-filter: blur(20px)`, multi-step state machine (Warning -> Email OTP -> Success), 6 discrete auto-advancing numeric cells, paste support, 60s cooldown resend timer, and clean session wipe.
4. **Active Clinical Safety Gate**: Strictly blocks deletion if any active in-progress bookings or dispatches exist (`confirmed`, `in_progress`, `searching`, `accepted`).
5. **Atomic Multi-Table Wipe**: Deep cascade purge across all relational child records (`bookings`, `booking_subjects`, `dispatch_requests`, `family_members`, `documents`, `slots`, provider profiles, etc.), Supabase Auth Admin deletion, and `public.users` removal.

---

## 2. Architecture & Security Model

```
 ┌─────────────────────────────────────────────────────────────┐
 │                    USER INTERACTION                         │
 │   Patient Portal / DashboardShell (14 Provider Roles)       │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │           <DeleteAccountModal /> (Royal Blue Glass)         │
 │   1. Warning Stage: Clinical Consequences, Audit Explanations│
 └──────────────────────────────┬──────────────────────────────┘
                                │ "Send Verification Code"
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ POST /api/auth/delete-account/request-otp                    │
 │ 1. Active Booking Safety Check (HTTP 409 if ongoing care)   │
 │ 2. Rate-limiting (max 3 per 15 minutes)                     │
 │ 3. Generate 6-digit numeric OTP (10 min TTL in redis/cache)  │
 │ 4. Send Royal Blue CallMedex Deletion Security Email        │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Return masked email (e.g. j***@domain.com)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │           <DeleteAccountModal />: OTP Stage                 │
 │   - 6 Discrete Auto-Advancing Input Cells                   │
 │   - Full Paste Support (e.g. "492018")                      │
 │   - 60s Resend Cooldown Counter                             │
 │   - Optional Reason Dropdown                                │
 └──────────────────────────────┬──────────────────────────────┘
                                │ "Permanently Delete My Account"
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ POST /api/auth/delete-account/verify                        │
 │ 1. Verify 6-digit code against memory/cache                 │
 │ 2. Lockout protection (max 3 invalid attempts -> void OTP)  │
 │ 3. Re-verify zero active clinical bookings                  │
 │ 4. _execute_user_cascade_deletion(user_id, role)            │
 │    - Purge doctor_availability, provider_branches, docs     │
 │    - Purge family_members, clinical documents               │
 │    - Purge past completed bookings & dispatch records       │
 │    - Delete from auth.users (Supabase Admin)                │
 │    - Delete from public.users                               │
 └──────────────────────────────┬──────────────────────────────┘
                                │ HTTP 200 { success: true }
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │           <DeleteAccountModal />: Success Stage             │
 │   - Wipe localStorage ('token', 'user', 'callmedex_auth')   │
 │   - Clear sessionStorage                                    │
 │   - Toast notification & Clean redirect to '/' (Home)       │
 └─────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed File Implementations

### A. Backend: `backend/app/services/email.py`
Implemented `send_account_deletion_otp_email`:
- Styled in CallMedex Royal Blue theme with dark container, glowing border, high-contrast OTP badge (`letter-spacing: 8px`), and warning footer.
- Sends from configured `SMTP_FROM_EMAIL` (default: `no-reply@callmedex.com`).

### B. Backend: `backend/app/routers/auth.py`
1. **Safety Gate Helper** `_check_active_clinical_records(user_id, role)`:
   - Scans `bookings` table where `patient_id == user_id` or `doctor_id == user_id`.
   - Checks active statuses: `["confirmed", "in_progress", "searching", "accepted"]`.
   - Scans `dispatch_requests` table where `patient_id == user_id` or `phlebotomist_id == user_id`.
   - Returns clear clinical reason blocking deletion if any active care is underway.
2. **OTP Request Endpoint** `POST /api/auth/delete-account/request-otp`:
   - Authenticated via JWT `get_current_user`.
   - Checks rate limit (max 3 requests per 15 min).
   - Generates 6-digit random code with 10-minute expiry.
   - Masks user email (e.g. `c***@gmail.com`) and dispatches branded email via `EmailService`.
3. **Atomic Multi-Table Wipe** `_execute_user_cascade_deletion(user_id, role)`:
   - Purges `organization_doctors`, `doctor_availability`, `provider_branches`.
   - Purges `family_members`, `patient_documents`.
   - Purges terminal bookings and dispatch records.
   - Deletes identity from Supabase Auth admin API.
   - Deletes identity from `public.users`.
4. **OTP Verification Endpoint** `POST /api/auth/delete-account/verify`:
   - Validates 6-digit code.
   - Increments failure counter (locks out and revokes OTP after 3 invalid attempts).
   - Executes atomic cascade deletion and clears OTP token.

### C. Frontend: `frontend/src/lib/api.ts`
Added typed methods to `authAPI`:
- `requestAccountDeletionOTP(): Promise<{ success: boolean; message: string; masked_email?: string }>`
- `verifyAccountDeletion(otp: string, reason?: string): Promise<{ success: boolean; message: string }>`

### D. Frontend Component: `frontend/src/app/components/DeleteAccountModal.tsx`
- Royal blue glassmorphic modal rendered via `createPortal(..., document.body)`.
- Custom radial gradient orb backdrop and `@keyframes cmModalFadeIn` animation.
- Warning stage displaying clinical data destruction consequences.
- 6 discrete numeric input cells with backspace auto-reversion, numeric paste parser, and active border glow.
- 60-second cooldown timer for resending OTPs.
- Automatic session cleanup (`localStorage`, `sessionStorage`) and redirect to `/`.

### E. Frontend: `frontend/src/app/(app)/dashboard/components/PatientNavSidebar.tsx`
- Added `account-settings` ("Account & Privacy") to `DASHBOARD_SECTIONS` anchored to `#account-settings`.
- Added `onOpenDeleteAccount?: () => void` prop.
- Rendered quick action button with red alert accent in the sidebar widget.

### F. Frontend: `frontend/src/app/(app)/dashboard/patient/page.tsx`
- Mounted `<PatientNavSidebar onOpenDeleteAccount={() => setIsDeleteModalOpen(true)} />`.
- Rendered `#account-settings` section at the bottom of the main content column featuring data privacy info and "Delete Account" button.
- Mounted `<DeleteAccountModal />`.

### G. Universal Provider Integration: `frontend/src/app/(app)/dashboard/components/DashboardShell.tsx` & `foundation.css`
- Gated design system compliant: zero inline styles, zero hex literals, 100% pure CSS tokens.
- Added `.cm-provider-nav-danger-zone`, `.cm-provider-nav-item--danger`, and `.cm-provider-nav-chevron` to `foundation.css`.
- In `DashboardShell.tsx`, embedded "Delete Account" danger item into the workspace sidebar navigation footer.
- Mounted `<DeleteAccountModal />` for all 14 provider roles (`role !== "patient"`).

### H. Router Integrity Fix: `backend/app/routers/provider_management.py`
- Eliminated duplicate FastAPI route collision for `POST /org/doctor/{doctor_user_id}/schedule`.
- Retained the canonical branch-aware `update_org_doctor_schedule` returning `APIResponse` and defined backward-compatibility alias `org_update_doctor_schedule = update_org_doctor_schedule`.

---

## 4. Verification & Testing Matrix

| Test Suite | Command | Result |
| :--- | :--- | :--- |
| Account Deletion Tests | `pytest tests/test_account_deletion.py -v` | **6 / 6 PASSED** |
| Router Integrity & Collisions | `pytest tests/test_router_integrity.py -v` | **4 / 4 PASSED** |
| Admin User Management | `pytest tests/test_admin_users.py -v` | **7 / 7 PASSED** |
| Org Doctor & Branches | `pytest tests/test_org_doctor_walkin_op.py tests/test_org_branches.py -v` | **6 / 6 PASSED** |
| TypeScript Compiler | `npx tsc --noEmit` | **0 Errors (Clean)** |
| UI Lint Regression Gate | `npm run lint:ui` | **Clean across 20 converted files** |
| Frontend Unit Tests | `npm run test:unit` | **32 / 32 PASSED** |
| Production Build | `npm run build` | **PASSED** |

---

## 5. Security & Compliance Checklist
- [x] **Zero Accidental Loss**: Deletion strictly blocked when appointments or dispatches are active.
- [x] **Email 2FA Verification**: High-entropy 6-digit numeric OTP with 10-minute expiration.
- [x] **Brute-Force Lockout**: 3 failed attempts invalidate the token and require re-initiation.
- [x] **Rate Limiting**: Cooldown of 60s in the UI and max 3 requests per 15 minutes on the backend.
- [x] **Complete Data Erasure**: Purges all child tables, Supabase auth identity, and local storage.
- [x] **Design System Discipline**: Zero violations of UI linting gates in converted components.
