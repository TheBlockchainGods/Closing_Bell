/**
 * Prepares the site-stage Bellwether cutout.
 *
 * Source is lit on solid black. A luma key drops the backdrop to alpha, then a
 * dilated solid-subject mask kills residual dark veil so the crop never reads
 * as a black plate on the page. Brand icon art with neon frames is intentionally
 * not used on the marketing stage.
 *
 * Usage: node scripts/prepare-mascot.mjs
 */

import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const SOURCE = "art/kitten-ringer-source.png";
const OUT = "public/mascot/kitten-ringer.webp";

const KEY_FLOOR = 0.03;
const KEY_CEIL = 0.22;
const SOLID = 0.5;
const PAD = 6;
const PAD_BOTTOM = 28;
const DILATE = 10;

const png = await readFile(SOURCE);
const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage();

const result = await page.evaluate(
  async ({ dataUrl, KEY_FLOOR, KEY_CEIL, SOLID, PAD, PAD_BOTTOM, DILATE }) => {
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
      const luma =
        (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255;
      const t = (luma - KEY_FLOOR) / (KEY_CEIL - KEY_FLOOR);
      const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
      // Hard-kill near-black so the key never leaves a rectangular veil.
      const a = luma < KEY_FLOOR ? 0 : Math.pow(clamped, 0.9);
      alpha[i] = a;
      px[o + 3] = Math.round(a * 255);
    }

    // Keep alpha only near the solid subject (dilated mask).
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i += 1) {
      if (alpha[i] >= SOLID) solid[i] = 1;
    }
    const keep = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (!solid[y * w + x]) continue;
        const y0 = Math.max(0, y - DILATE);
        const y1 = Math.min(h - 1, y + DILATE);
        const x0 = Math.max(0, x - DILATE);
        const x1 = Math.min(w - 1, x + DILATE);
        for (let yy = y0; yy <= y1; yy += 1) {
          for (let xx = x0; xx <= x1; xx += 1) {
            const dx = xx - x;
            const dy = yy - y;
            if (dx * dx + dy * dy <= DILATE * DILATE) {
              keep[yy * w + xx] = 1;
            }
          }
        }
      }
    }
    for (let i = 0; i < w * h; i += 1) {
      if (!keep[i]) {
        alpha[i] = 0;
        px[i * 4 + 3] = 0;
      } else {
        px[i * 4 + 3] = Math.round(alpha[i] * 255);
      }
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
    maxY = Math.min(h - 1, maxY + PAD_BOTTOM);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;

    const upper = minY + Math.round(ch * 0.42);
    let pawMaxX = -1;
    for (let y = minY; y <= upper; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (alpha[y * w + x] >= SOLID && x > pawMaxX) pawMaxX = x;
      }
    }
    let pawTop = upper;
    for (let y = minY; y <= upper; y += 1) {
      for (let x = Math.max(minX, pawMaxX - 28); x <= pawMaxX; x += 1) {
        if (alpha[y * w + x] >= SOLID) {
          pawTop = y;
          break;
        }
      }
      if (pawTop < upper) break;
    }
    const paw = { sumX: 0, sumY: 0, weight: 0 };
    const pawBottom = Math.min(upper, pawTop + Math.round(ch * 0.08));
    for (let y = pawTop; y <= pawBottom; y += 1) {
      for (let x = Math.max(minX, pawMaxX - 56); x <= pawMaxX; x += 1) {
        const a = alpha[y * w + x];
        if (a < SOLID) continue;
        paw.sumX += x * a;
        paw.sumY += y * a;
        paw.weight += a;
      }
    }

    ctx.putImageData(frame, 0, 0);
    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    out.getContext("2d").drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);

    return {
      crop: { w: cw, h: ch },
      paw: {
        x: Number(((paw.sumX / paw.weight - minX) / cw).toFixed(4)),
        y: Number(((paw.sumY / paw.weight - minY) / ch).toFixed(4)),
      },
      webp: out.toDataURL("image/webp", 0.92),
    };
  },
  { dataUrl, KEY_FLOOR, KEY_CEIL, SOLID, PAD, PAD_BOTTOM, DILATE },
);

await browser.close();
await mkdir("public/mascot", { recursive: true });
const bytes = Buffer.from(result.webp.split(",")[1], "base64");
await writeFile(OUT, bytes);

console.log(`cropped  ${result.crop.w}x${result.crop.h}`);
console.log(`aspect   ${(result.crop.w / result.crop.h).toFixed(4)}`);
console.log(`paw      x ${result.paw.x}  y ${result.paw.y}`);
console.log(`wrote    ${OUT}  ${(bytes.length / 1024).toFixed(1)} kB`);
