import { formatGme, formatUsdPrecise } from "@/lib/format";
import {
  JACKPOT_MASCOT_SRC,
  JACKPOT_SITE_HOST,
} from "@/lib/jackpot-share";

const WIDTH = 1280;
const HEIGHT = 720;

export type JackpotCardAmounts = {
  displayPotGme: number;
  displayPotUsd: number;
  inPotGme: number;
  accruingGme: number;
  totalPaidOutGme: number;
  totalPaidOutUsd: number;
};

export function formatPaidOutCardLine(gme: number, usd: number): string {
  return `Paid out ${formatGme(gme)} GME (~${formatUsdPrecise(usd)})`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Client-side jackpot share card (Telegram-style dark/gold).
 * Uses the transparent Bellwether podium mascot from /public/mascot.
 */
export async function renderJackpotSharePng(
  amounts: JackpotCardAmounts,
): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  // Floor
  ctx.fillStyle = "#070708";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Soft gold floor glow (left)
  const glow = ctx.createRadialGradient(310, 680, 20, 310, 680, 280);
  glow.addColorStop(0, "rgba(212,160,23,0.22)");
  glow.addColorStop(1, "rgba(212,160,23,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(310, 680, 260, 70, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mascot
  try {
    const mascot = await loadImage(JACKPOT_MASCOT_SRC);
    const maxH = 628;
    const scale = Math.min(maxH / mascot.height, 520 / mascot.width);
    const mw = mascot.width * scale;
    const mh = mascot.height * scale;
    const left = 64;
    const top = Math.max(48, Math.round((HEIGHT - mh) / 2) - 8);
    ctx.drawImage(mascot, left, top, mw, mh);
  } catch {
    // Text-only card still usable if mascot fails to load
  }

  // Right-side scrim so gold type stays readable over the mascot
  const scrim = ctx.createRadialGradient(1000, 360, 40, 900, 360, 520);
  scrim.addColorStop(0, "rgba(5,5,5,0.72)");
  scrim.addColorStop(0.55, "rgba(5,5,5,0.28)");
  scrim.addColorStop(1, "rgba(5,5,5,0)");
  ctx.fillStyle = scrim;
  ctx.fillRect(560, 0, 720, HEIGHT);

  // Frames
  ctx.strokeStyle = "rgba(212,160,23,0.62)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36.5, 36.5, 1207, 647);
  ctx.strokeStyle = "rgba(245,213,106,0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(48.5, 48.5, 1183, 623);

  // Small bell mark (top right)
  ctx.save();
  ctx.translate(1154, 58);
  ctx.scale(1.15, 1.15);
  const bellGrad = ctx.createLinearGradient(8, 0, 28, 36);
  bellGrad.addColorStop(0, "#fff3c4");
  bellGrad.addColorStop(0.35, "#f0cc5a");
  bellGrad.addColorStop(1, "#b8860b");
  ctx.fillStyle = bellGrad;
  ctx.beginPath();
  ctx.moveTo(16, 6);
  ctx.bezierCurveTo(16, 2.8, 18.4, 0.4, 22, 0.4);
  ctx.bezierCurveTo(25.6, 0.4, 28, 2.8, 28, 6);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, 28);
  ctx.bezierCurveTo(8, 20.6, 11.4, 16.8, 12.2, 11.2);
  ctx.bezierCurveTo(12.6, 8.4, 14.8, 7, 19, 7);
  ctx.lineTo(25, 7);
  ctx.bezierCurveTo(29.2, 7, 31.4, 8.4, 31.8, 11.2);
  ctx.bezierCurveTo(32.6, 16.8, 36, 20.6, 36, 28);
  ctx.closePath();
  ctx.fill();
  roundRect(ctx, 6, 28, 26, 3.4, 0.6);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(19, 34.4, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const cx = 880;
  const display = displayFont();

  ctx.textAlign = "center";
  ctx.fillStyle = "#f5d56a";
  ctx.font = `700 24px ${display}`;
  ctx.fillText("CLOSING BELL", cx, 148);

  ctx.fillStyle = "#a89868";
  ctx.font = `400 16px ${display}`;
  ctx.fillText("JACKPOT", cx, 186);

  ctx.strokeStyle = "rgba(212,160,23,0.45)";
  ctx.beginPath();
  ctx.moveTo(760, 208);
  ctx.lineTo(1000, 208);
  ctx.stroke();

  const gold = ctx.createLinearGradient(cx - 180, 250, cx + 180, 340);
  gold.addColorStop(0, "#ffe9b0");
  gold.addColorStop(0.42, "#f5d56a");
  gold.addColorStop(1, "#c48a12");
  ctx.fillStyle = gold;
  ctx.font = `800 72px ${display}`;
  ctx.fillText(formatGme(amounts.displayPotGme), cx, 318);

  ctx.fillStyle = "#f5d56a";
  ctx.font = `700 22px ${display}`;
  ctx.fillText("GME", cx, 368);

  ctx.fillStyle = "#f7f7f5";
  ctx.font = `500 36px ${display}`;
  ctx.fillText(formatUsdPrecise(amounts.displayPotUsd), cx, 430);

  ctx.fillStyle = "#8d8d88";
  ctx.font = `400 16px ${display}`;
  ctx.fillText(`In pot ${formatGme(amounts.inPotGme)} GME`, cx, 488);
  ctx.fillText(`Accruing ${formatGme(amounts.accruingGme)} GME`, cx, 516);
  ctx.fillText(
    formatPaidOutCardLine(amounts.totalPaidOutGme, amounts.totalPaidOutUsd),
    cx,
    548,
  );

  ctx.font = `400 18px ${display}`;
  ctx.fillText(JACKPOT_SITE_HOST, cx, 628);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))),
      "image/png",
    );
  });
  return blob;
}

function displayFont(): string {
  // Prefer the site display font when loaded; fall back cleanly.
  return '"Archivo", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
}

export async function downloadJackpotSharePng(
  amounts: JackpotCardAmounts,
  filename = "closing-bell-jackpot.png",
): Promise<void> {
  const blob = await renderJackpotSharePng(amounts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
