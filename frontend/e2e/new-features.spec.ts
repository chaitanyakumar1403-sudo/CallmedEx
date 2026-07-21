import { test, expect } from '@playwright/test';

// Helper to mock a logged-in provider (similar to provider-dispatch.spec.ts)
async function mockProviderLogin(page: any, role: string) {
  await page.route('**/api/auth/me', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'test-id',
          role: role,
          full_name: `Test ${role}`,
          is_online: false,
          phone: '1234567890',
          email: 'test@example.com'
        }
      })
    });
  });

  await page.addInitScript(({ token, role }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({
      id: 'test-id',
      role: role,
      full_name: `Test ${role}`,
    }));
  }, { token: 'fake-token', role });
}

test.describe('New Features E2E Tests', () => {

  test('1. Search Page - Should load location and search inputs', async ({ page }) => {
    await page.goto('http://localhost:3000/search');
    
    // Verify inputs are present
    await expect(page.getByPlaceholder('e.g. Apollo Hospitals')).toBeVisible();
    await expect(page.getByPlaceholder('City, District, or Pincode')).toBeVisible();
    
    // Verify the search button is present
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  });

  test('2. Smart Navbar - Provider should not see consumer links', async ({ page }) => {
    // Navigate without auth (should see consumer links)
    await page.goto('http://localhost:3000/');
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: 'Find Hospitals' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Pharmacy' })).toBeVisible();

    // Now mock login as a doctor
    await mockProviderLogin(page, 'doctor');
    await page.goto('http://localhost:3000/dashboard/doctor');

    // Should NOT see consumer links in the navbar
    const nav2 = page.getByRole('navigation');
    await expect(nav2.getByRole('link', { name: 'Find Hospitals' })).not.toBeVisible();
    await expect(nav2.getByRole('link', { name: 'Pharmacy' })).not.toBeVisible();
  });

  test('3. Signup - Should allow adding multiple documents for providers', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/signup');
    
    // Select Provider role (e.g. Doctor)
    await page.locator('.role-option', { hasText: 'Doctor' }).click();
    
    // Click Add Document button
    const addDocBtn = page.getByRole('button', { name: '+ Add Document' });
    await expect(addDocBtn).toBeVisible();
    
    // Initially no additional document sections
    await expect(page.getByPlaceholder('Document Name (e.g., PG Certificate)')).not.toBeVisible();
    
    // Click it
    await addDocBtn.click();
    
    // Now it should be visible
    await expect(page.getByPlaceholder('Document Name (e.g., PG Certificate)')).toBeVisible();
  });

  test('4. Phlebotomist Dashboard - Profile Tab and Selfie Modal', async ({ page }) => {
    await mockProviderLogin(page, 'phlebotomist');
    
    // Also mock tasks
    await page.route('**/api/dispatch/my-tasks', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: [] }) });
    });

    await page.goto('http://localhost:3000/dashboard/phlebotomist');
    
    // Should be on the Dispatch Tracking tab initially
    await expect(page.locator('h1', { hasText: 'Phlebotomist Hub' }).first()).toBeVisible();

    // Verify Selfie Modal triggers when clicking Go On Duty
    const onDutyBtn = page.getByRole('button', { name: '🟢 Go On Duty' });
    await expect(onDutyBtn).toBeVisible();
    await onDutyBtn.click();

    // Expect the modal to appear
    const modalHeading = page.locator('h3', { hasText: 'Pre-Duty Selfie Verification' });
    await expect(modalHeading).toBeVisible();
    
    // Cancel the modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(modalHeading).not.toBeVisible();

    // Check Profile Tab
    const profileTab = page.getByRole('button', { name: '👤 Profile Details' });
    await profileTab.click();
    
    // Ensure DashboardProfile is rendered
    await expect(page.locator('h3', { hasText: 'Registration & Service Profile' })).toBeVisible();
    await expect(page.locator('text=Test phlebotomist').first()).toBeVisible();
  });
});
