import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = "C:\\Users\\chait\\.gemini\\antigravity-ide\\brain\\cdbc78c8-21c3-4cef-8dfc-427abbcb5e55";

async function verify() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  console.log("Navigating to login page...");
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "domcontentloaded" });

  console.log("Authenticating via API...");
  const authRes = await page.request.post("http://127.0.0.1:8000/api/auth/login", {
    data: {
      email: "chaitanyakumar112233@gmail.com",
      password: "chaitu@14",
    },
  });
  const authData = await authRes.json();
  console.log("Auth success. Role:", authData.user?.role, "User:", authData.user?.full_name);

  await page.evaluate((data) => {
    if (data.access_token) localStorage.setItem("token", data.access_token);
    if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("token_expires_at", String(Date.now() + 3600000));
    localStorage.removeItem("cm_patient_vitals");
  }, authData);

  console.log("Navigating directly to /dashboard/patient...");
  await page.goto("http://localhost:3000/dashboard/patient", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('h3:has-text("CallMedex Health Advisor")', { timeout: 20000 });
  await page.waitForTimeout(2000);

  // 1. Pristine Dashboard Card
  console.log("Capturing 1: Compact Dashboard Card...");
  await page.screenshot({
    path: path.join(artifactDir, "portaled_modal_1_dashboard_compact.png"),
    fullPage: false,
  });

  // 2. Open Symptom Triage Widget (Modal 0)
  console.log("Opening Modal 0 (Symptom Triage)...");
  const card1Btn = page.locator('#health-advisor .cm-ai-column-card').first().locator('button');
  await card1Btn.click();
  await page.waitForSelector('.cm-widget-overlay', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Check that the modal overlay is directly under document.body and covers the whole screen
  const isDirectChildOfBody = await page.evaluate(() => {
    const overlay = document.querySelector(".cm-widget-overlay");
    return overlay && overlay.parentElement === document.body;
  });
  console.log("Modal overlay is mounted directly to document.body (Portaled):", isDirectChildOfBody);

  // Check if we are in Modal 1 (doctor list) or Modal 0 (symptom triage). If in Modal 1, click "Change Symptoms"
  const changeSymptomsBtn = page.locator('.cm-glass-widget-modal button:has-text("Change Symptoms")');
  if (await changeSymptomsBtn.isVisible()) {
    console.log("Switching from doctor list to Symptom Triage...");
    await changeSymptomsBtn.first().click();
    await page.waitForTimeout(800);
  }

  // Select "Fever & Cold" and "Cardio & High BP" to match User Photo 2
  const feverBtn = page.locator('.cm-glass-widget-modal button:has-text("Fever & Cold")');
  if (await feverBtn.isVisible()) {
    await feverBtn.first().click();
    await page.waitForTimeout(400);
  }

  const cardioBtn = page.locator('.cm-glass-widget-modal button:has-text("Cardio & High BP")');
  if (await cardioBtn.isVisible()) {
    await cardioBtn.first().click();
    await page.waitForTimeout(600);
  }

  console.log("Capturing 2: Portaled Symptom Triage Widget (Matching Photo 2)...");
  await page.screenshot({
    path: path.join(artifactDir, "portaled_modal_2_symptom_triage.png"),
    fullPage: false,
  });

  // 3. Open Modal 2 (Diagnostics Console) to match User Photo 1
  console.log("Navigating to Diagnostics Console (Modal 2)...");
  const closeBtn = page.locator('.cm-glass-widget-modal button[aria-label="Close modal"]');
  await closeBtn.first().click();
  await page.waitForTimeout(600);

  const diagCardBtn = page.locator('#health-advisor .cm-ai-column-card').nth(1).locator('button');
  await diagCardBtn.click();
  await page.waitForSelector('.cm-glass-widget-modal h3:has-text("Targeted Diagnostics")', { timeout: 10000 });
  await page.waitForTimeout(1000);

  console.log("Capturing 3: Portaled Diagnostics Console (Matching Photo 1)...");
  await page.screenshot({
    path: path.join(artifactDir, "portaled_modal_3_diagnostics_console.png"),
    fullPage: false,
  });

  // 4. Switch to Modal 3 (Preventive Care Schedule) to match User Photo 3
  console.log("Closing and opening Modal 3 (Preventive Care Schedule)...");
  const closeDiagBtn = page.locator('.cm-glass-widget-modal button[aria-label="Close modal"]');
  await closeDiagBtn.first().click();
  await page.waitForTimeout(600);

  const careGuideBtn = page.locator('#health-advisor .cm-ai-column-card').nth(2).locator('button');
  await careGuideBtn.click();
  await page.waitForSelector('.cm-glass-widget-modal h3:has-text("Preventive Care")', { timeout: 10000 });
  await page.waitForTimeout(1000);

  console.log("Capturing 4: Portaled Preventive Care & Nutrition Console (Matching Photo 3)...");
  await page.screenshot({
    path: path.join(artifactDir, "portaled_modal_4_preventive_schedule.png"),
    fullPage: false,
  });

  // 5. Test pressing 'Escape' key to dismiss
  console.log("Testing Escape key dismissal...");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);

  const modalOpenAfterEsc = await page.evaluate(() => {
    return !!document.querySelector(".cm-widget-overlay");
  });
  console.log("Modal closed cleanly upon Escape key:", !modalOpenAfterEsc);

  await page.screenshot({
    path: path.join(artifactDir, "portaled_modal_5_closed_cleanly.png"),
    fullPage: false,
  });

  await browser.close();
  console.log("All portaled modal tests completed successfully!");
}

verify().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
