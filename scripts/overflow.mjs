import { chromium } from "playwright";

const URL = process.env.SHOT_URL ?? "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const offenders = await page.evaluate(() => {
  const limit = document.documentElement.clientWidth;
  const found = [];
  for (const element of document.querySelectorAll("*")) {
    if (element.closest(".tape-viewport")) continue;
    if (element.tagName === "svg" || element.closest("svg")) continue;

    const box = element.getBoundingClientRect();
    if (box.width === 0) continue;

    // Only report the innermost offenders: no overflowing descendant.
    const childOverflows = Array.from(element.children).some((child) => {
      const childBox = child.getBoundingClientRect();
      return childBox.width > 0 && childBox.right > limit + 1;
    });
    if (childOverflows) continue;

    if (box.right > limit + 1 || box.left < -1) {
      found.push({
        tag: element.tagName.toLowerCase(),
        cls: (element.getAttribute("class") ?? "").slice(0, 110),
        left: Math.round(box.left),
        right: Math.round(box.right),
        width: Math.round(box.width),
        text: (element.textContent ?? "").trim().slice(0, 46),
      });
    }
  }
  return { limit, found };
});

console.log(`viewport ${offenders.limit}px, ${offenders.found.length} overflowing`);
for (const item of offenders.found.slice(0, 40)) {
  console.log(
    `${item.tag} l=${item.left} r=${item.right} w=${item.width} | ${item.cls} | ${item.text}`,
  );
}

const chain = await page.evaluate(() => {
  const target = document.querySelector("#after-hours");
  const lines = [];
  let node = target?.querySelector(".bg-floor-900") ?? null;
  while (node && node !== document.documentElement) {
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    lines.push(
      `${node.tagName.toLowerCase()} w=${Math.round(box.width)} l=${Math.round(box.left)} display=${style.display} minW=${style.minWidth} cls=${(node.getAttribute("class") ?? "").slice(0, 70)}`,
    );
    node = node.parentElement;
  }
  return lines;
});

console.log("\n--- ancestor chain from After Hours panel ---");
for (const line of chain) console.log(line);

const intrinsic = await page.evaluate(() => {
  const panel = document
    .querySelector("#after-hours")
    ?.querySelector(".bg-floor-900");
  if (!panel) return [];

  const results = [];
  for (const element of panel.querySelectorAll("*")) {
    const html = element;
    const previous = html.style.width;
    html.style.width = "min-content";
    const min = html.getBoundingClientRect().width;
    html.style.width = previous;
    results.push({
      min: Math.round(min),
      label: `${element.tagName.toLowerCase()} ${(element.getAttribute("class") ?? "").slice(0, 80)} | ${(element.textContent ?? "").trim().slice(0, 40)}`,
    });
  }

  const panelPrevious = panel.style.width;
  panel.style.width = "min-content";
  const panelMin = Math.round(panel.getBoundingClientRect().width);
  panel.style.width = panelPrevious;

  results.sort((a, b) => b.min - a.min);
  return [
    `PANEL min-content = ${panelMin}`,
    ...results.slice(0, 8).map((item) => `min=${item.min} ${item.label}`),
  ];
});

console.log("\n--- descendants with min-content over 320px ---");
for (const line of intrinsic) console.log(line);

const boxes = await page.evaluate(() => {
  const grid = document
    .querySelector("#after-hours")
    ?.querySelector(".bg-floor-900")?.parentElement;
  if (!grid) return [];
  const gridStyle = getComputedStyle(grid);
  const lines = [
    `grid offsetWidth=${grid.offsetWidth} rect=${Math.round(grid.getBoundingClientRect().width)} cols=${gridStyle.gridTemplateColumns} transform=${gridStyle.transform}`,
  ];
  for (const child of grid.children) {
    const style = getComputedStyle(child);
    lines.push(
      `child offsetWidth=${child.offsetWidth} rect=${Math.round(child.getBoundingClientRect().width)} width=${style.width} minWidth=${style.minWidth} transform=${style.transform} box=${style.boxSizing}`,
    );
  }
  return lines;
});

console.log("\n--- grid box diagnostics ---");
for (const line of boxes) console.log(line);

await browser.close();
