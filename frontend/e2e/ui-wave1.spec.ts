import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Wave 1 review-checkpoint spec.
 *
 * Two jobs:
 *  1. Capture full-page screenshots of the three converted provider
 *     dashboards (phlebotomist off-duty AND on-duty with active tasks,
 *     nurse, supervisor) plus the /dev/ui primitive gallery, at three
 *     viewports, with realistic mocked data — not empty states.
 *  2. Run an axe (WCAG2A/AA) pass and an emoji-in-chrome check against
 *     each converted surface.
 *
 * /dev/ui calls `notFound()` when `process.env.NODE_ENV === "production"`
 * (see src/app/(app)/dev/ui/page.tsx). That check is inlined and dead-code
 * eliminated at build time, so it 404s under `next start` no matter what —
 * this spec must be run against `next dev` (see task-20-report.md for the
 * exact command used) for the dev-ui screenshots to succeed. The other
 * four surfaces render fine under either.
 */

const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "768", width: 768, height: 1024 },
  { label: "1440", width: 1440, height: 900 },
];

const CHROME_SELECTOR = ".cm-appbar, .cm-dash__head, .cm-dash__tabs, .cm-stat";

function ago(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const PHLEBO_TASKS_ONDUTY = [
  {
    id: "d-1001",
    patient_address: "12-3-45 MVP Colony, Visakhapatnam",
    patient_lat: 17.7326, patient_lng: 83.3332,
    status: "en_route",
    service_type: "home_collection",
    estimated_distance_km: 2.3,
    notes: "Fasting blood sugar — patient asked for an early-morning slot.",
    created_at: ago(18),
    priority: "urgent",
  },
  {
    id: "d-1002",
    patient_address: "Dwaraka Nagar, Visakhapatnam",
    patient_lat: 17.7231, patient_lng: 83.3103,
    status: "pending",
    service_type: "home_collection",
    estimated_distance_km: 4.1,
    notes: "Thyroid panel, 3 tubes.",
    created_at: ago(6),
    priority: "urgent",
  },
  {
    id: "d-1003",
    patient_address: "Seethammadhara, Visakhapatnam",
    patient_lat: 17.7401, patient_lng: 83.3212,
    status: "pending",
    service_type: "home_collection",
    estimated_distance_km: 5.6,
    created_at: ago(3),
    priority: "normal",
  },
  {
    id: "d-0996",
    patient_address: "Gajuwaka, Visakhapatnam",
    patient_lat: 17.68, patient_lng: 83.20,
    status: "completed",
    service_type: "home_collection",
    estimated_distance_km: 7.2,
    created_at: ago(120),
    priority: "normal",
  },
  {
    id: "d-0995",
    patient_address: "Pendurthi, Visakhapatnam",
    patient_lat: 17.83, patient_lng: 83.24,
    status: "completed",
    service_type: "home_collection",
    estimated_distance_km: 9.0,
    created_at: ago(200),
    priority: "normal",
  },
];

const PHLEBO_TASKS_OFFDUTY = [
  {
    id: "d-0990",
    patient_address: "Gajuwaka, Visakhapatnam",
    patient_lat: 17.68, patient_lng: 83.20,
    status: "completed",
    service_type: "home_collection",
    estimated_distance_km: 7.2,
    created_at: ago(600),
    priority: "normal",
  },
  {
    id: "d-0991",
    patient_address: "Pendurthi, Visakhapatnam",
    patient_lat: 17.83, patient_lng: 83.24,
    status: "completed",
    service_type: "home_collection",
    estimated_distance_km: 9.0,
    created_at: ago(650),
    priority: "normal",
  },
];

const NURSE_TASKS = [
  {
    id: "n-2001",
    patient_address: "Siripuram, Visakhapatnam",
    patient_lat: 17.72, patient_lng: 83.31,
    status: "in_progress",
    service_type: "home_nursing_visit",
    estimated_distance_km: 1.8,
    notes: "Post-op dressing change, day 3.",
    created_at: ago(40),
    priority: "urgent",
  },
  {
    id: "n-2002",
    patient_address: "Old Gajuwaka, Visakhapatnam",
    patient_lat: 17.69, patient_lng: 83.21,
    status: "pending",
    service_type: "home_nursing_visit",
    estimated_distance_km: 6.4,
    notes: "Catheter care follow-up.",
    created_at: ago(10),
    priority: "normal",
  },
  {
    id: "n-1994",
    patient_address: "Madhurawada, Visakhapatnam",
    patient_lat: 17.81, patient_lng: 83.35,
    status: "completed",
    service_type: "home_nursing_visit",
    estimated_distance_km: 3.0,
    created_at: ago(300),
    priority: "normal",
  },
];

const SUPERVISOR_VERIFICATIONS = [
  { role: "doctor", user: { full_name: "Dr. Ramesh Varma" }, data: { medical_license_number: "AP-MCI-88213" } },
  { role: "pharmacy", user: { full_name: "Sri Lakshmi Pharmacy" }, data: { drug_license_number: "DL-20-AP-4471" } },
  { role: "phlebotomist", user: { full_name: "K. Bhavani" }, data: { certification_number: "DMLT-2024-1187" } },
];

async function mockDispatchBackend(
  page: Page,
  opts: { role: string; isOnline: boolean; tasks: unknown[] }
) {
  await page.route("**/api/**", (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    if (url.includes("/api/auth/me")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          data: { role: opts.role, is_online: opts.isOnline, full_name: `Test ${opts.role}` },
        }),
      });
    }
    if (url.includes("/api/dispatch/my-tasks")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: CORS_HEADERS,
        body: JSON.stringify({ tasks: opts.tasks }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, data: [], dispatches: [], tasks: [], offers: [], bookings: [] }),
    });
  });

  await page.addInitScript((role: string) => {
    window.localStorage.setItem("token", "mock_token");
    window.localStorage.setItem("user", JSON.stringify({ role, full_name: `Test ${role}` }));
  }, opts.role);
}

