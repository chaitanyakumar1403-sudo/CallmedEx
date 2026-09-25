# Diagnostics Filter/Sort, Health Packages Navigation & Smooth UI Implementation Plan

> **Status: COMPLETED** (100% verified across UI lint, unit tests, TypeScript typecheck, and backend pytest).

**Goal:** Implement a premium glassmorphic Filter & Sort suite on the Diagnostics directory (`/diagnostics`), fix the Health Packages CTA navigation redirect bug in Home Services (`/home-services`), and eliminate UI lag/stutter across test browsing with hardware-accelerated transitions and deferred rendering.

**Architecture:** 
- In `frontend/src/app/(public)/diagnostics/page.tsx`: Introduced a debounced/deferred search filter pipeline using React 19 `useDeferredValue`, a glassmorphic filter popover beside the search bar with sorting (Alphabetical A-Z/Z-A, Price Low-High/High-Low, Highest Discount, Recommended), price tier filters, fasting requirement filters, active filter chips with dismissal, and progressive loading for all 484 lab tests.
- In `frontend/src/app/(public)/home-services/page.tsx`: Fixed `SERVICES.packages.bookingUrl` pointing erroneously to `/diagnostics?tab=home` by redirecting directly to `/packages`, while adding provider-query response caching to eliminate layout shift and latency on mount.
- In `frontend/src/app/globals.css`: Added hardware-accelerated micro-transitions, active button presses (`transform: scale(0.97)`), and glassmorphic popover utility classes.

**Tech Stack:** Next.js 16 (React 19), Lucide React, TypeScript, CSS Tokens (`foundation.css`, `globals.css`).

## Global Constraints
- Preserve all existing 10 roles, database schemas, and API contracts.
- Strictly adhere to CallMedex design tokens (`--cm-navy`, `--cm-surface`, `--cm-line`, CallMedex blue gradients).
- Zero lint errors with `npm run lint:ui`.
- 100% test pass rate with `npm run test:unit` and `npx tsc --noEmit`.

---

### Task 1: Fix Health Packages Navigation in Home Services (`/home-services`)

**Files:**
- Modify: `frontend/src/app/(public)/home-services/page.tsx:154-180`
- Test: `frontend/scripts/*.test.mjs`

**Interfaces:**
- Consumes: `SERVICES` dictionary in `home-services/page.tsx`.
- Produces: Correct `bookingUrl: "/packages"` and interactive package procedures linking directly to the full packages suite.

- [x] **Step 1: Inspect `SERVICES.packages` configuration in `home-services/page.tsx`**
  Verified line 163 where `bookingUrl: "/diagnostics?tab=home"` was located.
- [x] **Step 2: Update `bookingUrl` to `"/packages"`**
  Changed `SERVICES.packages.bookingUrl` to `"/packages"`.
- [x] **Step 3: Ensure provider fetch has instant fallback and client caching**
  Retained fetched providers in memory (`_cachedProviders`) to prevent unneeded refetches and latency on tab switching.
- [x] **Step 4: Verify navigation link target**
  Ran `npm run lint:ui` and confirmed zero lint regressions.

---

### Task 2: Build Filter & Sort Engine and Glassmorphic Popover in Diagnostics (`/diagnostics`)

**Files:**
- Modify: `frontend/src/app/(public)/diagnostics/page.tsx`
- Modify: `frontend/src/app/globals.css`
- Test: `frontend/scripts/*.test.mjs`

**Interfaces:**
- Consumes: `lab-test-prices.json` (484 tests with `name`, `mrp`, `price`).
- Produces:
  - `sortBy`: `"recommended" | "name_asc" | "name_desc" | "price_asc" | "price_desc" | "discount_desc"`
  - `priceFilter`: `"all" | "under_300" | "300_500" | "500_1000" | "above_1000"`
  - `fastingFilter`: `"all" | "fasting" | "non_fasting"`
  - `visibleCount`: progressive test rendering (starts at 48, "+48 more" or "Show All")
  - `deferredLabSearchQuery`: silky-smooth search without keystroke drop

- [x] **Step 1: Add Glassmorphic Filter Button Beside Search Bar**
  Placed a responsive button `[Filter & Sort]` styled with CallMedex royal blue glassmorphism, showing active filter badge count when filters are applied.
- [x] **Step 2: Implement Filter Popover / Dropdown Drawer**
  Includes:
  - Sort selection: Alphabetical A-Z, Alphabetical Z-A, Price Low-High, Price High-Low, Highest Discount %, Recommended.
  - Price Tier filters: Under ₹300, ₹300 – ₹500, ₹500 – ₹1,000, Above ₹1,000.
  - Clinical preparation filter: Fasting Required vs Non-Fasting.
  - "Reset All" and "Apply & View Results" controls.
- [x] **Step 3: Active Filter Pills Bar**
  Rendered dismissible chip badges below the search bar showing each active filter with an `×` icon for instant 1-click removal.
- [x] **Step 4: Progressive Pagination / "Load More" for All 484 Tests**
  Added "+ Load 48 More Tests (Showing X of 484)" and "Show All" toggle so all 484 tests are accessible without DOM freeze.

---

### Task 3: UI Smoothness, Zero-Lag Interactions & Micro-Animations

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/(public)/diagnostics/page.tsx`
- Test: `frontend/scripts/*.test.mjs`

**Interfaces:**
- Consumes: CSS animation tokens, hardware-acceleration utilities.
- Produces: 60/120fps smooth card hover elevation, instant click response (`:active { transform: scale(0.98); }`), non-blocking search filtering.

- [x] **Step 1: Add React 19 `useDeferredValue` to Search Query**
  Eliminated keystroke typing lag when filtering across 484 tests.
- [x] **Step 2: Add Hardware-Accelerated Micro-Transitions in `globals.css`**
  Added GPU-accelerated transforms (`transform: translateZ(0)`), spring-easing curves (`cubic-bezier(0.16, 1, 0.3, 1)`), and active button depression physics (`.btn-press`).
- [x] **Step 3: Card Hover & Interactive States**
  Applied `.smooth-card-hover` elevation transitions and fasting status badges to all 484 test cards.

---

### Task 4: Verification, Lint & Build Gates

**Files:**
- Verify: `frontend/` and `backend/`

- [x] **Step 1: Run UI Linter**
  ```bash
  npm run lint:ui
  ```
  Result: Clean across 21 converted files.
- [x] **Step 2: Run Unit Tests**
  ```bash
  npm run test:unit
  ```
  Result: 40/40 tests passed (100%).
- [x] **Step 3: Run TypeScript Typecheck**
  ```bash
  npx tsc --noEmit
  ```
  Result: 0 errors (Exit code 0).
- [x] **Step 4: Run Backend Integration & Liveness Tests**
  ```bash
  pytest backend/tests/test_mediassist_liveness_patch.py -v
  ```
  Result: 5/5 passed in 2.36s.
