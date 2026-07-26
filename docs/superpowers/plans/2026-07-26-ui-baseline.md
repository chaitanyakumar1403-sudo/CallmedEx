# UI Baseline — 2026-07-26

Recorded before the UI system rework (Wave 0/1) begins, on branch
`feature/ui-system-rework`, from `frontend/`. This document exists so later
claims about "kept the tests green" and "improved performance" are checkable
against real numbers rather than assumptions. No application code was
changed to produce this document.

## How this was produced

1. `cd frontend && npm run build` — production build (Next.js 16.2.10,
   Turbopack). Succeeded.
2. `npx playwright test --project=chromium --reporter=list` — full e2e
   suite, chromium only, against the production build via the `webServer:
   npm run start` config in `playwright.config.ts`.
   - First attempt was run in the background. All 12 tests completed and
     were listed in the output, but the `npx playwright` process (PID 20892)
     and the `next start` server it had launched (PID 8464) then hung during
     shutdown/teardown for several minutes with no further output and no
     process-count change — a known pattern for `next start` not exiting
     cleanly on SIGTERM on Windows. That run was killed
     (`Stop-Process -Force`) once it was confirmed stuck, and its partial
     list-only output (no error detail blocks) was discarded in favor of a
     clean rerun.
   - Second attempt was run in the foreground with an explicit 600000ms
     tool timeout, one attempt, no retries/polling. It completed normally in
     34.2s of test time. The full output below is from this run.
3. `cd frontend/src` — grep counts per the brief's Step 3.

## Step 1: e2e suite results (chromium only)

**12 tests total: 5 passed, 7 failed.**

| # | Spec | Test | Result | Time |
|---|---|---|---|---|
| 1 | example.spec.ts:3 | has title | PASS | 1.7s |
| 2 | example.spec.ts:10 | get started link | PASS | 2.1s |
| 3 | new-features.spec.ts:63 | 3. Signup - Should allow adding multiple documents for providers | PASS | 3.3s |
| 4 | pharmacy.spec.ts:4 | should load the pharmacy dashboard and allow adding inventory | PASS | 3.9s |
| 5 | provider-dispatch.spec.ts:75 | Doctor Dashboard - Should load and verify tracking elements | PASS | 671ms |
| 6 | new-features.spec.ts:35 | 1. Search Page - Should load location and search inputs | **FAIL** | 5.8s |
| 7 | new-features.spec.ts:46 | 2. Smart Navbar - Provider should not see consumer links | **FAIL** | 6.0s |
| 8 | new-features.spec.ts:83 | 4. Phlebotomist Dashboard - Profile Tab and Selfie Modal | **FAIL** | 5.9s |
| 9 | booking.spec.ts:4 | should load the booking page and allow selecting a nurse home visit | **FAIL** | 6.2s |
| 10 | provider-dispatch.spec.ts:48 | Phlebotomist Dashboard - Should load tracking UI and OTP field | **FAIL** | 5.3s |
| 11 | provider-dispatch.spec.ts:63 | Nurse Dashboard - Should load and verify home visit tracking UI | **FAIL** | 5.3s |
| 12 | booking.spec.ts:28 | should allow multi-selection of tests in diagnostic centers | **FAIL** | 30.0s (test timeout exceeded) |

Total run time: 34.2s (5 passed).

### Failure messages, verbatim

**1) `booking.spec.ts:4` — should load the booking page and allow selecting a nurse home visit**
```
Error: expect(locator).toBeVisible() failed

Locator: locator('button.btn-primary').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button.btn-primary').first()

  18 |     // Proceed to the next step
  19 |     const nextButton = page.locator('button.btn-primary').first();
> 20 |     await expect(nextButton).toBeVisible();
     |                              ^
  21 |     await nextButton.click();
    at C:\Users\chait\OneDrive\Desktop\callmedex\frontend\e2e\booking.spec.ts:20:30
```

**2) `booking.spec.ts:28` — should allow multi-selection of tests in diagnostic centers**
```
Test timeout of 30000ms exceeded.

Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button.btn-primary').first()

  32 |     const labOption = page.locator('div').filter({ hasText: 'Home Sample Collection' }).first();
  33 |     await labOption.click();
> 34 |     await page.locator('button.btn-primary').first().click();
     |                                                      ^
    at C:\Users\chait\OneDrive\Desktop\callmedex\frontend\e2e\booking.spec.ts:34:54
```

