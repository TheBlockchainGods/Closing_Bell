import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "shots";
const URL = process.env.SHOT_URL ?? "http://localhost:3000";

const VIEWS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
  { name: "reduced", width: 1440, height: 900, reducedMotion: "reduce" },
];

const SECTIONS = [
  "bell-pot",
  "countdown",
  "odds",
  "how-it-works",
  "after-hours",
  "winners",
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];

for (const view of VIEWS) {
  const page = await browser.newPage({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: 2,
    reducedMotion: view.reducedMotion,
  });

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`[${view.name}] ${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`[${view.name}] pageerror: ${error.message}`);
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  await page.screenshot({ path: `${OUT}/${view.name}-hero.png` });
  await page.screenshot({
    path: `${OUT}/${view.name}-full.png`,
    fullPage: true,
  });

  // Sections in their resting state, before any demo ring disturbs the window.
  for (const id of SECTIONS) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${view.name}-${id}.png` });
  }

  // Then ring the bell and capture mid-swing plus the settled aftermath.
  await page.locator("#top").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /ring the bell/i }).click();
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${OUT}/${view.name}-ringing.png` });
  await page.waitForTimeout(1600);

  for (const id of ["bell-pot", "odds", "winners"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${view.name}-${id}-rung.png` });
  }

  await page.close();
}

await browser.close();

if (errors.length) {
  console.log("--- console output ---");
  for (const line of errors) console.log(line);
} else {
  console.log("no console errors");
}
