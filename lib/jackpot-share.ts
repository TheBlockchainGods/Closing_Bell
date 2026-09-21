import { LIVE_TOKEN_ADDRESS } from "@/lib/launch";

export const JACKPOT_SHARE_LINK = "https://closingbellonrh.com/#bell-pot";
export const JACKPOT_SITE_URL = "https://closingbellonrh.com";
export const JACKPOT_SITE_HOST = "closingbellonrh.com";
export const JACKPOT_MASCOT_SRC = "/mascot/bellwether-podium.webp";

/** X / social caption hard cap (leave headroom under 280). */
export const SHARE_CAPTION_MAX = 220;

const LINE1 = "$BELL buy-to-win on @RobinhoodApp Chain \u{1F514}";
const LINE3 = "3 jackpots/day \u00B7 24/7 \u00B7 7 days a week";
const LINE4 = JACKPOT_SITE_URL;
const LINE5 = LIVE_TOKEN_ADDRESS;

/** Plain digits (no grouping, no compact K/M). */
export function formatShareDigits(
  value: number,
  maxFractionDigits: number,
): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

function buildCaption(gmeLabel: string, usdLabel: string): string {
  return [
    LINE1,
    `Jackpot: ${gmeLabel} GME (~$${usdLabel})`,
    LINE3,
    LINE4,
    LINE5,
  ].join("\n");
}

/**
 * Bullish share caption with the live jackpot from /pot.
 * Numbers are digits only (no compact K/M, no grouping commas).
 */
export function formatJackpotShareText(gme: number, usd: number): string {
  const gmeLabel = formatShareDigits(gme, 4);
  const usdLabel = formatShareDigits(Math.round(usd), 0);
  const text = buildCaption(gmeLabel, usdLabel);
  if (text.length <= SHARE_CAPTION_MAX) return text;
  const compactGme = formatShareDigits(gme, 2);
  const fallback = buildCaption(compactGme, usdLabel);
  if (fallback.length <= SHARE_CAPTION_MAX) return fallback;
  return fallback.slice(0, SHARE_CAPTION_MAX);
}

export function twitterShareHref(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function telegramShareHref(pageUrl: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}`;
}

/** True only for phone Web Share. Windows desktop Share UI is excluded. */
export function shouldUseNativeShare(input: {
  userAgent: string;
  hasShare: boolean;
}): boolean {
  if (!input.hasShare) return false;
  if (/Windows/i.test(input.userAgent)) return false;
  return /Android|iPhone|iPad|iPod/i.test(input.userAgent);
}

export function canUseNativeShareNow(): boolean {
  if (typeof navigator === "undefined") return false;
  return shouldUseNativeShare({
    userAgent: navigator.userAgent ?? "",
    hasShare: typeof navigator.share === "function",
  });
}
