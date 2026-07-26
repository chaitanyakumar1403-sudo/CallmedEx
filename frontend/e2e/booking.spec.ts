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

  test('should allow multi-selection of tests in the partner-blind lab flow', async ({ page }) => {
    // Partner-blind diagnostics booking: the lab/diagnostics flow no longer
    // lets the patient pick a centre (see CLAUDE.md — "partner-blind
    // diagnostics booking is the product's core positioning"), so there is no
    // organization-search step to mock here any more. Selecting "Lab Test /
    // Diagnostics" now goes straight to "Choose Your Tests".
    await page.goto('http://localhost:3000/booking');

    await page.getByText('Lab Test / Diagnostics', { exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Choose Your Tests' })).toBeVisible();
    await expect(page.getByText('Select Registered Diagnostic Center')).toHaveCount(0);

    // Tests are selected by clicking the row itself — there is no per-test
    // "Add" button in the current design. Select two of the default tests and
    // confirm the running total reflects both.
    await expect(page.getByText('Complete Blood Count (CBC)', { exact: true })).toBeVisible();
    await page.getByText('Complete Blood Count (CBC)', { exact: true }).click();
    await page.getByText('Lipid Profile (Cholesterol)', { exact: true }).click();

    await expect(page.getByText('Selected 2 Item(s)')).toBeVisible();
    await expect(page.getByText('₹650', { exact: true })).toBeVisible();
  });

  test('should still show the clinic list for the doctor appointment flow', async ({ page }) => {
    // The doctor/clinic flow is deliberately partner-visible — the patient
    // physically attends a named clinic, so it must keep its centre-selection
    // step. This guards against the lab-flow change above accidentally
    // removing it.
    await page.route('**/api/providers/search/organizations*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          organizations: [
            { id: 'org-1', organization_name: 'Test Clinic', organization_type: 'clinic', city: 'Visakhapatnam', doctors_count: 2, services_count: 0 },
          ],
        }),
      });
    });

    await page.goto('http://localhost:3000/booking');

    await page.getByText('Doctor Appointment', { exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Find a Clinic, Polyclinic or Hospital' })).toBeVisible();
    await expect(page.getByText('Test Clinic')).toBeVisible();
    await page.getByText('Test Clinic').click();
    await expect(page.getByRole('button', { name: 'Continue to Test / Service Selection →' })).toBeEnabled();
  });
});
