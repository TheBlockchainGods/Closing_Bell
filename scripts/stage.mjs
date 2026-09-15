/**
 * Close-up of the ritual stage, for checking that the rope lands in the paw and
 * that the mascot sits on the floor rather than floating.
 *
 * Usage: node scripts/stage.mjs [idle|ring]
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const mode = process.argv[2] ?? "idle";

await mkdir("shots", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

if (mode === "ring") {
  await page.getByRole("button", { name: /ring the bell/i }).click();
  await page.waitForTimeout(700);
}

const stage = page.getByRole("img", {
  name: /kitten pulling the rope/i,
});
await stage.screenshot({ path: `shots/stage-${mode}.png` });

await browser.close();
console.log(`wrote shots/stage-${mode}.png`);
