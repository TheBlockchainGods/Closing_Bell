import {
  formatJackpotShareCaption,
  SHARE_CAPTION_MAX as CAPTION_MAX,
} from "@closing-bell/fairness";

import { LIVE_TOKEN_ADDRESS } from "@/lib/launch";

export const JACKPOT_SHARE_LINK = "https://closingbellonrh.com/#bell-pot";
export const JACKPOT_SITE_URL = "https://closingbellonrh.com";
export const JACKPOT_SITE_HOST = "closingbellonrh.com";
export const JACKPOT_MASCOT_SRC = "/mascot/bellwether-podium.webp";

/** X / social caption hard cap (leave headroom under 280). */
export const SHARE_CAPTION_MAX = CAPTION_MAX;

export function formatJackpotShareText(input: {
  jackpotGme: number;
  jackpotUsd: number;
  paidOutGme: number;
  paidOutUsd: number;
}): string {
  return formatJackpotShareCaption({
    jackpotGme: input.jackpotGme,
    jackpotUsd: input.jackpotUsd,
    paidOutGme: input.paidOutGme,
    paidOutUsd: input.paidOutUsd,
    siteUrl: JACKPOT_SITE_URL,
    tokenAddress: LIVE_TOKEN_ADDRESS,
  });
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
