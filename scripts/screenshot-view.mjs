import { chromium } from "playwright";

const view = process.argv[2] ?? "Calendar";
const out = process.argv[3] ?? "/tmp/tp-scroll.png";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

await page.getByRole("button", { name: view }).click();
await page.waitForTimeout(1200);

await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("ok:", out);
