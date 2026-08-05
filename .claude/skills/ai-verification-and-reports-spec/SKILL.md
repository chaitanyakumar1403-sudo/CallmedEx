---
name: ai-verification-and-reports-spec
description: CallMedex's AI-automated provider verification pipeline and AI lab-report interpretation layer specs. Use when building or reviewing doctor/pharmacy/phlebotomist document verification, or patient-facing AI report interpretation.
---

# AI-Automated Verification Pipeline

Goal: remove human bottleneck from document review. Each uploaded document triggers a background verification job with status `pending → verified / flagged / rejected`.

| Role | Verification source |
|---|---|
| Doctor | National Medical Council (NMC) registry API — license number cross-check |
| Pharmacy | State Pharmacy Council / Drug License validation API |
| Phlebotomist | MLT/DMLT certificate OCR + certification number cross-check |
| Organization | Municipal/health license registry check where API available |
| All roles | Aadhaar-linked ID proof OCR + face-match against selfie (optional future step) |

- Use OCR (or Claude/Groq vision) to extract fields from uploaded documents, then call the relevant government API/registry
- Flag mismatches for manual review rather than blocking outright — reduces false rejections
- Store verification status + timestamp + source reference for audit trail (important for a healthcare compliance context)

# AI Report Interpretation Layer

- When a lab report is delivered (PDF/structured data), run it through Groq/Llama pipeline:
  - Auto-flag abnormal values against reference ranges
  - Generate a plain-language explanation for the patient (WhatsApp-deliverable), in their preferred language
  - Surface a structured summary to the reviewing doctor *before* they open the raw report
- This does not replace doctor review — it accelerates it and improves patient comprehension
- **Future-forward addition:** trend view across a patient's historical reports (e.g., HbA1c over the last 12 months) auto-charted and flagged if trending in a concerning direction
