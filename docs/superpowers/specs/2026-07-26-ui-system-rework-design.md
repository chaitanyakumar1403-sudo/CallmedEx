# UI System Rework — Design System Enforcement, App Shell Split & Dashboard Conversion

**Date:** 2026-07-26
**Status:** Approved design — ready for implementation planning
**Branch:** `feature/ui-system-rework`
**Scope:** Frontend only. No backend, schema, or API changes.

---

## 1. Purpose

Three previous attempts (`f0c8546`, `1d3103e`, `09af18c`, `a8a1dbb`, `4c865b9`, `b7d2e27`)
introduced a design system and adopted a shell, but the dashboards still read as unfinished.
This spec fixes the reason: **the design system exists and nothing uses it.**

Measured on the current `main`:

| Signal | Count |
|---|---|
| Hardcoded hex colour literals in `.tsx` | 1,911 |
| Inline `style={{…}}` objects | ~2,000 |
| Emoji used as UI icons | 734 |
| Files with inline `linear-gradient` | 24 |
| `organization/page.tsx` | 1,376 lines · 211 inline styles · 30+ `useState` · 17 fetches |

The shell was adopted; the interiors were never converted. Restyling the shell again would
produce the same result a fourth time.

### Faults visible in the reported screenshots

Reference: `ui errors/WhatsApp Image 2026-07-25 at 7.54.13 PM.jpeg` (nurse) and
`ui errors/WhatsApp Image 2026-07-25 at 8.17.16 PM.jpeg` (phlebotomist).

1. **Tabs cut across the banner edge.** `.cm-dash__tabs` uses
   `margin: calc(var(--cm-5) * -1) auto 0` to hang the tab strip off the header, but
   `.cm-dash__head` reserves no bottom space for it. The tabs sit half inside, half
   outside, slicing the header's lower boundary.
2. **A dark slab dropped on a light page.** `ProviderDispatchTracker.tsx:394` hardcodes
   `linear-gradient(135deg, #1e293b 0%, #475569 100%)`, unrelated to the shell's role
   accent. Nurse therefore renders purple banner → slate slab → white page: three
   unrelated surfaces stacked.
3. **Eight saturated role hues.** Nurse `#6d28d9`, phlebotomist `#0f766e`, pharmacy
   `#15803d`, staff `#0369a1` and four more. Two roles side by side read as two products.
4. **Emoji as icons** (📋 ✅ 💰 🌙 🩺 👩‍⚕️) — OS-dependent rendering, cannot take brand
   colour, cannot match stroke weight to adjacent type.
5. **Four chrome layers before content.** `layout.tsx` wraps *every* route, including all
   dashboards, in the marketing utility bar, public navbar, marketing footer and chat
   widget. A phlebotomist on duty sees a "✨ Vizag's #1 Healthcare Platform" badge above
   their dispatch board and a "Careers" link below it.
6. **Slow interaction.** Not a CSS problem. The monolithic dashboards re-render their
   entire tree — and reallocate every inline style object — on any state change.

---

## 2. Direction (decided)

| Decision | Choice |
|---|---|
| Aesthetic | **Consumer logistics** — Swiggy / Rapido / Uber driver. Bold type, strong status colour, large tap targets, live-state emphasis |
| Role colour | **One brand colour.** All eight role accents deleted. Roles differ by layout and content, never hue |
| Depth | **Full conversion**, dashboard by dashboard, checkpoint after each wave |
| Icons | **lucide-react** |
| Chrome | **Split public and app shells** via route groups |
| Layout | **Top bar + tabs** (mockup option A) |
| Surfaces | Dashboards **and** patient-facing flows. Marketing home/about excluded |

The `foundation.css` thesis — "clarity under pressure… the nearest honest reference is
transit and emergency wayfinding" — already describes consumer-logistics design. It is
retained and finally enforced.

**Consequence of one brand colour:** the entire colour budget is freed for status.
Colour now always means state (`urgent` / `active` / `done` / `waiting` / `halted`) and
never decoration. Red remains reserved for urgency alone, per the existing rule at the
top of `foundation.css`.

---

## 3. Chrome architecture

