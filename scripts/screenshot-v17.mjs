import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1400 },
  deviceScaleFactor: 2,
});

// Screenshot 1: Sessions view with the new Flight constraints card visible.
{
  const page = await ctx.newPage();
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  // Create a real session first so the Roll-cycle and Flight-constraints
  // cards appear (they're hidden in pure-demo mode).
  // The Sessions view's "Create session" form is on the right column.
  await page.getByRole("button", { name: "Sessions" }).click();
  await page.waitForTimeout(400);
  // Fill the create-session form and submit so a real session is active.
  await page.locator("input[placeholder^='e.g. 2026']").fill("v1.7 demo");
  await page.getByRole("button", { name: "Create session" }).click();
  await page.waitForTimeout(600);
  // Apply flight constraints
  await page.locator("input[placeholder='e.g. 240']").fill("240");
  await page.locator("input[placeholder='e.g. 18']").fill("18");
  await page.locator("input[placeholder='e.g. 10']").fill("10");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/tp-scroll-pr34-sessions.png", fullPage: true });
  await page.close();
}

// Screenshot 2: Plan view with price-aware enabled.
{
  const page = await ctx.newPage();
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Plan" }).click();
  await page.waitForTimeout(400);
  // Enable flights then price-aware
  const flightsCheckbox = page
    .locator("label")
    .filter({ hasText: /flights/i })
    .first()
    .locator("input[type='checkbox']");
  await flightsCheckbox.check();
  await page.waitForTimeout(200);
  const priceCheckbox = page
    .locator("label")
    .filter({ hasText: /price-aware/i })
    .locator("input[type='checkbox']");
  await priceCheckbox.check();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Run optimization/i }).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "/tmp/tp-scroll-pr34-plan.png", fullPage: true });
  await page.close();
}

await browser.close();
console.log("ok");