async function mockSupervisorBackend(page: Page) {
  await page.route("**/api/**", (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    if (url.includes("/api/admin/metrics")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: CORS_HEADERS,
        body: JSON.stringify({
          metrics: { total_users: 4213, total_bookings: 1897 },
          city_scope: "Visakhapatnam",
        }),
      });
    }
    if (url.includes("/api/admin/verifications")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: CORS_HEADERS,
        body: JSON.stringify({ verifications: SUPERVISOR_VERIFICATIONS }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("token", "mock_token");
    window.localStorage.setItem("user", JSON.stringify({ role: "admin", full_name: "Test Supervisor" }));
  });
}

const SURFACES: {
  name: string;
  path: string;
  setup: (page: Page) => Promise<void>;
}[] = [
  {
    name: "phlebotomist-offduty",
    path: "/dashboard/phlebotomist",
    setup: (page) => mockDispatchBackend(page, { role: "phlebotomist", isOnline: false, tasks: PHLEBO_TASKS_OFFDUTY }),
  },
  {
    name: "phlebotomist-onduty",
    path: "/dashboard/phlebotomist",
    setup: (page) => mockDispatchBackend(page, { role: "phlebotomist", isOnline: true, tasks: PHLEBO_TASKS_ONDUTY }),
  },
  {
    name: "nurse",
    path: "/dashboard/nurse",
    setup: (page) => mockDispatchBackend(page, { role: "nurse", isOnline: true, tasks: NURSE_TASKS }),
  },
  {
    name: "supervisor",
    path: "/dashboard/supervisor",
    setup: (page) => mockSupervisorBackend(page),
  },
];

for (const s of SURFACES) {
  for (const v of VIEWPORTS) {
    test(`screenshot: ${s.name} @ ${v.label}`, async ({ page }) => {
      await page.setViewportSize({ width: v.width, height: v.height });
      await s.setup(page);
      await page.goto(`http://localhost:3000${s.path}`);
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: `test-results/wave1/${s.name}-${v.label}.png`,
        fullPage: true,
      });
    });
  }

  test(`a11y: ${s.name} has no serious/critical WCAG2A/AA violations`, async ({ page }) => {
    await s.setup(page);
    await page.goto(`http://localhost:3000${s.path}`);
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test(`chrome: ${s.name} has no emoji in chrome`, async ({ page }) => {
    await s.setup(page);
    await page.goto(`http://localhost:3000${s.path}`);
    await page.waitForLoadState("networkidle");
    const text = await page.locator(CHROME_SELECTOR).allInnerTexts();
    // Range must match lint-ui.mjs's emoji rule exactly (U+2300–23FF and
    // U+2B00–2BFF included) — an earlier version of this assertion omitted
    // both blocks and let a ⏸/⏰/⌛ in chrome pass this check silently.
    expect(text.join(" ")).not.toMatch(
      /[\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{1F000}-\u{1FAFF}]/u
    );
  });
}

// /dev/ui — the primitive gallery. Dev-only (see file header comment above);
// only produces real screenshots when this spec is run against `next dev`.
for (const v of VIEWPORTS) {
  test(`screenshot: dev-ui @ ${v.label}`, async ({ page }) => {
    await page.setViewportSize({ width: v.width, height: v.height });
    await page.goto("http://localhost:3000/dev/ui");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `test-results/wave1/dev-ui-${v.label}.png`,
      fullPage: true,
    });
  });
}

