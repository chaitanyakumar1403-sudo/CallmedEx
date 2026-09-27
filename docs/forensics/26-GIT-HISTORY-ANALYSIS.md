# CallMedex Forensic Intelligence: Git History, Architectural Evolution & Commit Forensics

> **Analysis Scope**: Chronological forensic reconstruction of codebase evolution across 411 commits, tracing Phase 1 foundation through Session 04 (`a7e8478`), documenting architectural pivots, technical debt injections, and structural refactorings.

---

## 1. Commit Topology & Current Baseline

- **Repository**: CallMedex (`chaitanyakumar1403-sudo/CallmedEx`)
- **Current HEAD**: `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`
- **Current Branch**: `main`
- **Total Commit Count**: 411 commits
- **Analysis Baseline**: Clean main branch with minor local artifacts (`.codebase-memory/`, uncommitted reference image cleanup).

---

## 2. Major Architectural Phases (Chronological Reconstruction)

```
[Phase 1] 86bfa74: Foundation DB, Sample Lifecycle, Provider Economics, Urgent Tier
     │
[Phase 2] 8e83f15: Sample Custody Chain, Lab Handover & Phlebotomist Wallet
     │
[Phase 3 & 4] 061189b: Phlebotomist Sample Workflow & Per-Type Org Dashboards
     │
[Phase 5] a62d1bf: Test-First Marketplace Discovery & Partner-Comparable Pricing
     │
[Phase 6] 28e2f46: Urgent Priority for Nursing & Doctor Home Dispatch
     │
[Phase 7] c1b10f4: Universal Provider Availability & Apply-to-All-Days Scheduling
     │
[Merge Core] 2d24d72: Large Integration (Schema Sync, Marketplace, Operations)
     │
[Legal MOUs] 02edc18: Digital MOU Generator, Provider Signature Engine, Docx Loader
     │
[Session 01] 78d6ec5: Glassmorphic UI Polishing, Layout Alignment, Patient Enrichment
     │
[Session 02] 64bb825 - 07d27b0: Universal Self-Service Account Deletion Engine (DPDP)
     │
[Session 03] 563e942: Nurse Scope Catalogue, 80/20 Commercial Split, Premium Dashboards
     │
[Session 04] a7e8478: Live Tracking Gate, Branch Scheduling, Home Collection & Pharmacy Terminal
```

---

## 3. Deep Dive into Major Evolution Epochs

### 3.1 Phase 1 & 2: Specimen Custody & Financial Ledger (`86bfa74` & `8e83f15`)
- **What Landed**:
  - Introduction of the 13-state sample lifecycle (`ALLOWED_SAMPLE_TRANSITIONS`).
  - Establishment of the `wallets` and `wallet_transactions` tables.
  - Phlebotomist payment rules: Part-time phlebotomists earn per-accepted-tube fees upon lab accessioning; full-time phlebotomists earn monthly salaries without per-tube commission.
- **Architectural Shift**: Transitioned from a generic appointment booking model to a clinical chain-of-custody specimen tracking platform.

### 3.2 Phase 5 & 6: Marketplace & Urgent Dispatch (`a62d1bf` & `28e2f46`)
- **What Landed**:
  - Test-first discovery: Diagnostic tests presented with transparent partner lab pricing.
  - Urgent priority dispatch: 3-tier fan-out (3km -> 6km -> 10km) for urgent nursing, blood collection, and doctor home visits.
- **Technical Debt Introduced**: Reliance on client-provided coordinates; if client lacks GPS, dispatch fallback to geocoding requires `GEOAPIFY_API_KEY`.

### 3.3 The MediAssist Integration Pivot
- **What Landed**:
  - Deprecation of direct WhatsApp Cloud API / Meta Graph API libraries from backend.
  - Creation of `/api/v1/integrations/mediassist/` inbound webhook endpoints.
  - Offloading of MocDoc hospital browser scraping and conversational NLP to external MediAssist AI worker.
- **Security Implication**: HMAC-SHA256 signature verification (`verify_mediassist_signature`) and 300s replay window were introduced to secure the integration bridge.

### 3.4 Session 02: DPDP Act 2023 Self-Service Account Deletion (`64bb825` to `07d27b0`)
- **What Landed**:
  - Multi-step account deletion: Request OTP -> verify OTP -> atomic cascade cleanup.
  - Active booking safety gate: Prevents account deletion if there are unfulfilled appointments, pending dispatches, or active specimen tests.
  - Cascade cleanup: Anonymizes PHI in bookings while preserving non-identifiable financial ledger records for statutory tax/audit compliance.

### 3.5 Session 04 (Current HEAD `a7e8478`): Multi-Branch & Pharmacy Terminal
- **What Landed**:
  - Live GPS tracking booking gate: Patients cannot track phlebotomist until dispatch status reaches `en_route`.
  - Organization multi-branch doctor scheduling.
  - Complete Pharmacy POS / Order terminal for digital prescription fulfillment.

---

## 4. Historical Refactorings & Breaking Changes

1. **Supabase Client Consolidation**:
   - Earlier commits attempted to pass user JWTs to Supabase to leverage PostgreSQL RLS.
   - Refactored to centralize all database queries through `app/database.py` using `SUPABASE_SERVICE_KEY`, shifting the burden of multi-tenancy enforcement entirely to FastAPI Python code.
2. **Removal of Static Health Packages**:
   - Commit `e3ba76c`: Dropped static hardcoded health checkup packages in favor of dynamic catalog queries against partner processing centers.
3. **FCM v1 Migration**:
   - Legacy FCM server keys (deprecated by Google in June 2024) were completely purged and replaced with Google Auth Service Account OAuth2 token minting (`google-auth>=2.35.0`).