Root `layout.tsx` retains only `<html>`, `next/font` variables, `globals.css` import and
the skip link. Two shells sit below it as route groups.

| Group | Chrome | Routes |
|---|---|---|
| `(public)` | utility bar, `SmartNavbar`, marketing footer, chat widget | `/`, `/about`, `/diagnostics`, `/consultation`, `/pharmacy`, `/search`, `/auth/*` |
| `(app)` | `AppBar` only — logo, role chip, notifications, account menu | `/dashboard/*`, `/booking/*`, `/tracking/*`, `/dispatch/*`, `/consultation/[doctorId]` |

Route groups do not appear in the URL, so `src/app/dashboard` becomes
`src/app/(app)/dashboard` with no redirects, no changed links and no SEO impact.

`/consultation` (public doctor browse) stays in `(public)`; `/consultation/[doctorId]`
(the consultation room) moves to `(app)`. Any route whose grouping is ambiguous during
implementation is resolved by a single test: **does an unauthenticated visitor have a
reason to be here?** Yes → `(public)`. No → `(app)`.

### AppBar contents

Single 48px navy bar: wordmark, role chip, notification bell with unread count, avatar
menu (profile, settings, logout). Replaces utility bar + navbar + banner + tab strip —
four layers become two.

---

## 4. Token layer

`src/app/styles/foundation.css` is amended, not replaced. Its status scale, spacing scale,
type scale, 44px tap-target floor, reduced-motion handling, Telugu handling and
`prefers-contrast` block are all sound and stay.

**Changes:**

1. Delete all eight `.cm-dash[data-role="…"]` accent blocks (`foundation.css:325–332`).
   `--cm-accent` resolves to `--cm-navy` permanently.
2. Rewrite `.cm-dash__head` / `.cm-dash__tabs` / `.cm-tab` so the tablist is a flex row
   *inside* the app bar region with a bottom-border active indicator. The negative
   `margin-top` that causes the overlap is removed.
3. Delete the gradient on `.cm-dash__head`. Flat navy.
4. Add motion tokens for the interaction states the primitives need
   (`--cm-ease-out`, `--cm-dur-press`).

No new colour tokens are introduced. If a value is needed that no token provides, that is
a signal the design is drifting, not that a token is missing.

---

## 5. Primitive library — `src/components/ui/`

The missing layer. Every inline style in the codebase resolves to one of these.

| Primitive | Replaces |
|---|---|
| `AppBar` | the utility bar + navbar stack on app routes |
| `PageHeader` | per-dashboard inline gradient headers |
| `Tabs` | `DashboardShell`'s tab strip — **existing ARIA tablist and roving-tabindex logic is preserved verbatim**, only presentation changes |
| `Panel` / `Card` | `.cm-panel` plus ~40 ad-hoc inline card styles |
| `Stat` | four separate inline stat-card variants (doctor, org, pharmacy, admin) |
| `Button` | every inline `<button style={{…}}>`; variants `primary` / `secondary` / `ghost` / `danger`, sizes `sm` / `md` |
| `Pill` | `.cm-pill`, already correct — wrapped for typed status props |
| `Field` | inline-styled inputs, selects, textareas; owns label, hint, error, `aria-describedby` |
| `Modal` | the five hand-rolled overlays — `NurseToolsModal`, `PhlebotomistToolsModal`, `DrugShieldModal`, `AIVoiceIntakeModal`, `ConsentModal`; owns focus trap, `Esc`, scroll lock |
| `EmptyState` | `DashboardShell`'s emoji-defaulted empty state |
| `Skeleton` | `SkeletonRows` |
| `DataTable` | the inline-styled tables in admin and organization |
| `Icon` | 734 emoji |

Each primitive is styled by class only. **No primitive accepts a `style` prop**, which is
what makes the regression gate in Section 8 enforceable.

`StatusSpine` and the `.cm-spine` CSS are already correct and are left alone.

---

## 6. Icons

Add `lucide-react`. Icons are re-exported through `src/components/ui/icons.ts` so the
used set stays auditable in one file and tree-shaking stays honest:

