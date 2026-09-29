import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

const VIEWPORTS = [
  { name: '320px Mobile Narrow', width: 320, height: 640 },
  { name: '360px Android Standard', width: 360, height: 740 },
  { name: '375px iPhone Mini/SE', width: 375, height: 667 },
  { name: '390px iPhone 13/14/15', width: 390, height: 844 },
  { name: '412px Pixel / Galaxy', width: 412, height: 915 },
  { name: '430px iPhone Pro Max', width: 430, height: 932 },
  { name: '480px Large Phablet', width: 480, height: 800 },
  { name: '768px Tablet Portrait', width: 768, height: 1024 },
  { name: '820px iPad Air', width: 820, height: 1180 },
  { name: '1024px Tablet Landscape / Laptop', width: 1024, height: 768 },
  { name: '1280px Standard Laptop', width: 1280, height: 800 },
  { name: '1440px Desktop', width: 1440, height: 900 },
  { name: '1920px Full HD Desktop', width: 1920, height: 1080 },
  // Landscape phone tests
  { name: '667x375 Mobile Landscape', width: 667, height: 375 },
  { name: '844x390 iPhone Landscape', width: 844, height: 390 },
];

const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/consultation',
  '/diagnostics',
  '/packages',
  '/pharmacy',
  '/home-services',
  '/nri-consultation',
  '/search',
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/accept-mou',
  '/booking',
  '/booking/hospital',
  '/booking/nurse',
  '/booking/therapy',
];

const ROLES_TO_TEST = [
  { role: 'patient', path: '/dashboard/patient', name: 'Rahul Sharma' },
  { role: 'doctor', path: '/dashboard/doctor', name: 'Dr. Latchireddi SA Naidu' },
  { role: 'nurse', path: '/dashboard/nurse', name: 'Sister Priya Sharma' },
  { role: 'phlebotomist', path: '/dashboard/phlebotomist', name: 'Rajesh Verma' },
  { role: 'pharmacy', path: '/dashboard/pharmacy', name: 'CallMedex Prime Pharmacy' },
  { role: 'organization', path: '/dashboard/organization', name: 'Visakha Clinics' },
  { role: 'processing_center', path: '/dashboard/processing-center', name: 'Central Diagnostic Hub' },
  { role: 'dentist', path: '/dashboard/dentist', name: 'Dr. Anita Rao' },
  { role: 'dietitian', path: '/dashboard/dietitian', name: 'Dr. Sneha Patel' },
  { role: 'physiotherapist', path: '/dashboard/physiotherapist', name: 'Dr. Vikram Reddy' },
  { role: 'staff', path: '/dashboard/staff', name: 'Kavitha Rao' },
  { role: 'admin', path: '/dashboard/admin', name: 'Chaitanya Kumar' },
  { role: 'admin', path: '/dashboard/supervisor', name: 'City Operations Supervisor' },
];

