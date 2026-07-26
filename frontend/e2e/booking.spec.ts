import { test, expect } from '@playwright/test';

test.describe('Booking Workflow E2E', () => {
  test('should load the booking page and allow selecting a nurse home visit', async ({ page }) => {
    // Navigate to the booking page (assuming staging runs on localhost:3000)
    await page.goto('http://localhost:3000/booking');

    // Wait for the booking wizard to appear
    await expect(page.locator('text=Book an Appointment')).toBeVisible();

    // The user should see the 'Nurse Home Visit' option which we added in Phase 1.
    // A bare `div` + hasText locator also matches every ancestor wrapping the
    // card (the grid, the step-1 card, the page container), so `.first()`
    // resolved to the outermost of those rather than the clickable option —
    // clicking it landed outside any card and never advanced the wizard.
    // The label text itself is unique and exact, and a click on it bubbles up
    // to the card's own onClick.
    const nurseOption = page.getByText('Nurse Home Visit', { exact: true });
    await expect(nurseOption).toBeVisible();

    // Click on the Nurse Home Visit option. Selecting it now advances the
    // wizard directly to step 2 — there is no separate "Continue" button on
    // step 1 in the current flow.
    await nurseOption.click();

    // Step 2 for a nurse visit asks for the patient's address.
    await expect(page.getByRole('heading', { name: 'Enter Patient Location for Nurse Home Visit' })).toBeVisible();
  });

  test('should allow multi-selection of tests in diagnostic centers', async ({ page }) => {
    // The current flow fetches registered organizations and, per-org, their
    // service catalog from the backend before tests can be selected — mock
    // both so the multi-select UI is reachable without a live API server.
    await page.route('**/api/providers/search/organizations*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          organizations: [
            { id: 'org-1', organization_name: 'Test Diagnostic Center', organization_type: 'diagnostic', city: 'Visakhapatnam', doctors_count: 0, services_count: 2 },
          ],
        }),
      });
    });
    await page.route('**/api/bookings/org-services/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            services: [
              { name: 'Test A', price: 100, description: 'A' },
              { name: 'Test B', price: 200, description: 'B' },
            ],
            packages: [],
            doctors: [],
            timings: [],
          },
        }),
      });
    });

    await page.goto('http://localhost:3000/booking');

    // Select "Lab Test / Diagnostics" — the flow that actually routes through
    // a registered diagnostic center, matching this test's intent.
    await page.getByText('Lab Test / Diagnostics', { exact: true }).click();

    // Step 2: pick the (mocked) registered organization, then continue.
    await expect(page.getByText('Test Diagnostic Center')).toBeVisible();
    await page.getByText('Test Diagnostic Center').click();
    await page.getByRole('button', { name: 'Continue to Test / Service Selection →' }).click();

    // Step 3: tests are selected by clicking the row itself — there is no
    // per-test "Add" button in the current design. Select two tests and
    // confirm the running total reflects both.
    await expect(page.getByText('Test A', { exact: true })).toBeVisible();
    await page.getByText('Test A', { exact: true }).click();
    await page.getByText('Test B', { exact: true }).click();

    await expect(page.getByText('Selected 2 Item(s)')).toBeVisible();
    await expect(page.getByText('₹300', { exact: true })).toBeVisible();
  });
});
