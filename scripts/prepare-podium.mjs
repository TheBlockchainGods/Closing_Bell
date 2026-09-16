/**
 * Keys the white studio ground off the Bellwether podium logo so it can sit
 * on the hero without a pasted plate. Does not touch brand-kit circular frames.
 *
 * Usage: node scripts/prepare-podium.mjs
 */

import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const SOURCE = "art/bellwether-podium-source.jpg";
const OUT = "public/mascot/bellwether-podium.webp";

const WHITE_FLOOR = 0.9;
const WHITE_CEIL = 0.98;
const SOLID = 0.4;
const PAD = 8;

const src = await readFile(SOURCE);
const dataUrl = `data:image/jpeg;base64,${src.toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const result = await page.evaluate(
  async ({ dataUrl, WHITE_FLOOR, WHITE_CEIL, SOLID, PAD }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const { naturalWidth: w, naturalHeight: h } = img;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const frame = ctx.getImageData(0, 0, w, h);
    const px = frame.data;
    const alpha = new Float32Array(w * h);

    for (let i = 0; i < w * h; i += 1) {
      const o = i * 4;
      const r = px[o];
      const g = px[o + 1];
      const b = px[o + 2];
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      // Near-white, low-sat studio ground → transparent.
      let a = 1;
      if (luma >= WHITE_CEIL && sat < 0.08) {
        a = 0;
      } else if (luma >= WHITE_FLOOR && sat < 0.12) {
        const t = (WHITE_CEIL - luma) / (WHITE_CEIL - WHITE_FLOOR);
        a = Math.max(0, Math.min(1, t));
      }
      alpha[i] = a;
      px[o + 3] = Math.round(a * 255);
    }

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (alpha[y * w + x] < SOLID) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    minX = Math.max(0, minX - PAD);
    minY = Math.max(0, minY - PAD);
    maxX = Math.min(w - 1, maxX + PAD);
    maxY = Math.min(h - 1, maxY + PAD);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;

    ctx.putImageData(frame, 0, 0);
    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    out.getContext("2d").drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);

    return {
      crop: { w: cw, h: ch },
      webp: out.toDataURL("image/webp", 0.92),
    };
  },
  { dataUrl, WHITE_FLOOR, WHITE_CEIL, SOLID, PAD },
);

await browser.close();
await mkdir("public/mascot", { recursive: true });
const bytes = Buffer.from(result.webp.split(",")[1], "base64");
await writeFile(OUT, bytes);

console.log(`cropped  ${result.crop.w}x${result.crop.h}`);
console.log(`aspect   ${(result.crop.w / result.crop.h).toFixed(4)}`);
console.log(`wrote    ${OUT}  ${(bytes.length / 1024).toFixed(1)} kB`);
