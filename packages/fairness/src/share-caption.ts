/** X / social caption hard cap (leave headroom under 280). */
export const SHARE_CAPTION_MAX = 220;

const LINE1 = "$BELL buy-to-win on @RobinhoodApp Chain \u{1F514}";
const RITUAL = "3 jackpots/day \u00B7 24/7 \u00B7 7 days a week";
const DEFAULT_SITE = "https://closingbellonrh.com";

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

export type JackpotShareCaptionInput = {
  jackpotGme: number;
  jackpotUsd: number;
  paidOutGme: number;
  paidOutUsd: number;
  siteUrl?: string;
  tokenAddress?: string;
};

function paidLine(gme: string, usd: string | null): string {
  if (!usd) return `Paid out: ${gme} GME`;
  return `Paid out: ${gme} GME (~$${usd})`;
}

function buildCaption(input: {
  jackpotGme: string;
  jackpotUsd: string;
  paidGme: string;
  paidUsd: string | null;
  includePaid: boolean;
  siteUrl: string;
  tokenAddress: string;
}): string {
  const lines = [
    LINE1,
    `Jackpot: ${input.jackpotGme} GME (~$${input.jackpotUsd})`,
  ];
  if (input.includePaid) lines.push(paidLine(input.paidGme, input.paidUsd));
  lines.push(RITUAL, input.siteUrl);
  if (input.tokenAddress) lines.push(input.tokenAddress);
  return lines.join("\n");
}

/**
 * Share caption used by the site modal and the Telegram Share jackpot button.
 * Drops the Paid out USD first when the text would pass SHARE_CAPTION_MAX.
 */
export function formatJackpotShareCaption(
  input: JackpotShareCaptionInput,
): string {
  const siteUrl = input.siteUrl?.trim() || DEFAULT_SITE;
  const tokenAddress = input.tokenAddress?.trim() ?? "";
  const jackpotUsd = formatShareDigits(Math.round(input.jackpotUsd), 0);
  const paidUsd = formatShareDigits(Math.round(input.paidOutUsd), 0);

  const attempts: Array<{ gmeDigits: number; paidUsd: boolean; includePaid: boolean }> =
    [
      { gmeDigits: 4, paidUsd: true, includePaid: true },
      { gmeDigits: 4, paidUsd: false, includePaid: true },
      { gmeDigits: 2, paidUsd: false, includePaid: true },
      { gmeDigits: 2, paidUsd: false, includePaid: false },
    ];

  let last = "";
  for (const attempt of attempts) {
    last = buildCaption({
      jackpotGme: formatShareDigits(input.jackpotGme, attempt.gmeDigits),
      jackpotUsd,
      paidGme: formatShareDigits(input.paidOutGme, attempt.gmeDigits),
      paidUsd: attempt.paidUsd ? paidUsd : null,
      includePaid: attempt.includePaid,
      siteUrl,
      tokenAddress,
    });
    if (last.length <= SHARE_CAPTION_MAX) return last;
  }
  return last.slice(0, SHARE_CAPTION_MAX);
}
