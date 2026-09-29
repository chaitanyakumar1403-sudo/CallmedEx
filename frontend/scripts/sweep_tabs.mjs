// Every role x every section tab x phone/tablet widths: fail on page-level horizontal overflow.
import { chromium } from '@playwright/test';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ROLES = [
  ['patient','/dashboard/patient'],['doctor','/dashboard/doctor'],['nurse','/dashboard/nurse'],
  ['phlebotomist','/dashboard/phlebotomist'],['pharmacy','/dashboard/pharmacy'],['organization','/dashboard/organization'],
  ['processing_center','/dashboard/processing-center'],['dentist','/dashboard/dentist'],['dietitian','/dashboard/dietitian'],
  ['physiotherapist','/dashboard/physiotherapist'],['staff','/dashboard/staff'],['admin','/dashboard/admin'],
  ['admin','/dashboard/admin/fraud'],['admin','/dashboard/supervisor'],
];
const VPS = [[360,740],[390,844],[768,1024]];
const browser = await chromium.launch();
const fails = [];
let checks = 0;
for (const [w,h] of VPS) {
  const ctx = await browser.newContext({ viewport:{width:w,height:h}, isMobile: w<700, hasTouch:true, deviceScaleFactor:2 });
  const page = await ctx.newPage();
  for (const [role,path] of ROLES) {
    await page.goto(BASE+'/', { waitUntil:'domcontentloaded' });
    await page.evaluate(r => { localStorage.setItem('token','x'); localStorage.setItem('user', JSON.stringify({id:'u',full_name:'Test User',role:r,master_owner:r==='admin'})); }, role);
    await page.goto(BASE+path, { waitUntil:'domcontentloaded' });
    await page.waitForSelector('[role=tab]', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    const tabs = await page.$$('[role=tab]');
    const n = Math.max(1, tabs.length);
    for (let i=0;i<n;i++) {
      const all = await page.$$('[role=tab]');
      let label = 'default';
      if (all[i]) { label = (await all[i].innerText()).trim().split('\n')[0]; await all[i].click().catch(()=>{}); await page.waitForTimeout(700); }
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      checks++;
      if (sw > w + 1) fails.push(`${w}px ${path} [${label}] scrollWidth=${sw}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`checks=${checks} failures=${fails.length}`);
fails.forEach(f => console.log('FAIL', f));
process.exit(fails.length ? 1 : 0);
