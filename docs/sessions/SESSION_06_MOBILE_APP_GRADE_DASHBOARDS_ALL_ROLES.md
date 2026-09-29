# Session 06: Mobile App-Grade Dashboards for Every Role

- **Session**: 06
- **Date**: 2026-09-29
- **Builds on**: Session 05 (`f515124`). Session 05 removed page-level horizontal overflow. This session makes every dashboard feel like a native app on phones and tablets, so the web app replaces a separate mobile app.
- **Status**: Implemented and verified in Chromium emulation. **Not yet committed or deployed.** Physical-device testing is still pending.

---

## 1. Why Session 05 was not enough

Session 05's audit measured only `scrollWidth <= innerWidth`, with a fake token and a 400ms wait. Most dashboards were therefore measured in their loading state. Real use on a phone showed problems that audit could not catch:

| Symptom reported / observed | Root cause |
|---|---|
| Notification panel appears off to the right; user must zoom out | The panel was rendered inside the AppBar. Any page overflow widened the layout viewport, and the fixed panel moved with it. |
| Phlebotomist sees "Patient Notification Center" with fake patient alerts ("Join Video Room", Metformin) | Role detection only knew doctor, organization and processing_center; every other role fell back to `patient`. |
| Page stays zoomed after tapping a form field (iPhone) | Inputs rendered at 13.6px. iOS Safari zooms any input below 16px on focus. |
| Dashboards feel congested and long (patient page ~6150px tall at 390px) | KPI cards one-per-row at full width, desktop paddings, tall headers, and 3D hubs placed before the real work. |
| Phlebotomist's "Go On Duty" ~1500px down the page | The 3D field hub and the advance-collections widget rendered before the dispatch tracker. |
| Scanner hangs on "Requesting camera access…" on iPhone Safari | The html5-qrcode fallback (used when `BarcodeDetector` is missing) never started because `aliveRef` was only set on the native path. |
| Samples tab 929px wide on a 390px phone | A long affiliation `<select>` blew out its grid column. |
| Doctor Home Visits tab 441px wide; Waiting Room Radar 380px at 360px | A shift `<select>` row and a 4-button segmented filter did not wrap. |

---

## 2. What changed

### 2.1 Architecture: four isolated mobile CSS layers
Four new files are imported in `src/app/layout.tsx` after `globals.css`, so they win the cascade without touching `foundation.css`:

| File | Owner area |
|---|---|
| `styles/mobile-shell.css` | Shared chrome: AppBar, DashboardShell, PageHeader, KPI grids, modals, notification sheet, patient nav, floating buttons |
| `styles/mobile-field.css` | Phlebotomist, nurse, dispatch, scanner |
| `styles/mobile-clinical.css` | Doctor (incl. telemedicine), dentist, dietitian, physio, staff, pharmacy |
| `styles/mobile-console.css` | Patient, organization, admin, fraud, supervisor, processing centre |

**Desktop guarantee:** every layout rule sits inside `@media (max-width: 960px | 640px | 480px | 380px)`. A script-parsed audit of all four files found only seven rules outside a max-width query, none of which change desktop appearance:
- global touch rules (`touch-action`, tap highlight, `text-size-adjust`)
- two `display: none` defaults for mobile-only elements
- a reduced-motion rule
- the scanner's new manual-entry footer, which is intentional on desktop too

Inline-style attribute selectors in `mobile-clinical.css` are scoped to `:is(.cm-dash, .cm-mc-cmain)`, so public pages certified in Session 05 are unaffected.

### 2.2 Shared shell (all roles)
- **Sticky top bar:** the AppBar is sticky on ≤960px and respects safe-area insets (notch, Dynamic Island).
- **Sticky section tabs:** provider section navigation becomes a sticky, compact, horizontally scrolling tab strip under the AppBar, with scroll-snap and an edge fade.
  - The active tab auto-centres in the strip.
  - Switching tabs while scrolled returns the user to the top of the new section.
