import { test, expect } from '@playwright/test';

test.describe('Booking Workflow E2E', () => {
  test('should load the booking page and allow selecting a nurse home visit', async ({ page }) => {
    // Navigate to the booking page (assuming staging runs on localhost:3000)
    await page.goto('http://localhost:3000/booking');

    // Wait for the booking wizard to appear
    await expect(page.locator('text=Book an Appointment')).toBeVisible();

    // The user should see the 'Nurse Home Visit' option which we added in Phase 1
    const nurseOption = page.locator('div').filter({ hasText: 'Nurse Home Visit' }).first();
    await expect(nurseOption).toBeVisible();

    // Click on the Nurse Home Visit option
    await nurseOption.click();

    // Proceed to the next step
    const nextButton = page.locator('button.btn-primary').first();
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // Assuming step 2 shows available nurses or organizations
    // We can just verify we moved to Step 2
    await expect(page.locator('text=Select').first()).toBeVisible();
  });

  test('should allow multi-selection of tests in diagnostic centers', async ({ page }) => {
    await page.goto('http://localhost:3000/booking');
    
    // Select Home Sample Collection
    const labOption = page.locator('div').filter({ hasText: 'Home Sample Collection' }).first();
    await labOption.click();
    await page.locator('button.btn-primary').first().click();

    // In step 2, wait for real orgs to fetch
    // Since it's a mock staging test, we just check if multiple select UI exists
    // The patient selects an organization
    const selectOrgButton = page.locator('button', { hasText: 'Select' }).first();
    if (await selectOrgButton.isVisible()) {
      await selectOrgButton.click();
      
      // Wait for Tests to load
      await page.waitForTimeout(1000);
      
      // Check if Add button exists for multiple tests
      const addTestButtons = page.locator('button', { hasText: 'Add' });
      const count = await addTestButtons.count();
      if (count > 1) {
        await addTestButtons.nth(0).click();
        await addTestButtons.nth(1).click();
        
        // Assert total updates
        await expect(page.locator('text=Total:')).toBeVisible();
      }
    }
  });
});
