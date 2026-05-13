import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1600 },
  deviceScaleFactor: 2,
});

// Screenshot 1: Calendar — should show per-bucket colors (sage / mauve / amber)
{
  const page = await ctx.newPage();
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: "/tmp/tp-scroll-pr38-calendar.png", fullPage: true });
  await page.close();
}

// Screenshot 2: Sessions — buckets card visible
{
  const page = await ctx.newPage();
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Sessions" }).click();
  await page.waitForTimeout(400);
  // Create a real session first so the bucket form's "active" persistence shows
  await page.locator("input[placeholder^='e.g. 2026']").fill("v2.5 demo");
  await page.getByRole("button", { name: "Create session" }).click();
  await page.waitForTimeout(500);
  // The freshly-created session only has the default annual bucket. Add a couple
  // more via the Buckets card so the kinds are visible. But the totals would
  // need adjusting — for the screenshot, just expand the form.
  await page.getByRole("button", { name: /\+ add bucket/i }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/tp-scroll-pr38-sessions.png", fullPage: true });
  await page.close();
}

await browser.close();
console.log("ok");