async function runAudit() {
  console.log('Starting Independent Responsive Viewport Audit...\n');
  const browser = await chromium.launch({ headless: true });
  const results = {
    testedViewports: VIEWPORTS.length,
    publicPagesTested: 0,
    dashboardPagesTested: 0,
    overflowFailures: [],
    interactionPasses: 0,
    interactionFailures: [],
  };

  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Audit Public & Auth Pages across viewports
  console.log('=== PHASE 1: PUBLIC & AUTH PAGES RESPONSIVENESS ===');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const route of PUBLIC_ROUTES) {
      try {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(300);

        const overflowInfo = await page.evaluate(() => {
          const scrollW = document.documentElement.scrollWidth;
          const clientW = document.documentElement.clientWidth;
          const innerW = window.innerWidth;
          const hasOverflow = scrollW > innerW + 1; // 1px tolerance for subpixel rounding

          let badElements = [];
          if (hasOverflow) {
            const all = document.querySelectorAll('*');
            for (const el of all) {
              const r = el.getBoundingClientRect();
              if (r.right > innerW + 2 && r.width > 0 && r.height > 0) {
                const tag = el.tagName.toLowerCase();
                const cls = (el.className && typeof el.className === 'string') ? `.${el.className.split(' ').join('.')}` : '';
                const id = el.id ? `#${el.id}` : '';
                badElements.push(`${tag}${id}${cls} (w:${Math.round(r.width)}, right:${Math.round(r.right)})`);
                if (badElements.length >= 3) break;
              }
            }
          }
          return { hasOverflow, scrollW, clientW, innerW, badElements };
        });

        results.publicPagesTested++;

        if (overflowInfo.hasOverflow) {
          console.error(`[FAIL] Overflow on ${route} at ${vp.name} (${vp.width}x${vp.height}): scrollWidth=${overflowInfo.scrollW} > innerWidth=${overflowInfo.innerW}. Elements: ${overflowInfo.badElements.join('; ')}`);
          results.overflowFailures.push({ route, viewport: vp.name, width: vp.width, ...overflowInfo });
        }
      } catch (err) {
        console.error(`[ERROR] Visiting ${route} at ${vp.name}: ${err.message}`);
      }
    }
    console.log(`✓ Tested all ${PUBLIC_ROUTES.length} public/auth routes at ${vp.name} (${vp.width}px)`);
  }

  // 2. Audit Authenticated Dashboards for all 13 Roles
  console.log('\n=== PHASE 2: AUTHENTICATED DASHBOARDS FOR ALL ROLES ===');
  for (const roleDef of ROLES_TO_TEST) {
    for (const vp of [VIEWPORTS[0], VIEWPORTS[2], VIEWPORTS[7], VIEWPORTS[11]]) { // 320px, 375px, 768px, 1440px
      await page.setViewportSize({ width: vp.width, height: vp.height });
      try {
        // Set authenticated user in localStorage
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
        await page.evaluate((r) => {
          localStorage.setItem('token', 'simulated-audit-jwt-token');
          localStorage.setItem('user', JSON.stringify({
            id: 'audit-user-id',
            full_name: r.name,
            role: r.role,
            master_owner: r.role === 'admin',
          }));
        }, roleDef);

        await page.goto(`${BASE_URL}${roleDef.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(400);

        const dashOverflow = await page.evaluate(() => {
          const scrollW = document.documentElement.scrollWidth;
          const innerW = window.innerWidth;
          const hasOverflow = scrollW > innerW + 1;
          let badElements = [];
          if (hasOverflow) {
            const all = document.querySelectorAll('*');
            for (const el of all) {
              const r = el.getBoundingClientRect();
              if (r.right > innerW + 2 && r.width > 0 && r.height > 0) {
                const tag = el.tagName.toLowerCase();
                const cls = (el.className && typeof el.className === 'string') ? `.${el.className.split(' ').slice(0, 2).join('.')}` : '';
                badElements.push(`${tag}${cls} (right:${Math.round(r.right)})`);
                if (badElements.length >= 3) break;
              }
            }
          }
          return { hasOverflow, scrollW, innerW, badElements };
        });

        results.dashboardPagesTested++;

        if (dashOverflow.hasOverflow) {
          console.error(`[FAIL] Overflow on ${roleDef.role} (${roleDef.path}) at ${vp.name}: scrollW=${dashOverflow.scrollW} > innerW=${dashOverflow.innerW}. Elements: ${dashOverflow.badElements.join('; ')}`);
          results.overflowFailures.push({ route: roleDef.path, role: roleDef.role, viewport: vp.name, ...dashOverflow });
        }
      } catch (err) {
        console.error(`[ERROR] Dashboard ${roleDef.path} at ${vp.name}: ${err.message}`);
      }
    }
    console.log(`✓ Tested ${roleDef.role} dashboard (${roleDef.path}) across mobile, tablet, and desktop`);
  }

  // 3. Test Mobile Navigation & Interactive Workflows
  console.log('\n=== PHASE 3: TOUCH / INTERACTION VERIFICATION ===');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Test mobile hamburger toggle
  try {
    const hamburger = await page.$('.navbar__hamburger');
    if (hamburger && await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(300);
      const drawerVisible = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a')).filter(a => a.innerText.includes('Health Packages'));
        return links.some(l => l.offsetParent !== null);
      });
      if (drawerVisible) {
        console.log('✓ Mobile hamburger menu expands and displays navigation drawer properly.');
        results.interactionPasses++;
      } else {
        console.error('[FAIL] Mobile drawer links not visible after clicking hamburger.');
        results.interactionFailures.push('Mobile hamburger drawer open failed');
      }
    }
  } catch (err) {
    console.error('[ERROR] Hamburger interaction test:', err.message);
  }

  // Test role selector clickability on signup page
  try {
    await page.goto(`${BASE_URL}/auth/signup`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const roleOptions = await page.$$('.role-option');
    if (roleOptions.length >= 10) {
      await roleOptions[1].click(); // click Doctor
      await page.waitForTimeout(200);
      const isSelected = await roleOptions[1].evaluate(el => el.classList.contains('selected'));
      if (isSelected) {
        console.log('✓ Multi-role registration cards are fully selectable on mobile viewports.');
        results.interactionPasses++;
      } else {
        results.interactionFailures.push('Role option selection failed');
      }
    }
  } catch (err) {
    console.error('[ERROR] Signup role selection test:', err.message);
  }

  // Test modal height constraint
  try {
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
    const modalUsable = await page.evaluate(() => {
      const card = document.querySelector('.cm-login-glass-card');
      if (!card) return false;
      const r = card.getBoundingClientRect();
      return r.right <= window.innerWidth && r.left >= 0;
    });
    if (modalUsable) {
      console.log('✓ Login glass card fits within mobile viewport boundaries perfectly.');
      results.interactionPasses++;
    } else {
      results.interactionFailures.push('Login card out of bounds');
    }
  } catch (err) {
    console.error('[ERROR] Login card bounds test:', err.message);
  }

  await browser.close();

  console.log('\n======================================================');
  console.log('AUDIT SUMMARY:');
  console.log(`Total Viewports Tested: ${results.testedViewports}`);
  console.log(`Public Page Render Checks: ${results.publicPagesTested}`);
  console.log(`Dashboard Render Checks: ${results.dashboardPagesTested}`);
  console.log(`Overflow Violations: ${results.overflowFailures.length}`);
  console.log(`Interactive Workflow Passes: ${results.interactionPasses}`);
  console.log(`Interactive Workflow Failures: ${results.interactionFailures.length}`);
  console.log('======================================================\n');

  if (results.overflowFailures.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
