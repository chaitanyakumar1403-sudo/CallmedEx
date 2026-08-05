---
name: abha-abdm-integration
description: CallMedex's ABHA/ABDM integration spec (patient ABHA linkage flow, M1/M2/M3 milestone roadmap, DHIS incentive tracking). Use when building or reviewing patient signup ABHA linkage, HIP/HIU health-record push/pull, or ABDM compliance work.
---

# ABHA Integration (Foundational — Day One)

**Rationale:** Reduces ZukoLabs' data storage cost/liability by not duplicating the national health record; ABDM already stores longitudinal health data. CallMedex stores pointers + consent artifacts, not the full record.

**Scale context (July 2026):** 93.95 crore ABHA IDs created, 105+ crore health records linked, ~10 lakh registered healthcare professionals, 5+ lakh registered facilities. ABHA integration is no longer optional — it's a competitive necessity and, for NABH-accredited/state-empanelled facilities, a regulatory mandate.

**Flow:**
1. On patient signup, prompt: "Do you have an ABHA (Ayushman Bharat Health Account)?"
2. **If yes:** link via mobile/Aadhaar OTP verification against ABDM's ABHA lookup API → pull demographics to prefill form
3. **If no:** create ABHA inline via ABDM's ABHA-creation API (OTP-based via Aadhaar or mobile, no separate app/portal needed)
4. Store only: `abha_number`, `abha_ref_id`, consent status — in `patients` table
5. Every health event (phlebotomist collection, lab report, prescription, video consult summary) is pushed as a **Health Information** record to ABDM via HIP (Health Information Provider) flow, linked to the patient's ABHA
6. Dashboard "Health Records" tab pulls from ABDM (via HIU/consent flow) rather than storing full documents locally

## ABDM Milestone Compliance Roadmap

ABDM compliance is now structured into three clear technical milestones. CallMedex must target all three:

| Milestone | Scope | CallMedex Implementation |
|---|---|---|
| **M1 — Patient Identity** | ABHA creation, verification, and linking | Patient signup flow |
| **M2 — HIP Role** | Sharing health records in FHIR R4 format, handling consent requests from other facilities | Every health event (lab report, prescription, consultation summary) pushed as FHIR R4 bundle to ABDM gateway |
| **M3 — HIU Role** | Bidirectional data exchange — accessing patient history from other ABDM-registered facilities | Dashboard "Health Records" tab pulls cross-facility history via consent flow — the key differentiator vs. siloed competitors |

**Compliance note:** Registering CallMedex as an HIP/HIU with the National Health Authority (NHA) is a formal onboarding process, not just an API key. As of 2026, all facilities must register with the **Health Facility Registry (HFR)** and ensure professionals are on the **Healthcare Professionals Registry (HPR)**. Use the official ABDM Sandbox (sandbox.abdm.gov.in) for API testing and FHIR R4 certification.

## Digital Health Incentive Scheme (DHIS)

**Revenue/cost offset opportunity:** The NHA's DHIS program offers financial incentives to healthcare providers and digital solution companies that achieve specific digital transaction targets on ABDM. Over ₹100 crore has been disbursed to hospitals alone by mid-2026. Revised policy (Corrigendum 7) is effective April–September 2026.

- CallMedex should track ABDM transaction volumes per enrolled facility to help partners claim DHIS incentives — this becomes a **sales pitch to onboard organizations** ("Join CallMedex and earn DHIS incentives automatically")
- Builds goodwill with onboarded organizations and creates a data-driven argument for platform adoption

## Related

- Registration with NHA (HIP/HIU), HFR, HPR is also covered under the platform's Compliance Requirements (root CLAUDE.md Section 15.2).
- FHIR R4 is mandatory for both this integration and NHCX insurance claims — see `patient-dashboard-and-insurance-spec` skill.
