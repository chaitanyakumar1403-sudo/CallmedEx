---
name: patient-dashboard-and-insurance-spec
description: CallMedex's patient dashboard feature spec and NHCX insurance/claims integration spec. Use when building or reviewing the patient dashboard, insurance eligibility checks, or NHCX claims submission/tracking.
---

# Patient Dashboard

- Upcoming/past appointments (all types: phlebotomist collection, lab visit, video consult, pharmacy order)
- Health Records tab (ABDM-sourced, consent-gated)
- Family member management (subscription/family health plans — future monetization lever)
- Active order/dispatch tracking (live map when applicable)
- Consultation history with AI summaries, prescriptions, and translated transcripts
- Medication reminders (from active prescriptions, tied into pharmacy refill flow)
- Preferred language setting (drives translation layer + WhatsApp delivery language across all services)
- Insurance claims dashboard — real-time claim status, documents, and reimbursement tracking (see below)

# Insurance & Claims Integration — NHCX (High-Impact Revenue Lever)

**Why this matters:** The National Health Claims Exchange (NHCX) is live and expanding. It uses FHIR R4 standards to enable real-time, standardized claims exchange between providers, insurers/TPAs, and government schemes (AB-PMJAY). No major healthtech marketplace has nailed seamless claims-from-booking yet. This is CallMedex's opportunity to be the first.

## Core Capability
- **Pre-consultation insurance eligibility check:** Before a patient books a video consult, lab test, or home collection, CallMedex queries NHCX to verify active coverage and policy limits — patient sees "Covered by [Insurer Name]" or "Out-of-pocket: ₹X" upfront, eliminating bill-shock
- **Automated claim submission:** After a consultation or diagnostic service, CallMedex auto-generates the NHCX-compliant FHIR claim bundle (diagnosis codes, procedure codes, prescription data) and submits it to the insurer/TPA via NHCX gateway
- **Real-time claim tracking:** Patient dashboard shows claim status (submitted → under review → approved/rejected → disbursed) pulled from NHCX callbacks
- **AB-PMJAY integration:** For Ayushman Bharat beneficiaries, CallMedex can handle cashless claims processing through the Transaction Management System (TMS) — massive Tier 2/3 acquisition channel

## Technical Architecture
- NHCX uses an **asynchronous callback architecture** for claim lifecycle (eligibility → pre-auth → claim → settlement)
- Build a **FHIR-converter middleware layer** that maps CallMedex's internal data (from Supabase) to NHCX-compliant bundles
- Requires M1 ABDM integration as a prerequisite (see `abha-abdm-integration` skill)
- Use NHCX Sandbox for testing before production go-live

## Revenue Impact
- **Commission on claims processed** — per-transaction fee model similar to payment gateways
- **Premium tier for organizations** — "Insurance-ready" badge + automated claims as a paid feature for enrolled diagnostic centers/hospitals
- **Patient acquisition** — "Book with insurance" is a powerful conversion driver, especially in Tier 2/3 cities where AB-PMJAY coverage is highest
- **Data moat** — claims data (anonymized, aggregated) provides unique insights into disease burden, cost patterns, and demand forecasting
