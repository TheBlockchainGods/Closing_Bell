import { formatGme, formatUsd } from "@/lib/format";

export const JACKPOT_SHARE_LINK = "https://closingbellonrh.com/#bell-pot";
export const JACKPOT_SITE_URL = "https://closingbellonrh.com";
export const JACKPOT_SITE_HOST = "closingbellonrh.com";
export const JACKPOT_MASCOT_SRC = "/mascot/bellwether-podium.webp";

/** X / social caption hard cap (leave headroom under 280). */
export const SHARE_CAPTION_MAX = 220;

const LINE1 = "$BELL buy-to-win on @RobinhoodApp Chain \u{1F514}";
const LINE3 = "3 jackpots/day \u00B7 24/7 \u00B7 7 days a week";
const LINE4 = JACKPOT_SITE_URL;

function gmeFormats(gme: number): string[] {
  const out: string[] = [formatGme(gme)];
  const one = gme.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  const whole = gme.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  const compact = gme.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  for (const candidate of [one, whole, compact]) {
    if (!out.includes(candidate)) out.push(candidate);
  }
  return out;
}

function buildCaption(gmeLabel: string, usdLabel: string): string {
  // TODO: after launch, append contract address on a new line after LINE4 (do not invent a CA).
  return [
    LINE1,
    `Jackpot: ${gmeLabel} GME (~${usdLabel})`,
    LINE3,
    LINE4,
  ].join("\n");
}

/**
 * Bullish share caption with live jackpot. Always ≤ SHARE_CAPTION_MAX.
 * USD uses whole dollars by default so long pots stay under the cap.
 */
export function formatJackpotShareText(gme: number, usd: number): string {
  const usdWhole = formatUsd(usd);
  for (const gmeLabel of gmeFormats(gme)) {
    const text = buildCaption(gmeLabel, usdWhole);
    if (text.length <= SHARE_CAPTION_MAX) return text;
  }

  // Last resort: compact both sides.
  const compactGme = gme.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const compactUsd = usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const fallback = buildCaption(compactGme, compactUsd);
  if (fallback.length <= SHARE_CAPTION_MAX) return fallback;
  return fallback.slice(0, SHARE_CAPTION_MAX);
}

export function twitterShareHref(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function telegramShareHref(pageUrl: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}`;
}

export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false;
  }
  if (typeof navigator.canShare !== "function") return false;
  try {
    const probe = new File([new Uint8Array([1])], "probe.png", {
      type: "image/png",
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}
