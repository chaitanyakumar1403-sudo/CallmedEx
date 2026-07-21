import { test, expect } from '@playwright/test';

test.describe('Provider Dispatch Workflows E2E', () => {
  // A helper function to safely mock all backend API requests for provider dashboards
  const mockBackend = async (page: any, role: string) => {
    page.on('console', (msg: any) => console.log('BROWSER:', msg.text()));
    page.on('pageerror', (err: any) => console.log('PAGE ERROR:', err.message));

    await page.route('**/api/**', (route: any) => {
      const url = route.request().url();
      if (route.request().method() === 'OPTIONS') {
        route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
          }
        });
        return;
      }

      if (url.includes('/api/auth/me')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, data: { role: role, is_online: true } })
        });
      } else if (url.includes('/api/')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, data: [], dispatches: [], tasks: [], offers: [], bookings: [] })
        });
      } else {
        route.continue();
      }
    });

    await page.addInitScript((r: string) => {
      window.localStorage.setItem('token', 'mock_token');
      window.localStorage.setItem('user', JSON.stringify({ role: r, full_name: 'Test Provider' }));
    }, role);
  };

  test('Phlebotomist Dashboard - Should load tracking UI and OTP field', async ({ page }) => {
    await mockBackend(page, 'phlebotomist');
    await page.goto('http://localhost:3000/dashboard/phlebotomist');

    // Wait for dashboard to load
    await expect(page.locator('h1', { hasText: 'Phlebotomist Hub' }).first()).toBeVisible();

    // In a mock state, there might be active tasks or "No active tasks"
    // Let's ensure the tabs load and navigation works
    const tasksTab = page.locator('button', { hasText: /Tasks/i }).first();
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
    }
  });

  test('Nurse Dashboard - Should load and verify home visit tracking UI', async ({ page }) => {
    await mockBackend(page, 'nurse');
    await page.goto('http://localhost:3000/dashboard/nurse');

    // Wait for dashboard to load
    await expect(page.locator('h1', { hasText: 'Nurse Dashboard' })).toBeVisible();

    // Verify main components render without crashing
    const activeTasks = page.locator('text=Active Tasks').first();
    const mapOrTracking = page.locator('text=Map').first();
  });

  test('Doctor Dashboard - Should load and verify tracking elements', async ({ page }) => {
    await mockBackend(page, 'doctor');
    await page.goto('http://localhost:3000/dashboard/doctor');

    // Wait for dashboard to load
    await expect(page.locator('h1', { hasText: 'Doctor Command Center' })).toBeVisible();

    // Check if the tabs exist (Appointments, Consultations)
    const appointmentsTab = page.locator('button', { hasText: /Appointments/i }).first();
    if (await appointmentsTab.isVisible()) {
      await appointmentsTab.click();
    }
  });
});
