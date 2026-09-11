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

  // Clear any cached symptoms from localStorage to test pristine state
  await page.evaluate(() => {
    localStorage.removeItem("cm_patient_vitals");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('h3:has-text("CallMedex Health Advisor")', { timeout: 20000 });
  await page.waitForTimeout(2000);

  console.log("Capturing 1: Asymptomatic pristine baseline (Header + Health Advisor)...");
  await page.screenshot({
    path: path.join(artifactDir, "advisor_v2_1_asymptomatic_baseline.png"),
    fullPage: false,
  });

  console.log("Clicking 'Know Your Specialist' to launch Modal 0...");
  const knowSpecialistBtn = page.locator('button:has-text("Know Your Specialist")');
  await knowSpecialistBtn.first().click();
  await page.waitForTimeout(1000);

  console.log("Capturing 2: Modal 0 - Symptom Triage Widget...");
  await page.screenshot({
    path: path.join(artifactDir, "advisor_v2_2_modal0_triage_empty.png"),
    fullPage: false,
  });

  // SCENARIO A: Joint & Back Pain (Concern with 0 registered specialists)
  console.log("Scenario A: Selecting 'Joint & Back Pain' (no registered orthopedist in network)...");
  const jointChip = page.locator('.cm-glass-widget-modal button:has-text("Joint & Back Pain")');
  await jointChip.first().click();
  await page.waitForTimeout(800);

  console.log("Capturing 3: Modal 0 showing 0 Registered Clinicians and targeted lab workups...");
  await page.screenshot({
    path: path.join(artifactDir, "advisor_v3_1_modal0_zero_doctors.png"),
    fullPage: false,
  });

  console.log("Clicking 'Doctor Directory (0 Available)' button inside Modal 0...");
  const zeroDocBtn = page.locator('.cm-glass-widget-modal button:has-text("Doctor Directory (0 Available)")');
  await zeroDocBtn.first().click();
  await page.waitForTimeout(1000);

  console.log("Capturing 4: Modal 1 - Honest clinical empty state (No fake doctors)...");
  await page.screenshot({
    path: path.join(artifactDir, "advisor_v3_2_modal1_zero_doctor_honest_state.png"),
    fullPage: false,
  });

  console.log("Clicking 'View Targeted Diagnostic Tests' from the honest empty state...");
  const viewTestsBtn = page.locator('.cm-glass-widget-modal button:has-text("View Targeted Diagnostic Tests")');
  await viewTestsBtn.first().click();
  await page.waitForTimeout(1000);

  console.log("Capturing 5: Modal 2 - Targeted diagnostic test matched to Joint pain (Uric Acid)...");
  await page.screenshot({
    path: path.join(artifactDir, "advisor_v3_3_modal2_joint_tests.png"),
    fullPage: false,
  });

  // Close modal and test dashboard card state
  const closeBtn = page.locator('.cm-glass-widget-modal button[aria-label="Close modal"]');
  await closeBtn.first().click();
  await page.waitForTimeout(800);

  console.log("Capturing 6: Dashboard Card 1 with Amber Zero Doctor status...");
  await page.screenshot({
    path: path.join(artifactDir, "advisor_v3_4_dashboard_card_zero_doctor.png"),
    fullPage: false,
  });

  // SCENARIO B: Cardio & High BP (Concern with genuine registered specialist Dr. Latchireddi)
  console.log("Scenario B: Opening triage to switch to 'Cardio & High BP'...");
  const noSpecBtn = page.locator('button:has-text("No Specialists Registered (0)")');
  await noSpecBtn.first().click();
  await page.waitForTimeout(1000);

  // Uncheck Joint, check Cardio
  const adjustBtn = page.locator('.cm-glass-widget-modal button:has-text("Adjust Health Concerns")');
  await adjustBtn.first().click();
  await page.waitForTimeout(800);

  const jointToggle = page.locator('.cm-glass-widget-modal button:has-text("Joint & Back Pain")');
  await jointToggle.first().click();
  await page.waitForTimeout(400);

  const cardioToggle = page.locator('.cm-glass-widget-modal button:has-text("Cardio & High BP")');
  await cardioToggle.first().click();
  await page.waitForTimeout(800);

  console.log("Clicking 'View Matched Doctors' inside Modal 0...");
  const viewMatchedDocBtn = page.locator('.cm-glass-widget-modal button:has-text("View Matched Doctors")');
  await viewMatchedDocBtn.first().click();
  await page.waitForTimeout(1000);

  console.log("Capturing 7: Modal 1 showing real registered clinician Dr. Latchireddi SA Naidu...");
  await page.screenshot({
    path: path.join(artifactDir, "advisor_v3_5_modal1_registered_doctor_latchireddi.png"),
    fullPage: false,
  });

  await browser.close();
  console.log("All verifications captured successfully!");
}

verify().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