- **Account actions moved:** Change Password and Delete Account move from the top of the page into an "Account & security" block after the content, on phones and tablets only.
- **Inputs:** 16px on ≤960px, which prevents the iOS focus zoom.
- **KPI cards:** a compact 2-column grid on phones.
- **Page header and spacing:** the page header is compact, and card and body paddings are reduced to 12–16px.
- **Modals:** shown as bottom sheets on phones (full width, max 92dvh, internal scroll, safe-area padding).
- **Floating buttons:** the chat bubble and admin HUD are smaller, safe-area aware, and no longer cover the last row of content.
- **Viewport:** `viewport` export sets `device-width`, `viewportFit: cover` and `themeColor #1a2b4a`. Zoom is **not** disabled (accessibility).
- **Installable web app:** `src/app/manifest.ts` (standalone display, navy theme) plus `appleWebApp` metadata. "Add to Home Screen" opens CallMedex full-screen like an app. No service worker was added, deliberately: offline caching of health data needs a separate DPDP review.

### 2.3 Notification center
- **Portal:** rendered via `createPortal(document.body)`, so it no longer depends on page overflow or ancestor layout. Body scroll is locked while it is open.
- **Role detection:** the role comes from the `/dashboard/<segment>` path first, then `user.role`, then the prop. Doctor, organization, processing-centre and patient behaviour is unchanged. Every other role now gets:
  - a neutral "Notifications" title
  - only its real fetched notifications (no demo alerts, no patient CTA links)
  - a footer link to its own dashboard
- **Mobile sheet:** grab handle, one-line title, icon-only "Mark all read", scrollable tabs, messages clamped to 3 lines, and a full-width footer button.

### 2.4 Phlebotomist and nurse (field)
- **Live Dispatch order on phones:** duty bar and active task first, then the advance roster, then the 3D hub last and shorter (260px). Desktop order is unchanged.
- **Duty bar:** the duplicate off-duty panel is hidden on phones. Go On Duty is a full-width 56px button, and the three stats sit in one compact row.
- **Active task step:** the primary step button (Mark Arrived, Verify OTP…) is a sticky full-width 56px button.
- **Scan FAB:** a floating **Scan** button (bottom-left, 52px) on phones and tablets, from any tab. A scan fills the booking ID **and** switches to Doorstep Collection.
- **Scanner:**
  - Full-screen camera on phones, with a 48px close button in the safe area.
  - A manual-entry fallback, and the camera is stopped correctly on close.
  - Fixed: the html5-qrcode fallback never started on browsers without `BarcodeDetector`.
- **Tabs:** Collection, Samples, Schedule, Stock, Wallet and Profile were reflowed for phones. The Samples tab 929px overflow is fixed.
- **Nurse:** the marketing header and KPI strip are hidden on phones. The real duty control lives in the dispatch tracker; the header's toggle only drove a local label. The 3D hub moves last, the schedule overflow (468px) is fixed, and vitals are two across with 48px inputs.

### 2.5 Clinical (doctor, dentist, dietitian, physio, staff, pharmacy)
- **Grids and tap targets:** fixed multi-column inline grids collapse on phones, and every control inside dashboards is at least 44px tall.
- **Doctor:**
  - The appointment queue comes first and the 3D analytics hub last. Appointment actions are full width, and the filter chips scroll.
  - The Home Visits shift row now wraps, and the Waiting Room segmented filter scrolls.
- **Telemedicine consult page:** video full width on top, notes and prescription stacked below, and a fixed 48px bottom action bar.
- **Dentist:** the tariff table and odontogram scroll inside their card.
- **Pharmacy:** KPIs two per row, filters scroll, and the orders table becomes stacked label/value cards.

### 2.6 Patient, organization, admin, supervisor, processing centre
- **Patient:**
  - Tighter sections: 16px cards, compact section headers, and a 300px 3D body viewer.
  - Organ chips in one scroll strip, and advisor pop-ups as bottom sheets.
  - Fixed: the Add Medication dialog was sized to its panel because a hover `transform` created a containing block.
