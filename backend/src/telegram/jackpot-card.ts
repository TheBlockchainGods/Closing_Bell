import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

import type { PotBreakdown } from "../pot/display.js";

const WIDTH = 1280;
const HEIGHT = 720;
const CACHE_MS = 15_000;
const FONT_FAMILY = "Inter";

const here = dirname(fileURLToPath(import.meta.url));

const MASCOT_CANDIDATES = [
  resolve(here, "../../assets/bellwether-jackpot.webp"),
  resolve(here, "../../assets/bellwether-jackpot.png"),
  resolve(here, "../../../public/mascot/bellwether-podium.webp"),
];

const FONT_DIR_CANDIDATES = [
  resolve(here, "../../assets/fonts"),
  resolve(here, "../../../backend/assets/fonts"),
];

let cache: { key: string; png: Buffer; at: number } | null = null;

function fmtGme(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function jackpotMascotPath(): string {
  for (const path of MASCOT_CANDIDATES) {
    if (existsSync(path)) return path;
  }
  throw new Error(
    "Jackpot mascot missing (backend/assets/bellwether-jackpot.webp)",
  );
}

export function jackpotFontPaths(): { regular: string; bold: string } {
  for (const dir of FONT_DIR_CANDIDATES) {
    const regular = resolve(dir, "Inter-Regular.otf");
    const bold = resolve(dir, "Inter-Bold.otf");
    if (existsSync(regular) && existsSync(bold)) return { regular, bold };
  }
  throw new Error(
    "Jackpot fonts missing (backend/assets/fonts/Inter-Regular.otf)",
  );
}

function cacheKey(pot: PotBreakdown, siteHost: string): string {
  return `inter-v1|${pot.displayPot}|${pot.displayPotUsd}|${pot.inPot}|${pot.accruingUnclaimed}|${siteHost}`;
}

/**
 * Transparent overlay: frames, gold bell mark, live figures.
 * Text uses bundled Inter via resvg, not host fonts (avoids Docker tofu).
 */
export function jackpotCardSvg(pot: PotBreakdown, siteHost: string): string {
  const gme = xml(fmtGme(pot.displayPot));
  const usd = xml(fmtUsd(pot.displayPotUsd));
  const inPot = xml(fmtGme(pot.inPot));
  const accruing = xml(fmtGme(pot.accruingUnclaimed));
  const host = xml(siteHost.replace(/^https?:\/\//, ""));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffe9b0"/>
      <stop offset="42%" stop-color="#f5d56a"/>
      <stop offset="100%" stop-color="#c48a12"/>
    </linearGradient>
    <linearGradient id="bellFill" x1="0.3" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#fff3c4"/>
      <stop offset="35%" stop-color="#f0cc5a"/>
      <stop offset="100%" stop-color="#b8860b"/>
    </linearGradient>
    <radialGradient id="scrim" cx="78%" cy="48%" r="58%">
      <stop offset="0%" stop-color="#050505" stop-opacity="0.55"/>
      <stop offset="55%" stop-color="#050505" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#050505" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="floorGlow" cx="24%" cy="88%" r="36%">
      <stop offset="0%" stop-color="#d4a017" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#d4a017" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scrim)"/>
  <ellipse cx="310" cy="680" rx="260" ry="70" fill="url(#floorGlow)"/>
  <rect x="36" y="36" width="1208" height="648" fill="none" stroke="#d4a017" stroke-opacity="0.62" stroke-width="2"/>
  <rect x="48" y="48" width="1184" height="624" fill="none" stroke="#f5d56a" stroke-opacity="0.2" stroke-width="1"/>
  <g transform="translate(1154 58) scale(1.15)" fill="url(#bellFill)">
    <path d="M16 6c0-3.2 2.4-5.6 6-5.6S28 2.8 28 6"/>
    <path d="M8 28c0-7.4 3.4-11.2 4.2-16.8C12.6 8.4 14.8 7 19 7h6c4.2 0 6.4 1.4 6.8 4.2C26.6 16.8 30 20.6 30 28z"/>
    <rect x="6" y="28" width="26" height="3.4" rx="0.6"/>
    <circle cx="19" cy="34.4" r="2.4"/>
  </g>
  <text x="880" y="148" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="24" font-weight="700" letter-spacing="8" fill="#f5d56a">CLOSING BELL</text>
  <text x="880" y="186" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="16" font-weight="400" letter-spacing="9" fill="#a89868">JACKPOT</text>
  <line x1="760" y1="208" x2="1000" y2="208" stroke="#d4a017" stroke-opacity="0.45" stroke-width="1"/>
  <text x="880" y="318" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="78" font-weight="700" fill="url(#gold)">${gme}</text>
  <text x="880" y="368" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="22" font-weight="700" letter-spacing="6" fill="#f5d56a">GME</text>
  <text x="880" y="430" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="36" font-weight="400" fill="#f7f7f5">${usd}</text>
  <text x="880" y="488" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="16" font-weight="400" fill="#8d8d88">In pot ${inPot} GME</text>
  <text x="880" y="516" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="16" font-weight="400" fill="#8d8d88">Accruing ${accruing} GME</text>
  <text x="880" y="628" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="18" font-weight="400" letter-spacing="3" fill="#8d8d88">${host}</text>
</svg>`;
}

function renderOverlayPng(svg: string): Buffer {
  const fonts = jackpotFontPaths();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      fontFiles: [fonts.regular, fonts.bold],
      loadSystemFonts: false,
      defaultFontFamily: FONT_FAMILY,
    },
  });
  return Buffer.from(resvg.render().asPng());
}

export async function renderJackpotCard(
  pot: PotBreakdown,
  siteHost: string,
): Promise<Buffer> {
  const key = cacheKey(pot, siteHost);
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) {
    return cache.png;
  }

  const sharp = (await import("sharp")).default;
  const mascotPath = jackpotMascotPath();
  const overlay = renderOverlayPng(jackpotCardSvg(pot, siteHost));
  const mascot = await sharp(mascotPath)
    .trim({ threshold: 2 })
    .resize({ height: 628, fit: "inside" })
    .png()
    .toBuffer();
  const mascotMeta = await sharp(mascot).metadata();
  const mascotH = mascotMeta.height ?? 628;
  const left = 64;
  const top = Math.max(48, Math.round((HEIGHT - mascotH) / 2) - 8);

  const png = await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 7, g: 7, b: 8, alpha: 1 },
    },
  })
    .composite([
      { input: mascot, left, top },
      { input: overlay, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();

  cache = { key, png, at: Date.now() };
  return png;
}
