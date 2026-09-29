// Finds visible elements that stick past the viewport edge even when an
// ancestor clips them (so scrollWidth stays clean) — the class of bug the
// user photographed on /diagnostics.
import { chromium } from '@playwright/test';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ROUTES=['/','/about','/consultation','/diagnostics','/packages','/pharmacy','/home-services','/nri-consultation','/search','/auth/login','/auth/signup','/booking'];
const out = process.argv[2];
const b = await chromium.launch();
let bad = 0;
for (const w of [360, 390]) {
  const ctx = await b.newContext({ viewport:{width:w,height:800}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  for (const r of ROUTES) {
    await p.goto(BASE+r, { waitUntil:'domcontentloaded', timeout: 90000 });
    await p.waitForTimeout(1800);
    const hits = await p.evaluate(() => {
      const W = innerWidth, res = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('nextjs-portal')) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed') continue;
        if (cs.pointerEvents === 'none' && !(el.textContent || '').trim()) continue;          // decorative glows
        const rc = el.getBoundingClientRect();
        if (rc.width === 0 || rc.height === 0 || rc.left >= W) continue;       // offscreen carousels etc.
        if (rc.right <= W + 1) continue;
        // skip anything inside an intentional horizontal scroller
        let p = el.parentElement, scroller = false;
        while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') { scroller = true; break; } p = p.parentElement; }
        if (scroller) continue;
        if (el.children.length && [...el.children].some(c => c.getBoundingClientRect().right > W + 1)) continue; // report leaves only
        res.push(`${el.tagName.toLowerCase()} "${(el.textContent||'').trim().slice(0,30)}" right=${Math.round(rc.right)}`);
      }
      return res.slice(0, 6);
    });
    if (hits.length) { bad++; console.log(`${w}px ${r}:`, hits.join(' | ')); }
    if (out && r === '/diagnostics') await p.screenshot({ path: `${out}/diag-${w}.png` });
  }
  await ctx.close();
}
await b.close();
console.log('routes-with-edge-overflow', bad);
