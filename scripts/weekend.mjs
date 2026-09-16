/**
 * Checks the weekend rules render, by pinning the browser clock rather than
 * waiting for an actual Saturday.
 *
 * Expected: on Saturday the board reports itself dark and the next bell is the
 * Monday Open Bell flagged as weekend carry. On a Wednesday afternoon neither
 * of those should appear.
 *
 * Usage: node scripts/weekend.mjs
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

await mkdir("shots", { recursive: true });

const CASES = [
  { name: "saturday", time: "2026-09-19T19:00:00Z", expectCarry: true },
  { name: "friday-night", time: "2026-09-18T21:00:00Z", expectCarry: true },
  { name: "wednesday", time: "2026-09-16T17:00:00Z", expectCarry: false },
];

const browser = await chromium.launch();

for (const testCase of CASES) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });

  await page.clock.install({ time: new Date(testCase.time) });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.clock.runFor(1500);

  await page.locator("#countdown").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const board = page.locator("#countdown");
  // innerText applies text-transform, so match case-insensitively.
  const text = (await board.innerText()).toLowerCase();

  const dark = text.includes("board dark for the weekend");
  const carry = text.includes("weekend carry");
  const upNext = text.match(/up next\s+(.+)/)?.[1]?.trim();
  const status = await page
    .getByText(/session live|between sessions|weekend, pot accruing/i)
    .first()
    .innerText();

  console.log(
    `${testCase.name.padEnd(14)} up next: ${String(upNext).padEnd(11)} dark: ${String(dark).padEnd(5)} carry badge: ${String(carry).padEnd(5)} header: ${status}`,
  );

  if (dark !== testCase.expectCarry || carry !== testCase.expectCarry) {
    console.log(`  MISMATCH: expected weekend state ${testCase.expectCarry}`);
  }

  await board.screenshot({ path: `shots/weekend-${testCase.name}.png` });
  await page.close();
}

await browser.close();
