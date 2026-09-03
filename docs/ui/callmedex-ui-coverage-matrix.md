# CALLMEDEX — FRONTEND UI COVERAGE & TRANSFORMATION MATRIX
**Document ID:** `CMX-UI-MATRIX-2026-01`  
**Standard:** All 43 Frontend Routes / Verified Baseline Tracking

---

## Complete Route & Role Coverage Matrix

| # | Route Path | Role / Purpose | Audited | Design System Applied | Redesigned | Functionally Verified | Responsive Verified | Visually Verified | Current Baseline / Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `/(public)` | Public Landing / Homepage | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Heavy emoji use, dark cards, lacks white-canvas clinical depth |
| 2 | `/(public)/about` | About CallMedEx & Platform | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Generic team cards, lacks official trust marks |
| 3 | `/(public)/consultation` | Doctor Discovery & Booking | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Emoji tags, inconsistent fee chip heights |
| 4 | `/(public)/diagnostics` | Test Catalog & Search | YES | PENDING | PENDING | PENDING | PENDING | PENDING | 1008 lines, 39 emojis, test cards lack turnaround badges |
| 5 | `/(public)/packages` | Preventive Health Packages | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Retail discount aesthetic rather than clinical packages |
| 6 | `/(public)/pharmacy` | Medicine Catalog & Upload | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Upload prescription CTA is visually buried |
| 7 | `/(public)/search` | Global Health Search | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Minimal empty state, lacks category recommendations |
| 8 | `/(public)/handoff/[token]` | Public Doctor Handoff Token | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Plain text layout, needs clinical letterhead styling |
| 9 | `/(public)/samples/[barcode]`| Public Specimen Tracking | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Lacks chain-of-custody verification badges |
| 10 | `/(public)/track/[token]` | Family Live Tracking Portal | YES | PENDING | PENDING | PENDING | PENDING | PENDING | ETA pill cramped on mobile, lacks provider info |
| 11 | `/(public)/auth/login` | Universal Login Portal | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Biometric login lacks subtle visual affordance |
| 12 | `/(public)/auth/signup` | Universal Multi-Role Signup | YES | PENDING | PENDING | PENDING | PENDING | PENDING | 1502 lines, 173 inline styles, crowded role picker |
| 13 | `/(public)/auth/accept-mou` | Legal Agreement Signing | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Lacks executive digital signature formatting |
| 14 | `/(public)/auth/forgot-password` | Password Recovery Request | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Minimal form, lacks security reassurance microcopy |
| 15 | `/(public)/auth/reset-password` | Password Reset Completion | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Ad-hoc password meter inline styles |
| 16 | `/(app)/dashboard/patient` | Patient Command Center | YES | PENDING | PENDING | PENDING | PENDING | PENDING | 1764 lines, 12 embedded modals, body map is dark sci-fi |
| 17 | `.../patient/bookings` | Patient Appointment History | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Booking status chips inconsistent |
| 18 | `.../patient/reports` | Diagnostic Lab Reports | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Obsolete `.glass-card` class, abnormal flags not prominent |
| 19 | `.../patient/pharmacy` | Patient Pharmacy Orders | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Order tracking timeline lacks courier call button |
| 20 | `.../patient/insurance` | Insurance Policies & Claims | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Flat card layout, needs high-trust card presentation |
| 21 | `.../patient/pmjay` | AB-PMJAY Government Scheme | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Plain text guide, lacks hospital network search |
| 22 | `/(app)/dashboard/doctor` | Doctor Clinical Command | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Dark `#090e1a` background, waiting room queue buried |
| 23 | `.../doctor/consult/[id]` | Live Video Call & E-Rx | YES | PENDING | PENDING | PENDING | PENDING | PENDING | 1301 lines, call HUD lacks clinical layout |
| 24 | `/(app)/dashboard/dietitian` | Dietitian Workspace | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Generic card layout, lacks calorie/macro visualization |
| 25 | `/(app)/dashboard/physiotherapist`| Physiotherapy Workspace | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Lacks joint/range-of-motion visual rehabilitation tracker |
| 26 | `/(app)/dashboard/nurse` | Home Nurse Care Tasks | YES | PARTIAL | PENDING | PENDING | PENDING | PENDING | Converted to foundation tokens; lacks quick-vitals shortcut |
| 27 | `/(app)/dashboard/phlebotomist` | Phlebotomist Dispatch & Kits | YES | PARTIAL | PENDING | PENDING | PENDING | PENDING | Converted to foundation tokens; stock levels need density |
| 28 | `/(app)/dashboard/pharmacy` | Dark-Store Pharmacy Queue | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Prescription order verification workflow is clunky |
| 29 | `/(app)/dashboard/organization` | Polyclinic/Lab Management | YES | PENDING | PENDING | PENDING | PENDING | PENDING | 1439 lines, 60 emojis, unpaginated branch tables |
| 30 | `.../dashboard/processing-center`| Specimen Intake & Batches | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Intake queue lacks high-contrast barcode verification UI |
| 31 | `.../dashboard/processing_center`| Duplicate PC Route | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Duplicate folder; consolidate into `processing-center` |
| 32 | `/(app)/dashboard/staff` | Front-Desk OPD & Intake | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Token generation form lacks quick print preview |
| 33 | `/(app)/dashboard/supervisor` | Field Fleet Radar | YES | PARTIAL | PENDING | PENDING | PENDING | PENDING | Partially converted; GPS heatmap needs clearer status |
| 34 | `/(app)/dashboard/admin` | Global Governance Panel | YES | PENDING | PENDING | PENDING | PENDING | PENDING | 1605 lines, 61 emojis, verification queue needs split-view |
| 35 | `/(app)/dashboard/admin/fraud`| GPS & Fraud Alerts | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Table lacks geospatial map preview |
| 36 | `/(app)/booking` | Universal Diagnostics Booking | YES | PENDING | PENDING | PENDING | PENDING | PENDING | 2058 lines, 32 emojis, needs clean multi-step wizard |
| 37 | `/(app)/booking/hospital` | Hospital OPD Consultation | YES | PENDING | PENDING | PENDING | PENDING | PENDING | OPD slot picker is cramped on mobile |
| 38 | `/(app)/booking/nurse` | Home Nursing Visit Booking | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Task selection lacks clear pricing breakdown |
| 39 | `/(app)/booking/therapy` | Physical & Nutrition Therapy | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Plan selector lacks bundle discount badges |
| 40 | `/(app)/consultation/[doctorId]`| Telemed Lobby & Payment | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Pre-call lobby lacks audio/video test preview widget |
| 41 | `/(app)/dispatch/respond` | Provider Offer Acceptance | YES | PENDING | PENDING | PENDING | PENDING | PENDING | 30s timer lacks audio chime and high-visibility badge |
| 42 | `/(app)/tracking/[dispatch_id]`| Phlebotomist Live Tracking | YES | PENDING | PENDING | PENDING | PENDING | PENDING | Map needs live route line and masked calling button |
| 43 | `/(app)/dev/ui` | Design System Gallery | YES | PARTIAL | PENDING | PENDING | PENDING | PENDING | Needs cataloging of all `--cm-*` clinical tokens |