test("a11y: dev-ui has no serious/critical WCAG2A/AA violations", async ({ page }) => {
  await page.goto("http://localhost:3000/dev/ui");
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(violations, null, 2)).toEqual([]);
});

// ─── Modal focus-stealing regression (chain-of-custody data integrity) ─────
//
// LabHandoverModal and VitalsModal are controlled by state living in
// ProviderDispatchTracker (sampleBarcodes, labNotes, vitals, ...). Every
// call site passes Modal an inline arrow for onClose, so onClose gets a new
// identity on every parent render. If Modal's focus-management effect
// depends on `onClose`, it tears down and re-runs on every keystroke (each
// keystroke re-renders the parent), re-running the initial-focus line and
// yanking focus back to the close button after a single character. A
// phlebotomist typing a sample barcode, or a nurse typing a BP reading,
// would only ever get the first character in — the rest lands on a button
// that ignores keystrokes. This must be caught with real typing (not a
// single keypress), because a single character reproduces nothing: the
// effect only re-runs on the SECOND render, i.e. the second character.
test("modal fields keep full typed value and focus (phlebotomist lab handover)", async ({ page }) => {
  const inProgressTask = {
    id: "d-in-progress-1",
    patient_address: "Test Address, Visakhapatnam",
    patient_lat: 17.7, patient_lng: 83.3,
    status: "in_progress",
    service_type: "home_collection",
    estimated_distance_km: 1.0,
    created_at: ago(15),
    priority: "normal",
  };
  await mockDispatchBackend(page, { role: "phlebotomist", isOnline: true, tasks: [inProgressTask] });
  await page.goto("http://localhost:3000/dashboard/phlebotomist");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /Sample Handover to Lab Hub/i }).click();
  const barcodeInput = page.getByLabel("Sample barcode IDs / tube numbers");
  await barcodeInput.click();
  await barcodeInput.pressSequentially("BAR-98231", { delay: 30 });
  await expect(barcodeInput).toHaveValue("BAR-98231");
  await expect(barcodeInput).toBeFocused();
});

test("modal fields keep full typed value and focus (nurse vitals)", async ({ page }) => {
  const inProgressTask = {
    id: "n-in-progress-1",
    patient_address: "Test Address, Visakhapatnam",
    patient_lat: 17.7, patient_lng: 83.3,
    status: "in_progress",
    service_type: "home_nursing_visit",
    estimated_distance_km: 1.0,
    created_at: ago(15),
    priority: "normal",
  };
  await mockDispatchBackend(page, { role: "nurse", isOnline: true, tasks: [inProgressTask] });
  await page.goto("http://localhost:3000/dashboard/nurse");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /Upload Vitals & Clinical Note/i }).click();
  const bpInput = page.getByLabel("Blood pressure (mmHg)");
  // The field is pre-filled with a default reading ("120/80"); select it all
  // so typing replaces it instead of appending to it.
  await bpInput.click({ clickCount: 3 });
  await bpInput.pressSequentially("118/76", { delay: 30 });
  await expect(bpInput).toHaveValue("118/76");
  await expect(bpInput).toBeFocused();
});

/**
 * The live dispatch API can return a task carrying little more than an id and a
 * status. Three components called `.replace()` on `service_type` directly, which
 * threw and took the whole dashboard down behind an error boundary in
 * production — while every mocked test passed, because the fixtures always
 * supplied the field. Renders with a deliberately sparse task.
 */
test("dashboard survives a dispatch task missing optional fields", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.addInitScript(() => {
    localStorage.setItem("token", "t");
    localStorage.setItem("user", JSON.stringify({ role: "phlebotomist" }));
  });
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    const body = url.includes("/api/auth/me")
      ? { success: true, data: { role: "phlebotomist", full_name: "R", is_online: true } }
      : url.includes("my-tasks")
        ? { tasks: [{ id: "1", status: "provider_accepted" }] }
        : { success: true };
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("http://localhost:3000/dashboard/phlebotomist");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("h1", { hasText: "Field Collection" })).toBeVisible();
  await expect(page.getByText("This page couldn’t load")).toHaveCount(0);
  expect(errors, errors.join(" | ")).toEqual([]);
});
