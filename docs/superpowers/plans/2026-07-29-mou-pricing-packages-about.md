# Plan: MOU scope cleanup, pricing & packages page, About rewrite + rebrand

## Context

CallMedex moved blood tests to a partner-blind, CallMedex-owned home-collection model. Diagnostic centers now provide **walk-in-only external services** (ECG, imaging, scans). Four artifacts must catch up:

1. The diagnostic-center MOU docx still lists blood tests in its Scope of Services.
2. `pricing_details/CALL MEDEX LAB MASTER DATA.xlsx` holds CallMedex's fixed blood-test prices (MRP vs OFFER PRICE) and 15 fixed health packages (PROFILES sheet) — these must be displayed to patients with MRP struck through → discount price.
3. Health packages currently render inside the patient dashboard (`OffersStrip`); they belong on the public marketing site as a top-nav page (navbar order per CLAUDE.md §2: About, **Health Packages**, Book a Test, Consultation, Pharmacy).
4. The About page is thin and names the wrong company — the firm is **xylarcAI**, not ZukoLabs.

## Global Constraints

- **Next.js 16.2.10** — `frontend/AGENTS.md` warns this is NOT the Next.js from training data. Before using any Next API beyond plain `'use client'` + `useState`/`useEffect`, read the relevant guide in `frontend/node_modules/next/dist/docs/`.
- **Do not add files to `frontend/ui-lint.config.json`.** `npm run lint:ui` currently fails on 25 PRE-EXISTING violations in `dashboard/phlebotomist/page.tsx` and `dashboard/nurse/page.tsx` — expected, not yours, do not fix them in this plan.
- Verification command for frontend tasks: `cd frontend && npx next build` must pass with 0 TypeScript errors (this skips lint:ui; unit tests via `npm run test:unit` must also pass).
- Backend verification: `cd backend && python -m pytest tests/ -q` (259 passing at baseline).
- Match existing page style: inline styles, `var(--color-*)` CSS vars, `.card`/`.section`/`.container`/`.chip` classes, emoji icons — same idiom as `frontend/src/app/(public)/diagnostics/page.tsx`.
- Do not touch: `frontend/src/app/(app)/dashboard/components/ProviderDispatchTracker.tsx` (user's uncommitted work), `openrouter_proxy.py`, `run-claude.ps1`, `ui errors/`, `.claude/`.
- The user already ran `database/provider_directory_district.sql` and `database/processing_center_area_districts.sql` in Supabase — do not re-run or modify them.

---

## Task 1: Remove blood tests from the diagnostic-center MOU docx

**File:** `mous/CALL MEDEX Diagnostic Services Agreement.docx` (edit in place, keep a backup copy at `mous/CALL MEDEX Diagnostic Services Agreement.backup.docx` before editing).

Use `python-docx` (installed on system Python). The document has 87 paragraphs and ONE table (45 rows × 5 cols: `✓ | Scope of Service | Regular Price | B2B Price | Offer Price`).

**Table — delete rows 1–24 inclusive** (these are blood/lab services, now CallMedex-owned home collection):
Routine Blood Tests, Complete Blood Count (CBC), Blood Sugar Tests, HbA1c, Lipid Profile, Liver Function Test (LFT), Kidney Function Test (KFT), Thyroid Profile, Vitamin D, Vitamin B12, Electrolytes, Cardiac Markers, Hormonal Assays, Tumor Markers, Coagulation Profile, Microbiology Tests, Serology Tests, Histopathology, Cytology, Clinical Pathology, Molecular Diagnostics, Genetic Testing, Allergy Testing, Home Blood Sample Collection.

**Keep rows 25–44** (walk-in-only external services): ECG, 2D Echo, TMT, Stress Echo, Holter Monitoring, Ambulatory BP Monitoring, X-Ray, Ultrasound, Colour Doppler, TIFFA Scan, NT Scan, Anomaly Scan, Mammography, Bone Mineral Density (BMD), Pulmonary Function Test (PFT), Audiometry, CT Scan, MRI Scan, PET-CT, Other Services. After deletion the table must have 21 rows (1 header + 20 service rows).

Row deletion with python-docx: `tbl._tbl.remove(row._tr)`.

**Clause edits (paragraphs):**
- Clause 12 "Home Collection Services" (paragraph index 39 heading + index 40 body: "Where applicable, the Diagnostic Center shall provide trained phlebotomists and home collection services…") — **delete both paragraphs**. Diagnostic centers are walk-in-only now.
- Renumber the following clauses so numbering stays sequential: old 13→12, 14→13, 15→14, 16→15, 17→16, 18→17, 19→18, 20→19. The headings are paragraphs of the form `N. Title` (e.g. "13. Responsibilities of the Diagnostic Center") — edit the run text preserving formatting (edit `paragraph.runs[0].text` if the number is in the first run; otherwise rebuild the paragraph text keeping its style).
- Clause 4 "Slot Management" body (paragraph index 10) contains "home collection slots, emergency services" — remove the phrase "home collection slots, " so it reads "appointment slots, emergency services, and …" (verify exact wording by reading the paragraph first).

**Verify:** re-open the saved docx; assert table has 21 rows; assert none of the 24 removed names appear anywhere in table or paragraphs; assert clause headings run 1..19 sequentially with no gap; print the final clause list and table rows as evidence.

---

## Task 2: Extract pricing data from xlsx to frontend JSON

**Source:** `pricing_details/CALL MEDEX LAB MASTER DATA.xlsx` (use `openpyxl`, system Python has it).

Sheet `LAB TEST` (488 data rows): columns `Sr. | Test | Test Price | OFFER PRICE`.
Sheet `PROFILES` (15 data rows): columns `S No | PACKAGE NAME | TEST DETAILS | MRP | HOME`.

**Write a throwaway extraction script** (run it, do not commit it — commit only its outputs) that produces:

1. `frontend/src/data/lab-test-prices.json` — array of `{ "name": string, "mrp": number, "price": number }`, one per LAB TEST row. Trim whitespace from names. Skip rows with empty test name or non-numeric prices. Prices as numbers (not strings).
2. `frontend/src/data/health-packages.json` — array of `{ "id": "pkg-<snake_case_name>", "name": string, "tests": string, "mrp": number, "price": number }`, one per PROFILES row (`price` = the HOME column value). Title-case the package names for display (e.g. "Basic Screening (Non Diabetic)") but keep test details verbatim.

**Verify:** lab-test-prices.json has ≥ 480 entries; health-packages.json has exactly 15; spot-check 3 known values: "25 Hydroxy Vitamin D" mrp 1600 price 1280; "BASIC SCREENING (NON DIABETIC)" mrp 1250 price 599; "FEVER PROFILE - COMPLETE" mrp 2050 price 1300. Print entry counts and the spot checks as evidence.

---

## Task 3: Public Health Packages page + navbar + dashboard removal + booking wiring

Depends on Task 2's data files.

### 3a. NEW page `frontend/src/app/(public)/packages/page.tsx`

`'use client'` page, styled like `frontend/src/app/(public)/diagnostics/page.tsx` (same `.section`/`.container`/`.card` idiom, inline styles, `inr()` helper with `toLocaleString("en-IN")`).

**Section 1 — Health Packages (the fixed 15):** heading "Health Packages — fixed CallMedex rates, home collection included". Grid of cards (`grid-3`), each showing: package name, test details (small muted text), price block with **MRP struck through → HOME price in bold + a "Save ₹X (Y% off)" pill**, and a Book button linking to `/booking?type=lab&package=<encodeURIComponent(name)>&price=<price>`.

**Section 2 — Lab Test Price List (all ~488):** heading "Individual Lab Tests — CallMedex rates". A search input filtering by test name (client-side, case-insensitive). Render as a clean table/list: test name left, price block right (MRP struck through, offer price bold, savings % pill). Cap initial render at 50 rows with a "Show all N tests" toggle; when searching, show all matches. Each row links/CTA to `/booking?type=lab` (generic lab flow).

Savings % = `Math.round((1 - price/mrp) * 100)`; guard mrp > 0.

### 3b. Navbar — `frontend/src/app/components/SmartNavbar.tsx`

Add `<li><a href="/packages">Health Packages</a></li>` immediately after the About `<li>` (line ~50), before Book a Test. (CLAUDE.md §2 reference navbar order: About, Health Packages, Diagnostics, Consultation, Pharmacy.)

### 3c. Remove packages from patient dashboard — `frontend/src/app/(app)/dashboard/patient/page.tsx`

Remove the `OffersStrip` import (line 7) and its usage `<OffersStrip city={profile?.city} />` (line 536). Delete `frontend/src/app/(app)/dashboard/components/OffersStrip.tsx` (no other references — verified).

### 3d. Wire package deep-link in booking — `frontend/src/app/(app)/booking/page.tsx`

`packageParam` is already read (line 63) but unused. Wire it:
- In the "Pre-select booking type" effect: if `packageParam` and no `typeParam`/`orgParam`/`serviceParam`, set `bookingType` to `"lab"` and `step` to 2.
- Read a `price` param (`searchParams.get("price")`).
- When `packageParam` is present, show a small info banner in step 2: "Booking package: {name} — fixed CallMedex rate ₹{price}".
- In `handleConfirm`'s lab branch, when `packageParam` is present: set `notes` to `Package: <name>` and `total_price` to `Number(priceParam) || 0` (overriding the testNotes/total for that branch), and still pass `city`/`district`/`home` as already wired (`home: true` for packages — they are home-collection packages; use `home: packageParam ? true : modeParam === "home"`).

**Verify:** `npx next build` 0 errors; `npm run test:unit` passes; `grep -r OffersStrip frontend/src` returns nothing.

---

## Task 4: Rewrite About page + rebrand ZukoLabs → xylarcAI

**File:** `frontend/src/app/(public)/about/page.tsx` (full rewrite, server component — no interactivity needed; keep `.section`/`.container`/`.card` idiom).

The current page is 63 lines, one mission paragraph, 4 feature cards, compliance badges, and says "built by ZukoLabs" (line 7).

**Rewrite to a richer, picture-perfect company page.** Required content (use these facts, from CLAUDE.md — do not invent metrics):

- Hero: "About CallMedex" — India's most advanced AI-native healthcare orchestration platform, built by **xylarcAI** (a technology firm from Visakhapatnam). ZukoLabs must not appear anywhere.
- "What we do" section — the services, one card each with icon + 1-2 line description: 🏠 Home Sample Collection (doorstep phlebotomy with live Uber-style tracking & chain-of-custody), 🧪 Diagnostics & Imaging (lab tests & scans at transparent CallMedex rates — home collection or verified walk-in centres), 📹 Video Consultation (verified doctors, AI-generated e-prescriptions with generic names per NMC 2026), 💊 Pharmacy Delivery (nearest registered pharmacy fulfils), 📦 Health Packages (fixed-rate full-body & condition-specific packages with home collection), 🚑 Real-time Dispatch (nearest on-duty phlebotomist, live ETA).
- "Why we're different" section: ABHA-first (ABDM-integrated health records from day one), WhatsApp-native (book/reports/reminders without an app), AI-native (report interpretation, multilingual support, fraud/quality scoring), Tier 2/3 focus (built in Vizag for Bharat).
- "Our mission" — connect fragmented healthcare supply (doctors, diagnostic centres, pharmacies, phlebotomists, hospitals) to patient demand through one AI-orchestrated platform, starting where healthcare access is most fragmented.
- Compliance & Trust badges (keep existing): DPDP Act 2023, ABDM/ABHA, FHIR R4, NMC 2026 Compliant, NHCX Ready.
- Company footer line: "CallMedex is built and operated by xylarcAI, Visakhapatnam, Andhra Pradesh."

Tone: confident, plain, patient-first; no invented statistics (no "1 lakh patients" etc.). Typography/layout consistent with the rest of the site.

**Verify:** `npx next build` 0 errors; `grep -ri zukolabs frontend/src/app/(public)/about` returns nothing.