---

## Role Coverage Summary
- **Patient**: Covered (Personal Health Command Center, Bookings, Reports, Pharmacy, Insurance, PMJAY).
- **Doctor**: Covered (Command Center, Telemed Room, E-Rx Pad, Tariffs, Slot Availability).
- **Nurse**: Covered (Home Visit Queue, Bedside Vitals, Patient History).
- **Phlebotomist**: Covered (Dispatch Offers, Doorstep Check-in, Barcode Scanner, Tube Handover, Wallet).
- **Dietitian**: Covered (Nutrition Workspace, Meal Plans, Dietary Consultation).
- **Physiotherapist**: Covered (Rehabilitation Plans, Session Tracking, Home Visits).
- **Pharmacy**: Covered (Prescription Verification, Dark-Store Routing, Generic Alternatives).
- **Organization**: Covered (Branch Directory, Bulk Orders, Staff Management).
- **Processing Center**: Covered (Courier Intake, 5-Point Tube Verification, Lab Batching).
- **Staff**: Covered (Front-Desk OPD Token Generation, Patient Check-in).
- **Supervisor**: Covered (City Fleet Radar, SLA Breach Monitoring, Dispatch Overrides).
- **Admin**: Covered (Global Governance, Provider Document OCR Verification, Fraud Radar).
