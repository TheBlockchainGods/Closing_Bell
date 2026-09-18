import type { AppConfig } from "../config.js";
import {
  nextBell,
  previousBell,
  remainingUntil,
  snapshotAtForBell,
  type Remaining,
} from "../clock/market-clock.js";
import { computePotDisplay, type PotBreakdown } from "../pot/display.js";
import {
  applyBuy,
  applySell,
  buildLadder,
  cloneBook,
  computeOdds,
  getWallet,
  totalTickets,
  wipeTickets,
  type LadderRow,
  type OddsResult,
  type TicketBook,
} from "../tickets/engine.js";
import type { ChainTradeEvent } from "../indexer/types.js";

export type WindowPhase = "open" | "locked" | "settled";

export interface WinnerRecord {
  id: string;
  address: string;
  kind: string;
  amountGme: number;
  ticketsAtRing: number;
  oddsAtRing: number;
  ringedAt: string;
  carriedWeekend?: boolean;
  txHash?: string | null;
  dryRun?: boolean;
}

export interface WindowSnapshot {
  phase: WindowPhase;
  windowId: string;
  openedAt: string | null;
  nextBell: {
    kind: string;
    label: string;
    at: string;
    carriesWeekend: boolean;
  } | null;
  countdown: Remaining | null;
  snapshotAt: string | null;
  volumeUsd: number;
  volumeGme: number;
  ticketsOut: number;
  snapshotTicketsOut: number | null;
  lockedWindowId: string | null;
}

/**
 * In-memory ticket book + window state.
 * Phase transitions (lock / wipe) are owned by the draw keeper.
 */
export class BellRuntime {
  readonly live: TicketBook = new Map();
  snapshot: TicketBook | null = null;
  phase: WindowPhase = "open";
  volumeUsd = 0;
  volumeGme = 0;
  windowOpenedAt: Date | null = null;
  lastBellAt: Date | null = null;
  lockedWindowId: string | null = null;
  lockedBlockhash: string | null = null;
  winners: WinnerRecord[] = [];
  private settledUntil: Date | null = null;

  constructor(private readonly cfg: AppConfig) {}

  gmeUsdPrice(): number {
    return this.cfg.gmeUsdPrice;
  }

  pot(): PotBreakdown {
    return computePotDisplay({
      jackpotWalletBalance: this.cfg.jackpotWalletBalanceGme,
      ponsClaimable: this.cfg.ponsClaimableGme,
      jackpotShareBps: this.cfg.jackpotShareBps,
      gmeUsdPrice: this.cfg.gmeUsdPrice,
    });
  }

  /**
   * Open the next window after a short settled pause.
   * Does not auto-lock or ring — the keeper owns those transitions.
   */
  tick(now = new Date()): void {
    const prior = previousBell(now, this.cfg.bells24_7);
    if (!this.windowOpenedAt) {
      this.windowOpenedAt = prior?.at ?? now;
      this.lastBellAt = prior?.at ?? null;
    }

    if (this.phase === "settled") {
      if (this.settledUntil && now.getTime() >= this.settledUntil.getTime()) {
        this.phase = "open";
        this.settledUntil = null;
        this.snapshot = null;
        this.lockedWindowId = null;
        this.lockedBlockhash = null;
        this.windowOpenedAt = now;
        this.volumeUsd = 0;
        this.volumeGme = 0;
      }
    }
  }

  lockBag(input: {
    windowId: string;
    bellAt: Date;
    blockhash: string;
  }): void {
    if (this.phase === "locked" && this.lockedWindowId === input.windowId) {
      return;
    }
    this.phase = "locked";
    this.snapshot = cloneBook(this.live);
    this.lockedWindowId = input.windowId;
    this.lockedBlockhash = input.blockhash;
  }

  wipeAndSettle(bellAt: Date, settleHoldMs = 5_000): void {
    wipeTickets(this.live);
    this.snapshot = null;
    this.phase = "settled";
    this.settledUntil = new Date(Date.now() + settleHoldMs);
    this.lastBellAt = bellAt;
    this.volumeUsd = 0;
    this.volumeGme = 0;
    this.lockedWindowId = null;
    this.lockedBlockhash = null;
  }

  applyEvent(event: ChainTradeEvent): {
    applied: boolean;
    minted?: number;
    usd?: number;
    note?: string;
  } {
    if (!this.windowOpenedAt) {
      this.windowOpenedAt = event.occurredAt;
    }

    if (event.kind === "buy") {
      const { minted, usd } = applyBuy(
        this.live,
        event.wallet,
        event.gmeAmount,
        event.bellAmount,
        this.gmeUsdPrice(),
        this.cfg,
      );
      this.volumeGme += Math.max(0, event.gmeAmount);
      this.volumeUsd += usd;
      return {
        applied: true,
        minted,
        usd,
        note: minted > 0 ? `minted ${minted}` : "below min buy",
      };
    }

    const { burned } = applySell(
      this.live,
      event.wallet,
      event.bellAmount,
      event.bellBalanceBefore,
    );
    return { applied: true, note: `burned ${burned}` };
  }

  currentWindow(now = new Date()): WindowSnapshot {
    this.tick(now);
    const upcoming = nextBell(now, this.cfg.bells24_7);
    const snapAt = upcoming
      ? snapshotAtForBell(upcoming.at, this.cfg.snapshotLeadSeconds)
      : null;
    const bookForCounts =
      this.phase === "locked" && this.snapshot ? this.snapshot : this.live;

    return {
      phase: this.phase,
      windowId:
        this.lockedWindowId ??
        (this.windowOpenedAt
          ? `window-${this.windowOpenedAt.toISOString()}`
          : "window-pending"),
      openedAt: this.windowOpenedAt?.toISOString() ?? null,
      nextBell: upcoming
        ? {
            kind: upcoming.kind,
            label: upcoming.label,
            at: upcoming.at.toISOString(),
            carriesWeekend: upcoming.carriesWeekend,
          }
        : null,
      countdown: upcoming ? remainingUntil(upcoming.at, now) : null,
      snapshotAt:
        this.phase === "locked" ? (snapAt?.toISOString() ?? null) : null,
      volumeUsd: round(this.volumeUsd, 6),
      volumeGme: round(this.volumeGme, 6),
      ticketsOut: totalTickets(this.live),
      snapshotTicketsOut:
        this.phase === "locked" ? totalTickets(bookForCounts) : null,
      lockedWindowId: this.lockedWindowId,
    };
  }

  oddsFor(
    address: string,
    now = new Date(),
  ): OddsResult & {
    address: string;
    bellBalance: number;
    spentGme: number;
    spentUsd: number;
    spentInWindowGme: number;
    spentInWindowUsd: number;
  } {
    this.tick(now);
    const book =
      this.phase === "locked" && this.snapshot ? this.snapshot : this.live;
    const wallet = getWallet(book, address);
    const result = computeOdds(
      wallet.tickets,
      totalTickets(book),
      this.cfg.oddsCapBps,
    );
    return {
      address: address.toLowerCase(),
      ...result,
      bellBalance: wallet.bellBalance,
      spentGme: wallet.spentGme,
      spentUsd: wallet.spentUsd,
      spentInWindowGme: wallet.spentGme,
      spentInWindowUsd: wallet.spentUsd,
    };
  }

  ladder(limit = 20, now = new Date()): LadderRow[] {
    this.tick(now);
    const book =
      this.phase === "locked" && this.snapshot ? this.snapshot : this.live;
    return buildLadder(book, this.cfg.oddsCapBps, limit);
  }
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
