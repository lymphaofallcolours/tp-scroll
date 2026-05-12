import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1400 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

await page.getByRole("button", { name: "Plan" }).click();
await page.waitForTimeout(500);

// Toggle the flights checkbox by clicking the input directly inside its label.
const labels = page.locator("label").filter({ hasText: /flights/i });
const checkbox = labels.first().locator("input[type='checkbox']");
await checkbox.check();
await page.waitForTimeout(200);

// Run optimization
await page.getByRole("button", { name: /Run optimization/i }).click();
// Wait for both optimize() and the flight annotations to finish
await page.waitForTimeout(6000);

await page.screenshot({ path: "/tmp/tp-scroll-pr29.png", fullPage: true });
await browser.close();
console.log("ok");