- **Organization, admin, fraud and processing centre:**
  - Dense tables scroll inside their card.
  - Lab queues and staff and report tables become stacked cards (`td[data-label]`).
  - Inline fixed modals become bottom sheets.
- **Processing-centre intake:** the barcode input takes the full row, the Scan and Camera buttons sit below it, and checkboxes are 24px.

---

## 3. Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean |
| `npm run lint:ui` (21 gated files) | Clean |
| `npm run test:unit` | 40 / 40 pass |
| `npm run build` (production) | Success; `/manifest.webmanifest` generated |
| Session 05 audit (`scripts/verify_responsive.mjs`) on production build | 307 checks, **0 overflow violations**, 3 / 3 interaction passes |
| New tab sweep (`scripts/sweep_tabs.mjs`): 14 dashboard routes × every section tab × 360 / 390 / 768px | First run: 210 checks, 2 failures (doctor Home Visits and Waiting Room Radar), both fixed. Final run: **213 checks, 0 failures** |
| Desktop-rule audit of the four mobile CSS files | 7 rules outside max-width queries, all non-visual on desktop (§2.1) |

**Late fixes before the final sweep:**
- `processing-center/page.tsx`: a failed `pcAPI.getMe()` now renders the unassigned-centre state instead of redirecting to login. A 401 (dead session) still redirects to login, and `pc_role` is still read.
- `SmartNavbar.tsx` / `foundation.css`: `.navbar__actions` is hidden on ≤640px (fixes a 363px public-navbar overflow). Login, Logout and the dashboard link remain in the mobile drawer.
- `globals.css` / `foundation.css`: the utility bar clips overflowing phone links.
- `mobile-clinical.css`: the chat bubble is hidden on phones while the video-consult action bar is showing.

**Fixed from the owner's phone screenshot:**
- `/diagnostics` "Home Sample Collection | Walk-in Diagnostic Centres" switcher: on phones the "Scans & Labs" badge ran past the screen edge. This was invisible to both audits because the hero clips overflow, so `scrollWidth` stayed clean. The switcher now splits the width evenly and stacks icon, label and badge (`.cm-diag-switch*` in `mobile-shell.css`, plus `aria-pressed` on both buttons).
- The public utility bar's sideways-scrolling emergency numbers get a right-edge fade, so a cut-off number reads as "swipe for more".
- New check `scripts/verify_edge_clip.mjs`: flags visible elements that stick past the viewport edge even when an ancestor clips them. It skips intentional scrollers and decorative `pointer-events: none` glows. Result across 12 public routes at 360 / 390px: **0**.

`scripts/sweep_tabs.mjs` is new. Unlike the Session 05 audit, it waits for each dashboard's tabs to render and clicks through every section tab before measuring.

---

## 4. Limitations (honest disclosure)

1. **Emulation only:** all testing was Chromium emulation. Physical iPhone Safari and Android Chrome are untested. `mobile-console.css` uses native CSS nesting and `:has()`, which are supported in Safari 16.5+ but were not device-tested.
2. **Offline backend:** the backend was offline, so populated states were checked from mocks and JSX reading, not live data. Unchecked populated states include:
   - Kit & Stock list, sample checklists and nurse schedule jobs
   - admin weekly-report modal, delegation modal and Create Supervisor form
3. **Desktop comparison was sampled:** before/after screenshots were compared for some dashboards only; the rest rely on the media-query audit in §2.1.
4. **Known leftovers:**
   - On the consult page, the chat bubble can overlap the bottom action bar.
   - The processing-centre intake input has `autoFocus`, which opens the keyboard on phones.
   - Some legacy 3D, selfie and collection-kit widgets still use gradients or emoji on desktop.

---

## 5. Final status

### IMPLEMENTED — VERIFIED IN EMULATION; COMMIT, DEPLOY AND PHYSICAL-DEVICE CHECK PENDING
