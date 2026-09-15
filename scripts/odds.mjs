/**
 * Exercises the odds lookup: a seeded ladder wallet, then an arbitrary address,
 * then the connect shortcut. Checks the result panel actually populates.
 *
 * Usage: node scripts/odds.mjs
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

await mkdir("shots", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

const problems = [];
page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") problems.push(`error: ${message.text()}`);
});

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.locator("#odds").scrollIntoViewIfNeeded();
await page.waitForTimeout(900);

const field = page.locator("#odds-address");
const dial = page.locator("#odds").getByText(/of 10\.00% cap/i);

// A wallet that sits above the cap.
await page.getByRole("button", { name: "0x4b19…8137" }).click();
await page.waitForTimeout(900);
await page.locator("#odds").screenshot({ path: "shots/odds-capped.png" });
console.log("capped wallet ->", await dial.locator("..").innerText());

// An address nobody seeded.
await field.fill("0x1111222233334444555566667777888899990000");
await page.getByRole("button", { name: "Check odds" }).first().click();
await page.waitForTimeout(900);
await page.locator("#odds").screenshot({ path: "shots/odds-arbitrary.png" });
console.log("arbitrary wallet ->", await dial.locator("..").innerText());

// Rejects junk rather than guessing.
await field.fill("not-an-address");
await page.waitForTimeout(300);
const disabled = await page
  .getByRole("button", { name: "Check odds" })
  .first()
  .isDisabled();
console.log("junk input disables submit ->", disabled);

// Connect shortcut fills a position without any wallet library.
await page.getByRole("button", { name: "Connect wallet" }).click();
await page.waitForTimeout(900);
await page.locator("#odds").screenshot({ path: "shots/odds-connected.png" });
console.log("connect shortcut ->", await dial.locator("..").innerText());

await browser.close();
console.log(problems.length ? problems.join("\n") : "no console errors");