```ts
export { MapPin, TestTube, Wallet, User, ClipboardList, CheckCircle2, Power, Bell } from "lucide-react";
```

The 734 emoji collapse to roughly 60 named icons. `Icon` fixes size and stroke width to
token values so icons always match adjacent type weight.

Emoji are permitted nowhere in chrome, controls, tabs, stat cards or empty states. This is
the first dependency added to a currently zero-dependency frontend (`next`, `react`,
`react-dom` only) — accepted deliberately in exchange for not hand-drawing 60 icons.

---

## 7. Conversion waves

Each wave lands as its own commit and stops for review. **Wave 1 is the direction check —
nothing proceeds past it without approval.**

**51 files** are converted across six waves. Counts below are *lines / inline-style objects*.

### Wave 0 — foundation (no conversion)
Tokens, `src/components/ui/*`, `icons.ts`, route-group split, `AppBar`, and the
`DashboardShell` (207/2) rewrite. The only visible change is chrome.

### Wave 1 — field dispatch · **REVIEW CHECKPOINT** (9 files)
Both dashboards from the reported screenshots. `nurse/page.tsx` and
`phlebotomist/page.tsx` are thin wrappers around `ProviderDispatchTracker`, so converting
the tracker delivers both at once.

`ProviderDispatchTracker` (1073/129) · `PhleboWalletPanel` (206/26) ·
`AttendanceCard` (166/10) · `DashboardProfile` (117/8) · `NurseToolsModal` (116/21) ·
`PhlebotomistToolsModal` (90/20) · `supervisor` (130/17) · `phlebotomist` (119/2) ·
`nurse` (99/1)

### Wave 2 — patient journey (15 files)
Converted together so no seam is visible mid-booking.

`booking` (1257/167) · `patient` (1072/134) · `tracking/[dispatch_id]` (471/54) ·
`InteractiveBodyMap` (367/26) · `LocationPicker` (367/17) · `AIVoiceIntakeModal` (302/24) ·
`booking/nurse` (245/60) · `GeoapifyMap` (239/2) · `patient/pharmacy` (237/19) ·
`patient/reports` (229/45) · `OffersStrip` (161/17) · `patient/bookings` (129/16) ·
`patient/pmjay` (114/26) · `patient/insurance` (93/17) · `booking/hospital` (30/3)

### Wave 3 — consultation (8 files)
`doctor` (1114/119) · `consultation/[doctorId]` (267/26) · `consultation` (259/30) ·
`PrescriptionView` (237/7) · `doctor/consult/[id]` (233/36) · `VideoRoom` (198/4) ·
`ConsentModal` (173/21) · `DrugShieldModal` (99/23)

### Wave 4 — organization & lab (7 files)
The worst offenders, attempted only once the system is proven across three waves.

`organization` (1376/211) · `SampleCollectionPanel` (621/57) · `staff` (458/56) ·
`SampleIntakeQueue` (405/37) · `LabTeamPanel` (313/31) ·
`dispatch/respond/components/TaskTracker` (170/27) · `dispatch/respond` (127/14)

### Wave 5 — pharmacy & admin (3 files)
`admin` (706/124) · `pharmacy` (517/95) · `admin/fraud` (127/28)

### Wave 6 — public in-scope surfaces (9 files)
`auth/signup` (960/61) · `diagnostics` (535/46) · `search` (437/4) ·
`auth/accept-mou` (350/41) · `auth/reset-password` (343/46) · `DateOfBirthPicker` (218/16) ·
`auth/forgot-password` (164/25) · `auth/login` (93/7) · `SmartNavbar` (91/5)

`StatusSpine` (165/0) is already clean and is not converted.

A wave is **done** only when its files contain zero `style={{`, zero hex literals, zero
emoji in chrome, and pass the gate in Section 8. Partially-converted files are not
permitted — that is precisely how the current state was reached.

---

## 8. Regression gate

**The most important part of this spec.** Without it the mess returns with the next
feature, as it did after each previous attempt.

A `npm run lint:ui` script, wired into CI and the pre-commit hook, that fails when a file
on the converted list contains:

