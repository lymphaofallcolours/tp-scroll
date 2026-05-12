import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Click the Trips tab
await page.getByRole("button", { name: "Trips" }).click();
await page.waitForTimeout(500);

await page.screenshot({ path: "/tmp/tp-scroll-pr21-list.png", fullPage: true });

// Open the first trip to show the form
const firstRow = page.locator(".row__row, [class*='row']").first();
// Use the visible button — pick the first trip card
await page.locator("button[class*='row']").first().click();
await page.waitForTimeout(500);

await page.screenshot({ path: "/tmp/tp-scroll-pr21-form.png", fullPage: false });

await browser.close();
console.log("ok");
