import { formatGme, formatUsdPrecise } from "@/lib/format";

export const JACKPOT_SHARE_LINK = "https://closingbellonrh.com/#bell-pot";
export const JACKPOT_SITE_URL = "https://closingbellonrh.com";
export const JACKPOT_SITE_HOST = "closingbellonrh.com";
export const JACKPOT_MASCOT_SRC = "/mascot/bellwether-podium.webp";

export function formatJackpotShareText(gme: number, usd: number): string {
  return `Closing Bell jackpot is live: ${formatGme(gme)} GME (~${formatUsdPrecise(usd)}). ${JACKPOT_SITE_URL}`;
}

export function twitterShareHref(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function telegramShareHref(pageUrl: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}`;
}