- `style={{` — anything needing dynamic style gets a CSS custom property instead
- a raw hex literal (`#rrggbb` / `#rgb`)
- an emoji codepoint in JSX (all 734 are chrome or control decoration; none survive
  conversion, so the rule needs no carve-out)
- `linear-gradient(` — permitted only in `foundation.css` and `design-system.css`

The gate runs on `.tsx` files only. The CSS files under `src/app/styles/` are where hex
literals and gradients are *supposed* to live.

The converted-file list grows one wave at a time, so the gate is enforceable from Wave 1
rather than waiting for a big-bang finish.

**Escape hatch:** a `// ui-lint-ignore-next-line <reason>` comment, requiring a written
reason. Uses are reviewed; a growing count means a primitive is missing.

---

## 9. Performance

The lag is component structure, not CSS. Converting styles alone would leave it.

1. **Style objects → classes.** Removes ~2,000 object allocations per render tree.
2. **Split the monoliths per tab.** `organization/page.tsx` holds 30+ `useState` and 17
   fetches in one 1,376-line component, so a keystroke in the "Add Service" form
   re-renders everything and reallocates all 211 style objects. Each tab panel becomes its
   own component owning its own state. Same for `doctor` (1,114) and `patient` (1,072).
3. **Fetch per tab, not on mount.** Data moves to the panel that needs it.
4. **Suspense boundaries** so chrome paints before data lands.
5. **Measure.** React Profiler commit count and duration for a single form keystroke on
   `organization`, plus Lighthouse TBT on `phlebotomist` and `organization`, recorded
   before Wave 0 and after Wave 5. Numbers go in the PR description.

Target: a keystroke in any dashboard form commits one panel, not the whole page.

---

## 10. Verification

Playwright is already installed (`@playwright/test`, `e2e/`, `tests/`, `playwright.config.ts`).

- **Screenshots** of every converted surface at 390px, 768px and 1440px, committed per
  wave so the review checkpoint is a visual diff rather than a description.
- **Axe** pass per converted surface: contrast ratios, 44px target floor, focus visibility,
  tablist semantics.
- **Existing e2e suites must stay green.** This is a presentation rework; any behavioural
  change is a defect.
- **Keyboard walk** of each converted dashboard: skip link → app bar → tablist (arrow keys)
  → panel, with focus visible throughout.

---

## 11. Out of scope

Deferred deliberately, not dropped:

- **Dark mode.** No user request, doubles the review surface.
- **Marketing home / about redesign.** Least broken, blocks nobody.
- **Any backend, schema or API change.**
- **Partner-blind diagnostics booking, nurse wallet & settlements, admin bulk
  select/suspend/delete.** These are the reporter's items 1–3, each getting its own spec.
  They are sequenced *after* this one because all three add new screens; building them
  first would mean building them twice.
- **Telugu/vernacular expansion.** The font and `:lang(te)` rules already exist; broader
  i18n is separate work.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Behavioural regression across 51 files | Per-wave checkpoint; existing e2e must stay green; presentation-only mandate |
| Six waves is a long run before the work is finished | Waves are independently shippable — each leaves the app in a consistent, releasable state. Stopping after any wave is a valid outcome |
| Wave 4 (`organization`, 1,376 lines) is genuinely large | Attempted only after three waves have proven the primitives; split per tab first, then converted |
| `lucide-react` is the frontend's first dependency | Tree-shaken, re-exported through one auditable file |
| Gate becomes an obstacle and gets disabled | Escape hatch with mandatory written reason; rising usage is treated as a missing primitive, not as noise |
| Direction rejected after Wave 1 | That is what Wave 1 is for — only 4 files are converted at that point |

---

## 13. Definition of done

- All 51 in-scope files converted; `npm run lint:ui` green across the full list.
- Zero role-hue accents; `--cm-accent` is navy everywhere.
- Zero emoji in chrome, controls, tabs, stat cards or empty states.
- Dashboards carry no marketing utility bar or footer.
- Tab strip renders inside the bar, with no clipped header boundary at any of the three
  breakpoints.
- Single-keystroke form input commits one panel, not the page.
- Existing Playwright suites green; axe clean on every converted surface.
- Before/after performance numbers recorded in the PR.