**3) `new-features.spec.ts:35` — 1. Search Page - Should load location and search inputs**
```
Error: expect(locator).toBeVisible() failed

Locator: getByPlaceholder('e.g. Apollo Hospitals')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByPlaceholder('e.g. Apollo Hospitals')

  38 |     // Verify inputs are present
> 39 |     await expect(page.getByPlaceholder('e.g. Apollo Hospitals')).toBeVisible();
     |                                                                  ^
  40 |     await expect(page.getByPlaceholder('City, District, or Pincode')).toBeVisible();
    at C:\Users\chait\OneDrive\Desktop\callmedex\frontend\e2e\new-features.spec.ts:39:66
```

**4) `new-features.spec.ts:46` — 2. Smart Navbar - Provider should not see consumer links**
```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('navigation').getByRole('link', { name: 'Find Hospitals' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('navigation').getByRole('link', { name: 'Find Hospitals' })

  48 |     await page.goto('http://localhost:3000/');
  49 |     const nav = page.getByRole('navigation');
> 50 |     await expect(nav.getByRole('link', { name: 'Find Hospitals' })).toBeVisible();
     |                                                                     ^
  51 |     await expect(nav.getByRole('link', { name: 'Pharmacy' })).toBeVisible();
    at C:\Users\chait\OneDrive\Desktop\callmedex\frontend\e2e\new-features.spec.ts:50:69
```

**5) `new-features.spec.ts:83` — 4. Phlebotomist Dashboard - Profile Tab and Selfie Modal**
```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1').filter({ hasText: 'Phlebotomist Hub' }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('h1').filter({ hasText: 'Phlebotomist Hub' }).first()

  93 |     // Should be on the Dispatch Tracking tab initially
> 94 |     await expect(page.locator('h1', { hasText: 'Phlebotomist Hub' }).first()).toBeVisible();
     |                                                                               ^
  95 |
  96 |     // Verify Selfie Modal triggers when clicking Go On Duty
    at C:\Users\chait\OneDrive\Desktop\callmedex\frontend\e2e\new-features.spec.ts:94:79
```

**6) `provider-dispatch.spec.ts:48` — Phlebotomist Dashboard - Should load tracking UI and OTP field** (EXPECTED failure per task brief)
```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1').filter({ hasText: 'Phlebotomist Hub' }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('h1').filter({ hasText: 'Phlebotomist Hub' }).first()

  52 |     // Wait for dashboard to load
> 53 |     await expect(page.locator('h1', { hasText: 'Phlebotomist Hub' }).first()).toBeVisible();
     |                                                                               ^
  54 |
  55 |     // In a mock state, there might be active tasks or "No active tasks"
    at C:\Users\chait\OneDrive\Desktop\callmedex\frontend\e2e\provider-dispatch.spec.ts:53:79
```

**7) `provider-dispatch.spec.ts:63` — Nurse Dashboard - Should load and verify home visit tracking UI** (EXPECTED failure per task brief)
```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1').filter({ hasText: 'Nurse Dashboard' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('h1').filter({ hasText: 'Nurse Dashboard' })

  67 |     // Wait for dashboard to load
> 68 |     await expect(page.locator('h1', { hasText: 'Nurse Dashboard' })).toBeVisible();
     |                                                                      ^
  69 |
  70 |     // Verify main components render without crashing
    at C:\Users\chait\OneDrive\Desktop\callmedex\frontend\e2e\provider-dispatch.spec.ts:68:70
```

### Interpretation

