import type { PotBreakdown } from "../pot/display.js";
import type { Remaining } from "../clock/market-clock.js";
import type { LadderRow } from "../tickets/engine.js";
import type { OddsResult } from "../tickets/engine.js";

function shortAddr(address: string): string {
  const a = address.toLowerCase();
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
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
    "BUY · tickets minted",
    `Wallet: ${shortAddr(input.wallet)}`,
    `Spent: ${fmtGme(input.gmeSpent)} GME (${fmtUsd(input.usdSpent)})`,
    `Minted: ${input.minted.toLocaleString("en-US")} tickets`,
    `Odds: ${fmtPct(input.odds.odds)}${input.odds.capped ? " (capped)" : ""}`,
  ];
  if (input.ladderRank !== null) {
    lines.push(`Ladder: #${input.ladderRank}`);
  }
  lines.push(
    `Pot: ${fmtGme(input.pot.displayPot)} GME (in ${fmtGme(input.pot.inPot)} + accruing ${fmtGme(input.pot.accruingUnclaimed)})`,
    `Next: ${input.nextBellLabel ?? "n/a"} in ${fmtCountdown(input.countdown)}`,
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
    "BAG LOCKED",
    `Bell: ${input.bellLabel}`,
    `At: ${input.bellAt}`,
    `Tickets: ${input.ticketsOut.toLocaleString("en-US")} across ${input.wallets} wallets`,
    `Pot: ${fmtGme(input.pot.displayPot)} GME display (${fmtGme(input.pot.inPot)} in + ${fmtGme(input.pot.accruingUnclaimed)} accruing)`,
  ].join("\n");
}

export function formatSkip(input: {
  bellLabel: string;
  reason: string;
  potGme: number;
}): string {
  return [
    "RING SKIPPED",
    `Bell: ${input.bellLabel}`,
    `Reason: ${input.reason}`,
    `Pot: ${fmtGme(input.potGme)} GME`,
  ].join("\n");
}

export function formatRingResult(input: {
  bellLabel: string;
  winner: string;
  odds: number;
  amountGme: number;
  ticketsAtRing: number;
  dryRun: boolean;
  txHash: string | null;
}): string {
  const lines = [
    input.dryRun ? "RING · DRY RUN" : "RING · PAID",
    `Bell: ${input.bellLabel}`,
    `Winner: ${shortAddr(input.winner)}`,
    `Odds at ring: ${fmtPct(input.odds)}`,
    `Tickets: ${input.ticketsAtRing.toLocaleString("en-US")}`,
    `Amount: ${fmtGme(input.amountGme)} GME`,
  ];
  if (input.txHash) lines.push(`Tx: ${input.txHash}`);
  if (input.dryRun) lines.push("No GME sent (DRY_RUN_PAYOUTS=true).");
  return lines.join("\n");
}

export function formatWiped(input: { windowId: string }): string {
  return `TICKETS WIPED\nWindow ${input.windowId} is flat. Next window is open.`;
}

export function formatPotCommand(pot: PotBreakdown, jackpotWallet: string): string {
  return [
    "BELL POT",
    `Display: ${fmtGme(pot.displayPot)} GME (${fmtUsd(pot.displayPotUsd)})`,
    `In pot: ${fmtGme(pot.inPot)} GME`,
    `Accruing: ${fmtGme(pot.accruingUnclaimed)} GME`,
    `Jackpot wallet: ${shortAddr(jackpotWallet)}`,
  ].join("\n");
}

export function formatOddsCommand(
  odds: OddsResult & { address: string },
): string {
  if (odds.tickets <= 0) {
    return `ODDS\n${shortAddr(odds.address)}\nNo tickets this window`;
  }
  return [
    "ODDS",
    shortAddr(odds.address),
    `Tickets: ${odds.tickets.toLocaleString("en-US")} / ${odds.totalTickets.toLocaleString("en-US")}`,
    `Share: ${fmtPct(odds.share)}`,
    `Odds: ${fmtPct(odds.odds)}${odds.capped ? " (capped)" : ""}`,
  ].join("\n");
}

export function formatLadderCommand(rows: LadderRow[]): string {
  if (rows.length === 0) return "LADDER\nEmpty this window.";
  const lines = ["LADDER"];
  for (const row of rows.slice(0, 10)) {
    lines.push(
      `#${row.rank} ${shortAddr(row.address)} · ${fmtPct(row.odds)}${row.capped ? "*" : ""} · ${row.tickets.toLocaleString("en-US")} tix`,
    );
  }
  return lines.join("\n");
}

export function formatNextCommand(input: {
  label: string | null;
  at: string | null;
  countdown: Remaining | null;
  phase: string;
}): string {
  return [
    "NEXT BELL",
    `Phase: ${input.phase}`,
    `Bell: ${input.label ?? "n/a"}`,
    `At: ${input.at ?? "n/a"}`,
    `In: ${fmtCountdown(input.countdown)}`,
  ].join("\n");
}
