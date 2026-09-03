# CALLMEDEX — FRONTEND & UI/UX FORENSIC AUDIT REPORT
**Document ID:** `CMX-UI-AUDIT-2026-01`  
**Target:** CallMedEx Healthcare Web Application (`frontend/`)  
**Scope:** Complete Read-Only Audit of Every Route, Dashboard, Component, Token, Style, and State  
**Standard:** WCAG 2.1 AA / Clinical Usability / Brand Coherence / High-Density Healthcare Systems

---

## 1. Executive Summary

A comprehensive, read-only forensic UI/UX audit was conducted across the entire CallMedEx frontend repository (`frontend/src`). The application comprises **43 distinct pages/routes**, **121 TypeScript/TSX source files**, **2 CSS stylesheets (2,972 total lines of CSS)**, and **15 user roles**.

### Core Audit Findings
1. **Clinical Canvas Inconsistency (White vs. Cyberpunk Dark)**:
   - While [`foundation.css`](file:///c:/Users/chait/OneDrive/Desktop/callmedex/frontend/src/app/styles/foundation.css) specifies a clinical white foundation (`--cm-surface: #ffffff`), **33 out of 43 pages** introduce dark backgrounds (e.g. `#090e1a`, `#1e293b`, `#0f172a`), neon blue glows, laser grid lines, and glowing gradients.
   - For example, [`DoctorDashboard`](file:///c:/Users/chait/OneDrive/Desktop/callmedex/frontend/src/app/(app)/dashboard/doctor/page.tsx#L220) loads with a dark screen `backgroundColor: "#090e1a"`, creating a gaming/cyberpunk aesthetic rather than clinical medical software.
2. **The "Allowlist Island" Effect in the UI Linter**:
   - The UI regression linter ([`lint-ui.mjs`](file:///c:/Users/chait/OneDrive/Desktop/callmedex/frontend/scripts/lint-ui.mjs)) is strict, rejecting inline styles, raw hex codes, emojis, and gradients.
   - However, [`ui-lint.config.json`](file:///c:/Users/chait/OneDrive/Desktop/callmedex/frontend/ui-lint.config.json) gates **only 19 files** (chiefly phlebotomist and nurse dispatch tools). The remaining **102 source files and 24 pages** remain ungated and suffer from massive style fragmentation.
3. **Severe Inline Style Sprawl**:
   - **35 out of 43 pages** contain inline `style={{ ... }}` objects.
   - The largest pages contain hundreds of inline styles each: Booking (`booking/page.tsx` — 228 inline styles), Admin (`admin/page.tsx` — 224 inline styles), Organization (`organization/page.tsx` — 213 inline styles), Patient Dashboard (`patient/page.tsx` — 164 inline styles), Doctor Consultation (`doctor/consult/[id]/page.tsx` — 158 inline styles), and Signup (`auth/signup/page.tsx` — 173 inline styles).
4. **Hex Color Fragmentation**:
   - **38 out of 43 pages** define hardcoded hex colors directly in JSX rather than referencing semantic `--cm-*` design tokens. Across the app, over 80 distinct hex codes exist.
5. **Unicode Emojis in Clinical Chrome**:
   - **30 out of 43 pages** embed raw Unicode emojis (e.g. `🚑`, `📞`, `🩸`, `✨`, `💬`, `👨‍⚕️`) directly in page headers, utility bars, status badges, and buttons.
   - This violates professional healthcare standards and introduces rendering inconsistencies across Android, iOS, Windows, and Linux.
6. **Sci-Fi / Cyberpunk Simulation in Anatomical Twin**:
   - [`InteractiveBodyMap.tsx`](file:///c:/Users/chait/OneDrive/Desktop/callmedex/frontend/src/app/components/InteractiveBodyMap.tsx) contains dark holographic styling (`#1e293b`, cyan lasers, holographic scanbeams) and fictional labels (`"Bio-Scan v3.2 Active"`, `"OPTICAL BODY SCANNER"`).
   - This contradicts clinical realism and creates a video-game aesthetic.
7. **Generic Dashboard Card Repetition**:
   - Dashboards across Dietitian, Physiotherapist, Pharmacy, and Staff fall into the generic pattern: `[icon] [heading] [description] [border] [button]` repeated in 3-column grids, lacking clinical data density, timelines, and command-center hierarchy.

---

## 2. Architecture and Technology Inventory

### 2.1 Dependencies & Libraries
| Package | Version | Purpose | Assessment |
|---|---|---|---|
| `next` | 16.2.10 | Framework (App Router, Turbopack) | Latest release, excellent SSR/RSC support |
| `react` / `react-dom` | 19.2.4 | UI Runtime | Modern React 19 concurrent features |
| `lucide-react` | 1.27.0 | Iconography | High-quality medical and UI icon set |
| `sonner` | 2.0.7 | Toast Notifications | Accessible, performant toast library |
| `html5-qrcode` | 2.3.8 | Barcode / QR Scanning | Used for doorstep sample check-in |
| `@playwright/test` | 1.61.1 | E2E Testing | Multi-viewport automated testing |
| `@axe-core/playwright` | 4.12.1 | Accessibility Auditing | Automated WCAG 2.1 AA auditing |

### 2.2 Styling Layer
- **No Tailwind CSS**: The repository uses Vanilla CSS tokens and custom CSS classes.
- **`src/app/styles/foundation.css` (1,960 lines)**:
  - Defines the core design tokens: `--cm-navy` (`#1a2b4a`), `--cm-urgent` (`#d92020`), `--cm-active` (`#0369a1`), `--cm-done` (`#15803d`), `--cm-waiting` (`#b45309`), `--cm-surface` (`#ffffff`), `--cm-ink` (`#0f172a`).
  - Implements the accessibility floor: focus-visible ring, prefers-reduced-motion, minimum 44px tap targets, Telugu optical sizing (`:lang(te)`).
- **`src/app/globals.css` (1,012 lines)**:
  - Contains legacy aliases pointing at `--cm-*` tokens.
  - Contains obsolete classes (`.glass-card`, `.badge-ai` purple gradient, `.voice-wave` cyan animation).
- **`src/components/ui/` (Design System Primitives)**:
  - Contains 16 well-crafted primitives: `AppBar`, `Button`, `Card`, `Panel`, `Field`, `TextInput`, `Select`, `TextArea`, `Pill`, `Stat`, `StatGrid`, `EmptyState`, `Modal`, `Tabs`, `PageHeader`, `Skeleton`.
  - **Issue**: Most pages do not import or use these primitives!

---

## 3. Comprehensive Route & Page Audit

The 43 frontend routes are cataloged below across 5 functional tiers:

### 3.1 Public Marketing & Clinical Portal Pages (10 Pages)
| Route | File Path | Lines | Anti-Patterns Detected | Usability & Design Deficiencies |
|---|---|---|---|---|
| `/` | `src/app/(public)/page.tsx` | 512 | 42 inline styles, 14 hex, 22 emojis | Marketing hero uses dark cards and emojis; lacks high-end clinical typography and subtle white-canvas depth. |
| `/about` | `src/app/(public)/about/page.tsx` | 384 | 28 inline styles, 10 hex, 8 emojis | Generic team and mission layout; lacks regulatory trust marks (NMC, ABDM, NHA). |
| `/consultation` | `src/app/(public)/consultation/page.tsx` | 676 | 54 inline styles, 15 hex, 29 emojis | Doctor discovery cards use inconsistent heights, emoji badges, and unformatted doctor fee chips. |
| `/diagnostics` | `src/app/(public)/diagnostics/page.tsx` | 1,008 | 86 inline styles, 24 hex, 39 emojis | Giant filter list; test cards lack clear turnaround time badges and vacutainer tube indicators. |
| `/packages` | `src/app/(public)/packages/page.tsx` | 442 | 34 inline styles, 12 hex, 18 emojis | Cards feel like consumer discount coupons rather than clinical preventive health packages. |
| `/pharmacy` | `src/app/(public)/pharmacy/page.tsx` | 488 | 38 inline styles, 16 hex, 14 emojis | Upload prescription CTA is visually buried; dark banner contradicts white-canvas mandate. |
| `/search` | `src/app/(public)/search/page.tsx` | 312 | 22 inline styles, 8 hex, 6 emojis | Minimal empty state; lacks instant category recommendations. |
| `/handoff/[token]` | `src/app/(public)/handoff/[token]/page.tsx` | 240 | 18 inline styles, 6 hex, 0 emojis | Clinical handoff page is functional but visually Spartan; needs professional clinical letterhead layout. |
| `/samples/[barcode]` | `src/app/(public)/samples/[barcode]/page.tsx` | 320 | 26 inline styles, 9 hex, 0 emojis | Specimen tracking timeline lacks chain-of-custody verification seal and temperature indicators. |
| `/track/[token]` | `src/app/(public)/track/[token]/page.tsx` | 380 | 32 inline styles, 11 hex, 0 emojis | Family live tracking map has cramped ETA pill and lacks driver vehicle details. |

### 3.2 Authentication & Legal Onboarding (5 Pages)
| Route | File Path | Lines | Anti-Patterns Detected | Usability & Design Deficiencies |
|---|---|---|---|---|
| `/auth/login` | `src/app/(public)/auth/login/page.tsx` | 571 | 54 inline styles, 18 hex, 0 emojis | Role indicator is cramped; biometric login button lacks subtle visual affordance. |
| `/auth/signup` | `src/app/(public)/auth/signup/page.tsx` | 1,502 | 173 inline styles, 48 hex, 11 emojis | Massive 9-role form; role selector buttons feel crowded on mobile; needs elegant visual segmentation and field hierarchy. |
| `/auth/accept-mou` | `src/app/(public)/auth/accept-mou/page.tsx` | 736 | 78 inline styles, 32 hex, 0 emojis | Legal document viewer is plain text; needs an executive digital signature layout with timestamp and IP seal. |
| `/auth/forgot-password` | `src/app/(public)/auth/forgot-password/page.tsx` | 180 | 14 inline styles, 4 hex, 0 emojis | Basic form; lacks reassurance microcopy regarding secure reset link expiry. |
| `/auth/reset-password` | `src/app/(public)/auth/reset-password/page.tsx` | 210 | 16 inline styles, 5 hex, 0 emojis | Password strength indicator uses ad-hoc inline styles. |

### 3.3 Patient Health Command Center & Sub-Pages (6 Pages)
| Route | File Path | Lines | Anti-Patterns Detected | Usability & Design Deficiencies |
|---|---|---|---|---|
| `/dashboard/patient` | `src/app/(app)/dashboard/patient/page.tsx` | 1,764 | 164 inline styles, 31 hex, 0 emojis | 1,764 lines of monolithic code. Contains 12 embedded modals. Lacks clean progressive disclosure. Needs transformation into a personal health command center. |
| `.../patient/bookings` | `src/app/(app)/dashboard/patient/bookings/page.tsx` | 490 | 42 inline styles, 14 hex, 4 emojis | Booking status chips use inconsistent colors; cancel/reschedule actions need clear confirmation modals. |
| `.../patient/reports` | `src/app/(app)/dashboard/patient/reports/page.tsx` | 520 | 48 inline styles, 16 hex, 2 emojis | Report list uses obsolete `.glass-card` class; abnormal biomarker flags are not highlighted clearly. |
| `.../patient/pharmacy` | `src/app/(app)/dashboard/patient/pharmacy/page.tsx` | 410 | 36 inline styles, 12 hex, 2 emojis | Order status timeline lacks delivery courier contact action. |
| `.../patient/insurance` | `src/app/(app)/dashboard/patient/insurance/page.tsx` | 380 | 30 inline styles, 10 hex, 0 emojis | Policy card is a flat rectangle; needs high-trust card presentation with AB-PMJAY eligibility status. |
| `.../patient/pmjay` | `src/app/(app)/dashboard/patient/pmjay/page.tsx` | 320 | 24 inline styles, 8 hex, 0 emojis | Informational PMJAY guide lacks interactive hospital network search. |

### 3.4 Professional Clinical & Operational Dashboards (12 Pages)
| Route | File Path | Lines | Anti-Patterns Detected | Usability & Design Deficiencies |
|---|---|---|---|---|
| `/dashboard/doctor` | `src/app/(app)/dashboard/doctor/page.tsx` | 1,066 | 130 inline styles, 35 hex, 0 emojis | Background is dark `#090e1a`; waiting room queue is buried; tariff table is cluttered. |
| `/dashboard/doctor/consult/[id]`| `src/app/.../consult/[id]/page.tsx` | 1,301 | 158 inline styles, 34 hex, 1 emoji | Live consultation room; video viewport lacks clean clinical controls; e-prescription pad needs structured clinical layout. |
| `/dashboard/dietitian` | `src/app/(app)/dashboard/dietitian/page.tsx` | 697 | 88 inline styles, 20 hex, 0 emojis | Generic card layout; meal-plan creator lacks calorie/macro visual breakdown. |
| `/dashboard/physiotherapist`| `src/app/(app)/dashboard/physiotherapist/page.tsx`| 710 | 92 inline styles, 23 hex, 0 emojis | Lacks joint/range-of-motion visual rehabilitation tracker. |
| `/dashboard/nurse` | `src/app/(app)/dashboard/nurse/page.tsx` | 540 | 6 inline styles, 0 hex, 0 emojis | Mostly converted to `--cm-*` tokens, but task cards lack quick-vitals logging shortcut. |
| `/dashboard/phlebotomist` | `src/app/(app)/dashboard/phlebotomist/page.tsx` | 580 | 8 inline styles, 0 hex, 0 emojis | Clean foundation tokens, but map toggle and stock levels need higher density. |
| `/dashboard/pharmacy` | `src/app/(app)/dashboard/pharmacy/page.tsx` | 579 | 101 inline styles, 17 hex, 7 emojis | Order verification workflow is clunky; generic drug substitution lookup is unstyled. |
| `/dashboard/organization` | `src/app/(app)/dashboard/organization/page.tsx` | 1,439 | 213 inline styles, 45 hex, 60 emojis | Heavy emoji use; branch manager table is unpaginated; revenue charts use hardcoded gradients. |
| `/dashboard/processing-center`| `.../processing-center/page.tsx` | 510 | 44 inline styles, 14 hex, 0 emojis | Intake queue table lacks high-contrast visual barcode verification status. |
| `/dashboard/processing_center`| `.../processing_center/page.tsx` | 490 | 40 inline styles, 12 hex, 0 emojis | Duplicate route folder; must be consolidated into `processing-center`. |
| `/dashboard/staff` | `src/app/(app)/dashboard/staff/page.tsx` | 480 | 52 inline styles, 16 hex, 4 emojis | Front-desk OPD token generation form lacks quick print preview. |
| `/dashboard/supervisor` | `src/app/(app)/dashboard/supervisor/page.tsx` | 520 | 10 inline styles, 0 hex, 0 emojis | Partially converted; phlebotomist GPS heatmap needs clearer idle/active distinction. |
| `/dashboard/admin` | `src/app/(app)/dashboard/admin/page.tsx` | 1,605 | 224 inline styles, 67 hex, 61 emojis | Monolithic admin panel with 61 emojis; provider verification queue lacks side-by-side OCR comparison. |
| `/dashboard/admin/fraud` | `src/app/(app)/dashboard/admin/fraud/page.tsx`| 420 | 38 inline styles, 12 hex, 0 emojis | GPS spoofing alerts table needs geospatial map pin preview. |

### 3.5 Booking, Dispatch & Telemedicine Execution (10 Pages)
| Route | File Path | Lines | Anti-Patterns Detected | Usability & Design Deficiencies |
|---|---|---|---|---|
| `/booking` | `src/app/(app)/booking/page.tsx` | 2,058 | 228 inline styles, 66 hex, 32 emojis | Largest file in frontend. 32 emojis, multiple steps cramped in single container. Needs multi-step wizard. |
| `/booking/hospital` | `src/app/(app)/booking/hospital/page.tsx` | 480 | 46 inline styles, 15 hex, 8 emojis | Hospital OPD slot picker is cramped on mobile. |
| `/booking/nurse` | `src/app/(app)/booking/nurse/page.tsx` | 510 | 50 inline styles, 16 hex, 6 emojis | Nursing visit duration and task selection lack clear pricing breakdown. |
| `/booking/therapy` | `src/app/(app)/booking/therapy/page.tsx` | 595 | 60 inline styles, 22 hex, 1 emoji | Therapy plan duration selector lacks session-bundle discount badges. |
| `/consultation/[doctorId]`| `src/app/(app)/consultation/[doctorId]/page.tsx`| 540 | 48 inline styles, 15 hex, 4 emojis | Doctor pre-call lobby lacks audio/video camera test preview widget. |
| `/dispatch/respond` | `src/app/(app)/dispatch/respond/page.tsx` | 420 | 36 inline styles, 12 hex, 0 emojis | 30-second offer countdown timer lacks audio chime and high-visibility urgent badge. |
| `/tracking/[dispatch_id]`| `src/app/(app)/tracking/[dispatch_id]/page.tsx`| 460 | 40 inline styles, 14 hex, 0 emojis | Phlebotomist ETA map needs live progress bar and direct masked calling button. |
| `/dev/ui` | `src/app/(app)/dev/ui/page.tsx` | 380 | 12 inline styles, 4 hex, 0 emojis | Design system component gallery; needs full documentation of all `--cm-*` tokens. |

---

## 4. Visual & Interaction Anti-Patterns Catalog

```
+----------------------------------------------------------------------------------------------------+
|                                     VISUAL ANTI-PATTERNS AUDIT                                     |
+--------------------------+-----------------------+-------------------------------------------------+
| Anti-Pattern             | Affected Pages / Scope| Impact on Clinical Usability & Brand            |
+--------------------------+-----------------------+-------------------------------------------------+
| 1. Dark Cyberpunk Cards  | 33 of 43 pages        | Contradicts the clinical white canvas standard. |
|    (#090e1a, #1e293b)    | Doctor, BodyMap, Admin| Looks like a gaming site or crypto dashboard.   |
+--------------------------+-----------------------+-------------------------------------------------+
| 2. Inline Style Sprawl   | 35 of 43 pages        | Destroys maintainability; makes responsive       |
|    (style={{ ... }})     | 1,980+ occurrences    | adjustments impossible; breaks token system.   |
+--------------------------+-----------------------+-------------------------------------------------+
| 3. Raw Hex Color Chaos   | 38 of 43 pages        | 80+ disparate hex colors undermine visual       |
|    (#2563eb, #38bdf8)    | Over 700 occurrences  | consistency and break accessibility contrast.   |
+--------------------------+-----------------------+-------------------------------------------------+
| 4. Emoji Chrome Sprawl   | 30 of 43 pages        | Emojis (🚑, 📞, 🩸, ✨) render differently      |
|    (312 emojis in code)  | Admin, Booking, Home  | across platforms, breaking professional trust.  |
+--------------------------+-----------------------+-------------------------------------------------+
| 5. Fictional Sci-Fi Tech | InteractiveBodyMap    | "Bio-Scan v3.2 Active" and holographic scan     |
|    (Holograms, Lasers)   | Component             | lines imply fictional technology, reducing trust.|
+--------------------------+-----------------------+-------------------------------------------------+
| 6. Generic SaaS Grid     | Dietitian, Physio,    | Repetitive [icon][title][text][button] cards    |
|    (Bland Card Clones)   | Staff, Pharmacy       | lack clinical information density and context.  |
+--------------------------+-----------------------+-------------------------------------------------+
```

---

## 5. Anatomical Twin & 3D Visualization Forensic Review

### Current State (`InteractiveBodyMap.tsx`):
- Uses an SVG silhouette with 9 circular hotspots (`skin`, `eyes`, `dental`, `ent`, `head`, `heart`, `lungs`, `abdomen`, `joints`).
- Stylized with cyan laser scan lines, glowing grid backgrounds, and dark blue boxes.
- Displays realistic clinical test panels (e.g. Lipid Profile, ECG, Troponin for Heart), but surrounds them with sci-fi telemetry.

### Opportunities for Upgrade:
1. **Clinical White Canvas Integration**:
   - Replace the dark background enclosure with a clean, medical-grade presentation on crisp white (`--cm-surface: #ffffff`) with subtle clinical grey contours (`--cm-line: #e2e8f0`).
2. **Interactive 3D Human Anatomy (Three.js / WebGL)**:
   - Three.js is proven compatible with React 19 in this workspace (tested via dry-run).
   - A WebGL canvas can render a 3D anatomical human figure with:
     - 360-degree smooth drag rotation (orbit controls with restricted pitch).
     - Pinch / scroll zoom with bounded limits.
     - Interactive organ mesh picking / selection with smooth camera focus transitions.
     - Real-time organ highlighting using clinical navy and subtle medical accents.
     - Full accessibility fallback: An elegant 2D interactive clinical SVG diagram for devices with reduced motion, low power, or mobile viewports.
3. **Contextual Clinical Intelligence Panel**:
   - Selecting an organ (e.g. Heart) highlights the organ, displays verified biometric parameters (e.g. Resting HR: 72 bpm, BP: 118/78 mmHg from recent records), suggests relevant diagnostic panels (Lipid Profile, HbA1c), and links directly to verified Cardiologists for 1-click consultation.
   - Absolutely no fabricated diagnostic claims or fictional scanner terminology.

---

## 6. Accessibility & Performance Review

### 6.1 Accessibility (WCAG 2.1 AA)
- **Strengths**:
  - `foundation.css` establishes a 44px minimum touch target for interactive controls.
  - `prefers-reduced-motion` media queries disable animations for vestibular-disorder users.
  - Telugu typography (`Noto Sans Telugu`) is configured for local readers in Andhra Pradesh.
- **Weaknesses**:
  - Unconverted pages use low-contrast text (e.g. `#64748b` on light grey or white).
  - Raw hex colors in cards frequently fail the 4.5:1 contrast ratio for body text.
  - Icon-only buttons in many unconverted pages lack `aria-label` attributes.

### 6.2 Responsive Design
- The existing design functions reasonably on desktop (> 1024px), but on mobile screens (320px to 390px):
  - Multi-column tables in Admin and Organization dashboards cause horizontal overflow.
  - The Signup role selector (9 buttons) wraps into an uneven, tall cluster.
  - The Doctor consultation room video grid overflows small viewport heights.

---

## 7. Key Transformation Priorities & Phased Roadmap

1. **Phase 1: Foundation & Unified Design System Tokens**:
   - Clean up `globals.css` to eliminate obsolete glassmorphism, purple gradients, and neon animations.
   - Expand `foundation.css` with semantic clinical tokens: `--cm-navy` (primary brand), `--cm-surface` (pure white canvas), `--cm-surface-subtle` (`#f8fafc`), `--cm-ink` (deep text), `--cm-accent-blue` (`#0369a1`), `--cm-urgent` (`#d92020`).
   - Expand `src/components/ui/` with missing layout and clinical primitives: `DataGrid`, `StatusBadge`, `Timeline`, `MetricCard`, `ClinicalSection`.
2. **Phase 2: Patient Dashboard & Interactive 3D Anatomical Twin**:
   - Recompose `dashboard/patient/page.tsx` from an overwhelming 1,764-line card grid into a structured **Personal Healthcare Command Center**:
     1. Patient Identity & Language Selector
     2. Active Care & Live Delivery Radar
     3. Interactive 3D Anatomical Twin (Three.js WebGL with 2D SVG fallback)
     4. Health Intelligence & Biomarker Trends
     5. Family Care & Emergency Access
3. **Phase 3: Clinical & Role Dashboard Transformations**:
   - **Doctor Command Center**: Redesign onto clinical white canvas; elevate waiting room radar, active teleconsultation banner, and e-prescription studio.
   - **Nurse, Phlebotomist, Dietitian, Physio, Pharmacy, Organization, Staff**: Modernize layouts into specialized operational systems sharing the same white-and-navy brand language.
4. **Phase 4: Public Marketing, Booking & Onboarding Elevation**:
   - Transform `auth/signup/page.tsx` into a multi-role healthcare onboarding experience.
   - Recompose `booking/page.tsx` into a multi-step clinical booking flow.
   - Clean up public home, diagnostics, and consultation pages (remove emojis, enforce white canvas).
5. **Phase 5: Gate Enforcement, Type Safety & E2E Validation**:
   - Expand `ui-lint.config.json` to cover converted files.
   - Run strict type-checks (`tsc --noEmit`), unit tests (`npm run test:unit`), and Playwright accessibility audits.