Two of the seven failures (#6 and #7 above, both in `provider-dispatch.spec.ts`)
are the ones this baseline exists to document: they assert an `h1` reading
"Phlebotomist Hub" and "Nurse Dashboard", but the dashboards were renamed in
an earlier commit and now render "Field Collection" and "Home Nursing"
respectively — the tests were never updated. This baseline does not fix
those tests; a later task does.

The other five failures (#1–#5) are pre-existing and unrelated to the UI
rework: missing `button.btn-primary` locators in the booking flow, a missing
search-page placeholder, a missing "Find Hospitals" nav link, and the same
stale "Phlebotomist Hub" assertion duplicated in `new-features.spec.ts:83`.
These are recorded for completeness but are out of scope for this plan;
they were already failing before this branch existed.

## Step 2: First Load JS for Wave 1 routes

```
$ cd frontend && npm run build 2>&1 | grep -E "dashboard/(phlebotomist|nurse)"
├ ○ /dashboard/nurse
├ ○ /dashboard/phlebotomist
```

**No bundle-size figures are available from this build's output.** This
project builds with Next.js 16.2.10 under Turbopack, and the production
build's route table in this version prints only the route path and a
static/dynamic marker (`○`/`ƒ`) — there is no `Size` / `First Load JS`
column in the table, unlike older webpack-based Next.js output. This was
verified twice: once piped through `tee`, once redirected directly to a
file (ruling out TTY-width truncation as the cause). The full route table
for reference:

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /about
├ ○ /auth/accept-mou
├ ○ /auth/forgot-password
├ ○ /auth/login
├ ○ /auth/reset-password
├ ○ /auth/signup
├ ○ /booking
├ ○ /booking/hospital
├ ○ /booking/nurse
├ ○ /consultation
├ ƒ /consultation/[doctorId]
├ ○ /dashboard/admin
├ ○ /dashboard/admin/fraud
├ ○ /dashboard/doctor
├ ƒ /dashboard/doctor/consult/[id]
├ ○ /dashboard/nurse
├ ○ /dashboard/organization
├ ○ /dashboard/patient
├ ○ /dashboard/patient/bookings
├ ○ /dashboard/patient/insurance
├ ○ /dashboard/patient/pharmacy
├ ○ /dashboard/patient/pmjay
├ ○ /dashboard/patient/reports
├ ○ /dashboard/pharmacy
├ ○ /dashboard/phlebotomist
├ ○ /dashboard/staff
├ ○ /dashboard/supervisor
├ ○ /diagnostics
├ ○ /dispatch/respond
├ ○ /pharmacy
├ ○ /search
└ ƒ /tracking/[dispatch_id]

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

Both `/dashboard/phlebotomist` and `/dashboard/nurse` are statically
prerendered (`○`). **Do not carry forward any First Load JS number for
these routes from this baseline** — none was observed. If Task 20's
comparison needs a size delta, it will need to derive it from `.next`
build artifacts (e.g. `.next/static` chunk sizes referenced in
`.next/build-manifest.json` for these two routes) using the same method on
both ends of the comparison, since the build tool does not print one.

## Step 3: Inline-style / hardcoded-color counts

```
$ cd frontend/src
$ grep -ro "style={{" --include=*.tsx . | wc -l
2147

$ grep -roE "#[0-9a-fA-F]{6}" --include=*.tsx . | wc -l
1911
```

- `style={{` occurrences: **2147** (brief expected "~2000" — close, not exact;
  recorded as observed).
- 6-digit hex color literal occurrences: **1911** (brief expected 1911 —
  exact match).

## Environment

- Branch: `feature/ui-system-rework`
- Node/npm build tool: Next.js 16.2.10 (Turbopack)
- Playwright: 1.61.1, chromium project only (firefox/webkit not run, per
  task instructions)
- OS: Windows 11 (win32), commands run via Git Bash / PowerShell

---

## Wave 1 result — 2026-07-26 (Task 20)

Recorded after Tasks 1–19 (18 files converted, gate clean) and Task 20's own
work (three stale `h1` assertions fixed, `@axe-core/playwright` installed,
`e2e/ui-wave1.spec.ts` added, screenshots captured). Same branch, same
method as the baseline above — `frontend/` is the working directory for
every command.

### Before / after

| Metric | Baseline | Wave 1 | Command |
|---|---|---|---|
| `ProviderDispatchTracker.tsx` line count | 1073 | **547** | `wc -l "src/app/(app)/dashboard/components/ProviderDispatchTracker.tsx"` |
| `style={{` occurrences (`src/`) | 2147 | **1912** | `grep -ro "style={{" --include=*.tsx src/ \| wc -l` |
| 6-digit hex literal occurrences (`src/`) | 1911 | **1696** | `grep -roE "#[0-9a-fA-F]{6}" --include=*.tsx src/ \| wc -l` |
| e2e suite (chromium, original 12 tests) | 5 passed / 7 failed | **7 passed / 5 failed** | `npx playwright test --project=chromium --reporter=list e2e/example.spec.ts e2e/new-features.spec.ts e2e/pharmacy.spec.ts e2e/provider-dispatch.spec.ts e2e/booking.spec.ts` |
| lint:ui gate — converted file count | 0 | **18**, clean | `npm run lint:ui` |

`ProviderDispatchTracker.tsx` dropped from 1073 to 547 lines (~49%) because
Tasks 12–15 split its duty bar, active-task panel, task list, off-duty
panel, selfie modal, lab-handover modal and vitals modal out into
`dashboard/components/dispatch/*.tsx` — the line count moved out of this
file, not out of the codebase; the `style={{` and hex-literal counts are
codebase-wide (`src/`) so they reflect real removal, not relocation.

### e2e result — deviation from the brief's prediction

The brief predicted **8 passed / 4 failed**. The actual result is **7
passed / 5 failed**. Every test green at baseline is still green, and the
two `provider-dispatch.spec.ts` tests the brief targeted
(`Phlebotomist Dashboard`, `Nurse Dashboard`) now pass for the first time,
exactly as predicted. The discrepancy is in a third test the brief did not
anticipate:

**`new-features.spec.ts:83` — "4. Phlebotomist Dashboard - Profile Tab and
Selfie Modal"** was failing at baseline on its `h1` assertion (line 94,
`'Phlebotomist Hub'`), the same duplicated stale string this task's Step 1
fixes. Fixing it (→ `'Field Collection'`) does make that assertion pass —
but the test still fails, now three lines later:

```
Locator: getByRole('button', { name: '🟢 Go On Duty' })
Expected: visible
  97 |     const onDutyBtn = page.getByRole('button', { name: '🟢 Go On Duty' });
> 98 |     await expect(onDutyBtn).toBeVisible();
```

The duty-toggle button's accessible name is now plain `"Go On Duty"` — the
emoji was removed by the Wave 1 emoji ban (Task 13's `DutyBar.tsx`, gated by
`lint:ui`; see the self-review note in the task brief about `statusTone.ts`
being the one deliberate, flagged exception). This assertion was never in
the task-20 brief's list of "three stale assertions" to fix, and per the
task's explicit instruction ("do not adjust tests to reach a target"), it
was left as-is and is reported here rather than silently patched. It is a
fourth stale assertion in the same file, undiscovered until fixing the
third one let the test run further. `new-features.spec.ts:83` therefore
counts as failing both before and after this task, for two different
reasons.

Full breakdown, 12 original tests:
- Still green (5, unchanged): `example.spec.ts:3`, `example.spec.ts:10`,
  `new-features.spec.ts:63`, `pharmacy.spec.ts:4`,
  `provider-dispatch.spec.ts:75`
- Newly green (2): `provider-dispatch.spec.ts:48` (Phlebotomist),
  `provider-dispatch.spec.ts:63` (Nurse)
- Still red, unchanged, out of scope (4): `booking.spec.ts:4`,
  `booking.spec.ts:28`, `new-features.spec.ts:35`, `new-features.spec.ts:46`
- Still red, new failure line inside the same test (1):
  `new-features.spec.ts:83` (now fails at line 98, not line 94)

### New in Wave 1: `e2e/ui-wave1.spec.ts`

24 additional tests: screenshots (phlebotomist off-duty, phlebotomist
on-duty with active tasks, nurse, supervisor, `/dev/ui` × 3 viewports each),
an axe (WCAG2A/AA) pass and an emoji-in-chrome check per converted surface.
22 of 24 passed. The 2 failures are a real, reproducible `color-contrast`
finding (not a test-authoring artifact) — see `task-20-report.md` for full
detail:

- `.cm-spine__step--pending .cm-spine__label` (`StatusSpine`, used by
  `ActiveTaskPanel` on both the phlebotomist and nurse dashboards) renders
  the `--cm-ink-faint` token (`#94a3b8`) on white — a contrast ratio of
  2.56:1 against a required 4.5:1 for 14px text. This is a converted-surface
  finding (Tasks 12–15's `StatusSpine`/`ActiveTaskPanel` work), not an
  unconverted one. Task 20 is verification-only and does not fix it; it is
  flagged here for the reviewer.

`/dev/ui` requires a `next dev` server, not `next start` — the page calls
`notFound()` when `process.env.NODE_ENV === "production"`, which is dead-code
eliminated at build time and 404s under any production build regardless of
runtime env vars. Its 3 screenshots and its axe check were captured against
a `next dev` server on port 3000, then that server was stopped before
re-running the production-mode suite for the other three surfaces (which
render identically under `next dev` and `next start`). Running the whole
`ui-wave1.spec.ts` file against `next start` silently overwrites the
`/dev/ui` screenshots with 404-page captures with no test failure — this
was caught only because file sizes and timestamps were checked by hand
after the fact; it's not something the test suite itself would catch.
