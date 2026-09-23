import { getAddress, isAddress } from "viem";
import { formatJackpotShareCaption } from "@closing-bell/fairness";

import {
  ET_ZONE,
  formatBellClockLine,
  type Remaining,
} from "../clock/market-clock.js";
import type { PotBreakdown } from "../pot/display.js";
import type { LadderRow, OddsResult } from "../tickets/engine.js";
import { explorerTxUrl, type PublicLinkSet } from "./links.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const TRUNCATED_WALLET_RE =
  /0x[0-9a-fA-F]{2,10}(?:…|\.\.\.)[0-9a-fA-F]{2,10}/;
const FULL_WALLET_RE = /0x[a-fA-F0-9]{40}/;

/** Checksummed 0x address. Invalid input is returned trimmed, never invented. */
export function checksumWallet(address: string): string {
  const trimmed = address.trim();
  if (isAddress(trimmed, { strict: false })) return getAddress(trimmed);
  return trimmed;
}

function shortAddrBesideFull(address: string): string {
  const a = checksumWallet(address);
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Copyable full wallet. Short form is never the only form. */
export function walletMono(address: string): string {
  return `<code>${escapeHtml(checksumWallet(address))}</code>`;
}

export function walletCopyBlock(
  address: string,
  opts?: { withShort?: boolean },
): string {
  const full = walletMono(address);
  if (opts?.withShort) {
    return `${escapeHtml(shortAddrBesideFull(address))}\n${full}`;
  }
  return full;
}

function isTruncatedWallet(value: string): boolean {
  return TRUNCATED_WALLET_RE.test(value);
}

/**
 * Fail if a Telegram body shows a truncated wallet without a full
 * checksummed address inside <code> (copy would get the short string).
 */
export function assertTelegramWalletsCopyable(html: string): void {
  const codes = [...html.matchAll(/<code>([^<]*)<\/code>/g)].map((m) =>
    m[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
  );
  for (const code of codes) {
    if (isTruncatedWallet(code)) {
      throw new Error(
        `truncated wallet inside <code> (copy would be short): ${code}`,
      );
    }
  }
  const plain = stripTelegramHtml(html);
  const truncated = plain.match(
    /0x[0-9a-fA-F]{2,10}(?:…|\.\.\.)[0-9a-fA-F]{2,10}/g,
  );
  const fullInCode = codes.filter((code) => FULL_WALLET_RE.test(code));
  if (truncated && truncated.length > 0 && fullInCode.length === 0) {
    throw new Error(
      "truncated wallet without a full copyable <code> address",
    );
  }
  const fullInPlain = plain.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  for (const wallet of fullInPlain) {
    const inCode = codes.some(
      (code) => code.toLowerCase() === wallet.toLowerCase(),
    );
    if (!inCode) {
      throw new Error(`wallet is not copyable <code> text: ${wallet}`);
    }
  }
}

function fmtEtInstant(iso: string | null): string {
  if (!iso) return "n/a";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "n/a";
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${formatted} ET`;
}

function bellTimesLines(bells24_7: boolean): string[] {
  const lines = [
    "<b>Bell times</b>",
    escapeHtml(formatBellClockLine()),
  ];
  if (bells24_7) {
    lines.push(escapeHtml("Bells also ring on weekends (24/7)."));
  }
  return lines;
}

function formatPayoutTxLine(input: {
  txHash: string | null;
  dryRun: boolean;
}): string {
  const hash = input.txHash?.trim() || "";
  if (input.dryRun && hash) {
    return `<b>Payout tx (dry-run)</b>\n<code>${escapeHtml(hash)}</code>`;
  }
  if (input.dryRun) {
    return "<b>Payout tx</b>\nnone (dry-run, no GME sent)";
  }
  if (!hash) {
    return "<b>Payout tx</b>\nnone (payout send failed, pay manually)";
  }
  const url = explorerTxUrl(hash);
  const code = `<code>${escapeHtml(hash)}</code>`;
  if (url) {
    return `<b>Payout tx</b>\n${code}\n${href(url, "View on explorer")}`;
  }
  return `<b>Payout tx</b>\n${code}`;
}

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

function fmtPct(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

function fmtCountdown(c: Remaining | null): string {
  if (!c) return "n/a";
  const parts: string[] = [];
  if (c.days) parts.push(`${c.days}d`);
  parts.push(`${String(c.hours).padStart(2, "0")}h`);
  parts.push(`${String(c.minutes).padStart(2, "0")}m`);
  parts.push(`${String(c.seconds).padStart(2, "0")}s`);
  return parts.join(" ");
}

function fmtCapPct(oddsCapBps: number): string {
  return `${(oddsCapBps / 100).toFixed(0)}%`;
}

function fmtPhase(phase: string): string {
  if (phase === "open") return "open (accruing)";
  if (phase === "locked") return "entries closed for this drawing";
  if (phase === "settled") return "settled";
  return phase;
}

export function formatTicketCutoff(snapshotLeadSeconds: number): string {
  const minutes = Math.max(1, Math.round(snapshotLeadSeconds / 60));
  const mins = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  return `Ticket entries for this jackpot stop ${mins} before the drawing. Buys after that count toward the next jackpot.`;
}

function href(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

function header(emoji: string, title: string): string {
  return `<b>${emoji} ${escapeHtml(title)}</b>`;
}

function linkFooter(links: PublicLinkSet, extra?: Array<[string, string]>): string {
  const rows: string[] = [];
  for (const [label, url] of extra ?? []) {
    if (url) rows.push(href(url, label));
  }
  if (links.siteUrl) rows.push(href(links.siteUrl, "Site"));
  if (links.verifyUrl) rows.push(href(links.verifyUrl, "Verify"));
  if (links.docsUrl) rows.push(href(links.docsUrl, "Docs"));
  if (links.xUrl) rows.push(href(links.xUrl, "X"));
  if (rows.length === 0) return "";
  return `<b>Links</b>\n${rows.join(" · ")}`;
}

/** Slash menu + advertised list. Keep in lockstep with formatCommandList(). */
export const TELEGRAM_SLASH_COMMANDS: Array<{
  command: string;
  description: string;
}> = [
  { command: "pot", description: "Live jackpot in GME and USD" },
  { command: "jackpot", description: "Jackpot pool and next ring" },
  { command: "standings", description: "Jackpot pool (same as /jackpot)" },
  { command: "ladder", description: "Jackpot pool (same as /jackpot)" },
  { command: "odds", description: "Odds for a wallet: /odds 0x..." },
  { command: "next", description: "Next jackpot ring" },
  { command: "how", description: "How the bell works" },
  { command: "verify", description: "Check a published ring" },
  { command: "fairness", description: "How the winner is picked (same as /random)" },
  { command: "random", description: "How the winner is picked (same as /fairness)" },
  { command: "draw", description: "How the winner is picked (same as /fairness)" },
];

/** Full public command set. Use this everywhere the bot lists commands. */
export function formatCommandList(): string {
  return [
    "<b>Commands</b>",
    "Jackpot: /pot · /jackpot · /standings · /ladder (same as /jackpot)",
    "Odds: /odds 0x…",
    "Schedule: /next",
    "How: /how",
    "Fairness: /verify · /fairness · /random · /draw (same as /fairness)",
  ].join("\n");
}

/** One-breath public answer. Never stop at “a person does not pick.” */
export function whoPicksTheWinner(): string {
  return (
    "A person does not pick the winner. The public Closing Bell formula picks one wallet at random from the locked ticket list. Check any ring on /verify."
  );
}

export const WIN_CELEBRATION_MARKER = "WIN CELEBRATION";

export function isWinCelebrationText(text: string): boolean {
  return text.includes(WIN_CELEBRATION_MARKER);
}

export function formatBuyAnnounce(input: {
  wallet: string;
  gmeSpent: number;
  usdSpent: number;
  minted: number;
  odds: OddsResult;
  pot: PotBreakdown;
  nextBellLabel: string | null;
  countdown: Remaining | null;
  ladderRank: number | null;
}): string {
  const lines = [
    header("🟢", "BUY"),
    "",
    `<b>Wallet</b>\n${walletCopyBlock(input.wallet)}`,
    "",
    `<b>Spent</b>\n${escapeHtml(fmtGme(input.gmeSpent))} GME (${escapeHtml(fmtUsd(input.usdSpent))})`,
    "",
    `<b>Tickets</b>\n${escapeHtml(input.minted.toLocaleString("en-US"))} minted`,
    "",
    `<b>Odds</b>\n${escapeHtml(fmtPct(input.odds.odds))}${input.odds.capped ? " (CAP)" : ""}`,
  ];
  if (input.ladderRank !== null) {
    lines.push("", `<b>Pool</b>\n#${input.ladderRank}`);
  }
  lines.push(
    "",
    `<b>Jackpot</b>\n${escapeHtml(fmtGme(input.pot.displayPot))} GME\n${escapeHtml(fmtUsd(input.pot.displayPotUsd))}`,
    "",
    `<b>Next ring</b>\n${escapeHtml(input.nextBellLabel ?? "n/a")}\n${escapeHtml(fmtCountdown(input.countdown))}`,
  );
  return lines.join("\n");
}

export function formatBagLocked(input: {
  bellLabel: string;
  bellAt: string;
  ticketsOut: number;
  wallets: number;
  pot: PotBreakdown;
}): string {
  return [
    header("🔒", "TICKET ENTRIES CLOSED"),
    "",
    `<b>Bell</b>\n${escapeHtml(input.bellLabel)}`,
    "",
    `<b>At</b>\n${escapeHtml(input.bellAt)}`,
    "",
    `<b>Pool</b>\n${escapeHtml(input.ticketsOut.toLocaleString("en-US"))} tickets across ${input.wallets} wallets`,
    "",
    `<b>Jackpot</b>\n${escapeHtml(fmtGme(input.pot.displayPot))} GME\n${escapeHtml(fmtUsd(input.pot.displayPotUsd))}`,
    "",
    "Ticket entries for this drawing have stopped.",
    "Buys from here count toward the next jackpot.",
  ].join("\n");
}

export function formatSkip(input: {
  bellLabel: string;
  reason: string;
  potGme: number;
}): string {
  return [
    header("⏭", "RING SKIPPED"),
    "",
    `<b>Bell</b>\n${escapeHtml(input.bellLabel)}`,
    "",
    `<b>Reason</b>\n${escapeHtml(input.reason)}`,
    "",
    `<b>Jackpot</b>\n${escapeHtml(fmtGme(input.potGme))} GME`,
  ].join("\n");
}

export function formatRingResult(input: {
  bellLabel: string;
  bellAt?: string;
  winner: string;
  odds: number;
  amountGme: number;
  amountUsd?: number;
  ticketsAtRing: number;
  dryRun: boolean;
  txHash: string | null;
  payoutFailed?: boolean;
  links?: PublicLinkSet;
}): string {
  const jackpot =
    input.amountUsd === undefined
      ? `${escapeHtml(fmtGme(input.amountGme))} GME`
      : `${escapeHtml(fmtGme(input.amountGme))} GME\n${escapeHtml(fmtUsd(input.amountUsd))}`;
  const ringTitle = input.dryRun
    ? "RING · DRY RUN"
    : input.payoutFailed
      ? "RING · PAYOUT FAILED"
      : "RING · PAID";
  const lines = [
    header("🔔", ringTitle),
    "",
    `<b>Bell</b>\n${escapeHtml(input.bellLabel)}`,
  ];
  if (input.bellAt) {
    lines.push("", `<b>Time</b>\n${escapeHtml(input.bellAt)}`);
  }
  lines.push(
    "",
    `<b>Jackpot</b>\n${jackpot}`,
    "",
    `<b>Winning wallet</b>\n${walletMono(input.winner)}`,
    "",
    `<b>Odds</b>\n${escapeHtml(fmtPct(input.odds))}`,
    "",
    `<b>Tickets</b>\n${escapeHtml(input.ticketsAtRing.toLocaleString("en-US"))}`,
    "",
    formatPayoutTxLine({ txHash: input.txHash, dryRun: input.dryRun }),
    "",
    escapeHtml(whoPicksTheWinner()),
  );
  if (input.links) {
    const footer = linkFooter(input.links);
    if (footer) lines.push("", footer);
  }
  if (input.dryRun) {
    lines.push("", "Dry run. No GME sent.");
  } else if (input.payoutFailed) {
    lines.push("", "Payout send failed. No GME sent by the bot.");
  }
  return lines.join("\n");
}

export function formatWinCelebration(input: {
  bellLabel: string;
  winner: string;
  amountGme: number;
  amountUsd: number;
  dryRun: boolean;
  verifyUrl: string;
  txHash: string | null;
  payoutFailed?: boolean;
  bells24_7?: boolean;
}): string {
  const lines = [
    header("🔔", WIN_CELEBRATION_MARKER),
    "",
    `<b>Bell</b>\n${escapeHtml(input.bellLabel)}`,
    "",
    `<b>Winning wallet</b>\n${walletMono(input.winner)}`,
    "",
    `<b>Jackpot</b>\n${escapeHtml(fmtGme(input.amountGme))} GME\n${escapeHtml(fmtUsd(input.amountUsd))}`,
    "",
    formatPayoutTxLine({ txHash: input.txHash, dryRun: input.dryRun }),
  ];
  if (input.dryRun) {
    lines.push("", "Dry run. No GME sent.");
  } else if (input.payoutFailed) {
    lines.push("", "Payout send failed. No GME sent by the bot.");
  }
  lines.push(
    "",
    ...bellTimesLines(input.bells24_7 ?? true),
    "",
    escapeHtml(whoPicksTheWinner()),
    "",
    href(input.verifyUrl, "Verify this ring"),
    "",
    formatCommandList(),
  );
  return lines.join("\n");
}

export function formatPayoutFailedAlert(input: {
  windowId: string;
  winner: string;
  amountGme: number;
  error: string;
}): string {
  return [
    header("⚠️", "PAYOUT SEND FAILED"),
    "",
    "Winner is recorded. No GME was sent by the bot. Pay manually.",
    "",
    `<b>Window</b>\n<code>${escapeHtml(input.windowId)}</code>`,
    "",
    `<b>Winning wallet</b>\n${walletMono(input.winner)}`,
    "",
    `<b>Jackpot</b>\n${escapeHtml(fmtGme(input.amountGme))} GME`,
    "",
    `<b>Error</b>\n${escapeHtml(input.error)}`,
  ].join("\n");
}

export function formatWiped(input: { windowId: string }): string {
  return [
    header("♻️", "TICKETS RESET"),
    "",
    `Window ${escapeHtml(input.windowId)} is flat.`,
    "Next window is open.",
  ].join("\n");
}

export function formatPotCommand(
  pot: PotBreakdown,
  jackpotWallet: string,
  links: PublicLinkSet,
  tokenAddress = "",
): string {
  const paidGme = pot.totalPaidOutGme ?? 0;
  const paidUsd =
    pot.totalPaidOutUsd ?? paidGme * (pot.gmeUsdPrice || 0);
  const lines = [
    header("💰", "BELL POT"),
    "",
    `<b>Jackpot</b>\n${escapeHtml(fmtGme(pot.displayPot))} GME\n${escapeHtml(fmtUsd(pot.displayPotUsd))}`,
    "",
    `<b>In pot</b>\n${escapeHtml(fmtGme(pot.inPot))} GME`,
    "",
    `<b>Accruing</b>\n${escapeHtml(fmtGme(pot.accruingUnclaimed))} GME`,
    "",
    `<b>Paid out</b>\n${escapeHtml(fmtGme(paidGme))} GME\n${escapeHtml(fmtUsd(paidUsd))}`,
    "",
    `<b>Wallet</b>\n${walletMono(jackpotWallet)}`,
    "",
    escapeHtml(whoPicksTheWinner()),
  ];
  const ca = checksumWallet(tokenAddress);
  if (/^0x[0-9a-fA-F]{40}$/.test(ca)) {
    lines.push("", `<code>${escapeHtml(ca)}</code>`);
  }
  const footer = linkFooter(links, links.potUrl ? [["View jackpot", links.potUrl]] : []);
  if (footer) lines.push("", footer);
  return lines.join("\n");
}

export function formatPotShareText(
  pot: PotBreakdown,
  tokenAddress = "",
  siteUrl = "https://closingbellonrh.com",
): string {
  const paidGme = pot.totalPaidOutGme ?? 0;
  const paidUsd = pot.totalPaidOutUsd ?? paidGme * (pot.gmeUsdPrice || 0);
  const ca = checksumWallet(tokenAddress);
  return formatJackpotShareCaption({
    jackpotGme: pot.displayPot,
    jackpotUsd: pot.displayPotUsd,
    paidOutGme: paidGme,
    paidOutUsd: paidUsd,
    siteUrl,
    tokenAddress: /^0x[0-9a-fA-F]{40}$/.test(ca) ? ca : "",
  });
}

export function formatOddsCommand(
  odds: OddsResult & { address: string },
  links: PublicLinkSet,
): string {
  const lines = [header("🎯", "ODDS"), "", walletCopyBlock(odds.address)];
  if (odds.tickets <= 0) {
    lines.push("", "No tickets this window.");
  } else {
    lines.push(
      "",
      `<b>Tickets</b>\n${escapeHtml(odds.tickets.toLocaleString("en-US"))} / ${escapeHtml(odds.totalTickets.toLocaleString("en-US"))}`,
      "",
      `<b>Share</b>\n${escapeHtml(fmtPct(odds.share))}`,
      "",
      `<b>Odds</b>\n${escapeHtml(fmtPct(odds.odds))}${odds.capped ? " (CAP)" : ""}`,
    );
  }
  const footer = linkFooter(links, links.oddsUrl ? [["Your Odds", links.oddsUrl]] : []);
  if (footer) lines.push("", footer);
  return lines.join("\n");
}

export function formatOddsUsage(links: PublicLinkSet): string {
  const lines = [
    header("🎯", "ODDS"),
    "",
    "Paste a wallet to read tickets for this jackpot.",
    "",
    "<code>/odds 0x...</code>",
  ];
  const footer = linkFooter(links, links.oddsUrl ? [["Your Odds", links.oddsUrl]] : []);
  if (footer) lines.push("", footer);
  return lines.join("\n");
}

export function formatJackpotCommand(input: {
  rows: LadderRow[];
  pot: PotBreakdown;
  phase: string;
  nextLabel: string | null;
  countdown: Remaining | null;
  snapshotLeadSeconds: number;
  oddsCapBps: number;
  links: PublicLinkSet;
  bells24_7?: boolean;
}): string {
  const capPct = fmtCapPct(input.oddsCapBps);
  const lines = [
    header("🏆", "JACKPOT POOL"),
    "",
    `<b>Phase</b>\n${escapeHtml(fmtPhase(input.phase))}`,
    "",
    `<b>Jackpot</b>\n${escapeHtml(fmtGme(input.pot.displayPot))} GME\n${escapeHtml(fmtUsd(input.pot.displayPotUsd))}`,
    "",
    `<b>Next ring</b>\n${escapeHtml(input.nextLabel ?? "n/a")}\n${escapeHtml(fmtCountdown(input.countdown))}`,
    "",
    ...bellTimesLines(input.bells24_7 ?? true),
    "",
    `<b>Odds cap</b>\n${escapeHtml(capPct)} per wallet (marked CAP)`,
    "",
    "<b>Pool</b>",
  ];
  if (input.rows.length === 0) {
    lines.push(
      "No tickets yet. The pool is empty until $BELL is live and qualifying buys mint tickets.",
      "",
      formatCommandList(),
    );
  } else {
    for (const row of input.rows.slice(0, 10)) {
      const cap = row.capped ? " CAP" : "";
      lines.push(
        `${row.rank}. ${walletCopyBlock(row.address, { withShort: true })}`,
        `${escapeHtml(fmtPct(row.odds))}${cap} · ${escapeHtml(row.tickets.toLocaleString("en-US"))} tickets`,
      );
    }
  }
  lines.push(
    "",
    "<b>Entries</b>",
    escapeHtml(formatTicketCutoff(input.snapshotLeadSeconds)),
    "",
    escapeHtml(whoPicksTheWinner()),
  );
  const footer = linkFooter(
    input.links,
    input.links.potUrl ? [["View jackpot", input.links.potUrl]] : [],
  );
  if (footer) lines.push("", footer);
  return lines.join("\n");
}

export function formatLadderRedirect(): string {
  return [
    header("🏆", "JACKPOT POOL"),
    "",
    "Use /jackpot for the jackpot pool.",
  ].join("\n");
}

export function formatNextCommand(input: {
  label: string | null;
  at: string | null;
  countdown: Remaining | null;
  phase: string;
  pot: PotBreakdown;
  links: PublicLinkSet;
  bells24_7?: boolean;
}): string {
  const lines = [
    header("⏳", "NEXT JACKPOT RING"),
    "",
    `<b>Phase</b>\n${escapeHtml(fmtPhase(input.phase))}`,
    "",
    `<b>Bell</b>\n${escapeHtml(input.label ?? "n/a")}`,
    "",
    `<b>When</b>\n${escapeHtml(fmtEtInstant(input.at))}\n${escapeHtml(fmtCountdown(input.countdown))}`,
    "",
    ...bellTimesLines(input.bells24_7 ?? true),
    "",
    `<b>Jackpot</b>\n${escapeHtml(fmtGme(input.pot.displayPot))} GME\n${escapeHtml(fmtUsd(input.pot.displayPotUsd))}`,
  ];
  const extra: Array<[string, string]> = [];
  if (input.links.countdownUrl) extra.push(["Countdown", input.links.countdownUrl]);
  if (input.links.potUrl) extra.push(["View jackpot", input.links.potUrl]);
  const footer = linkFooter(input.links, extra);
  if (footer) lines.push("", footer);
  return lines.join("\n");
}

export function formatHowCommand(input: {
  minBuyUsd: number;
  ticketsPerUsd: number;
  oddsCapBps: number;
  snapshotLeadSeconds: number;
  links: PublicLinkSet;
  bells24_7?: boolean;
}): string {
  const capPct = fmtCapPct(input.oddsCapBps);
  const bells24_7 = input.bells24_7 ?? true;
  const lines = [
    header("🔔", "HOW THE BELL WORKS"),
    "",
    `<b>1.</b> Buy $BELL with GME, however you buy.`,
    "",
    `<b>2.</b> Qualifying buys (from $${input.minBuyUsd}) mint ${input.ticketsPerUsd.toLocaleString("en-US")} tickets per USD. Odds cap ${capPct} per wallet.`,
    "",
    `<b>3.</b> Fees fill the jackpot. Paid in GME.`,
    "",
    `<b>4.</b> 3 jackpots a day. One wallet wins.`,
    "",
    ...bellTimesLines(bells24_7),
    "",
    "<b>Entries</b>",
    escapeHtml(formatTicketCutoff(input.snapshotLeadSeconds)),
    "",
    "<b>Sells</b>",
    "Selling burns tickets.",
    "",
    "<b>Winner</b>",
    escapeHtml(whoPicksTheWinner()),
    "",
    linkFooter(input.links),
    "",
    formatCommandList(),
  ];
  return lines.join("\n");
}

export function formatVerifyCommand(links: PublicLinkSet): string {
  const lines = [
    header("✅", "VERIFY"),
    "",
    "Check a published ring yourself. No JSON paste in Telegram.",
    "",
    "<b>What it does</b>",
    "Shows the winning wallet, the ticket list from when entries stopped, and public formula closing-bell-draw-v1.",
    "",
    "<b>Match</b>",
    "Match means the announced wallet is the one the formula picks.",
    "",
    escapeHtml(whoPicksTheWinner()),
  ];
  const extra: Array<[string, string]> = [];
  if (links.verifyUrl) extra.push(["Open Verify", links.verifyUrl]);
  const footer = linkFooter(links, extra);
  if (footer) lines.push("", footer);
  return lines.join("\n");
}

export function formatFairnessCommand(links: PublicLinkSet): string {
  const site = links.siteUrl || "https://closingbellonrh.com";
  const verify = links.verifyUrl || `${site}/verify`;
  const docs = links.docsUrl || `${site}/docs`;
  return [
    header("⚖️", "FAIRNESS"),
    "",
    "<b>Summary</b>",
    "",
    escapeHtml(whoPicksTheWinner()),
    "",
    "Same list + same formula -> same wallet.",
    "",
    "Formula id: closing-bell-draw-v1.",
    "",
    "<b>Links</b>",
    "",
    `Verify\n${href(verify, verify)}`,
    "",
    `Docs\n${href(docs, docs)}`,
    "",
    `Site\n${href(site, site)}`,
    "",
    "<b>Technical</b>",
    "",
    "<b>App</b>",
    "Node.js + TypeScript keeper (draw service).",
    "",
    "<b>Host</b>",
    "Amazon Web Services (Lightsail container).",
    "",
    "<b>Math</b>",
    "Shared packages/fairness. Formula id closing-bell-draw-v1.",
    "",
    "<b>Seed</b>",
    "keccak256 over public inputs (snapshot blockhash material, window id, pot balance).",
    "",
    "<b>Pick</b>",
    "Weighted walk over the locked ticket snapshot. The 10% odds cap applies to draw weight only.",
    "",
    "<b>Proof</b>",
    "Same function as site /verify. MATCH means the receipt matches the formula.",
    "",
    "<b>Scope</b>",
    "We do not claim on-chain VRF. We claim a public formula you can recompute.",
  ].join("\n");
}

export const FAIRNESS_PIN_MARKER = "How the jackpot is chosen";
export const FAIRNESS_PIN_LEGACY_MARKER = "How to verify fairness";

export function isFairnessPinText(text: string): boolean {
  return (
    text.includes(FAIRNESS_PIN_MARKER) ||
    text.includes(FAIRNESS_PIN_LEGACY_MARKER)
  );
}

export function formatFairnessPin(
  links: PublicLinkSet,
  snapshotLeadSeconds = 120,
  bells24_7 = true,
): string {
  const lines = [
    header("⚖️", FAIRNESS_PIN_MARKER),
    "",
    "One winning wallet per ring.",
    "",
    ...bellTimesLines(bells24_7),
    "",
    escapeHtml(formatTicketCutoff(snapshotLeadSeconds)),
    "",
    "When entries stop, the full list of wallets and ticket counts is saved for that drawing.",
    "",
    escapeHtml(whoPicksTheWinner()),
    "",
    formatCommandList(),
  ];
  const extra: Array<[string, string]> = [];
  if (links.verifyUrl) extra.push(["Verify", links.verifyUrl]);
  const footer = linkFooter(links, extra);
  if (footer) lines.push("", footer);
  return lines.join("\n");
}

export function formatBotLive(_input?: {
  fixtureMode: boolean;
  dryRun: boolean;
}): string {
  return [
    header("🔔", "Closing Bell bot is live"),
    "",
    formatCommandList(),
  ].join("\n");
}

export function stripTelegramHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
