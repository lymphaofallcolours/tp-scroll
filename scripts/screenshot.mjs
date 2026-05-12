import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:4173/";
const out = process.argv[3] ?? "/tmp/tp-scroll.png";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1600 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("ok:", out);
