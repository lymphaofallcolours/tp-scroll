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
await page.waitForTimeout(300);

// Run optimization (diverse is checked by default)
await page.getByRole("button", { name: /Run optimization/i }).click();
// Wait for the heavy optimize() call to finish + paint
await page.waitForTimeout(3500);

await page.screenshot({ path: "/tmp/tp-scroll-pr22.png", fullPage: true });
await browser.close();
console.log("ok");
