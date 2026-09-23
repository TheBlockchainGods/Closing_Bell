import type { Pool } from "pg";
import { buildRingReceipt } from "@closing-bell/fairness";

import { config } from "../config.js";
import {
  nextBell,
  previousBell,
  snapshotAtForBell,
  type BellOccurrence,
} from "../clock/market-clock.js";
import { resolveSnapshotBlockhash } from "../chain/blockhash.js";
import {
  buildDrawEntrants,
  drawSeedHex,
  pickWeightedWinner,
  syntheticBlockhash,
  ticketBookToSnapshot,
  totalDrawWeight,
} from "../draw/select.js";
import { DrawStore } from "../draw/store.js";
import type { BellRuntime } from "../runtime/bell-runtime.js";
import type { TelegramBot } from "../telegram/bot.js";
import {
  formatBagLocked,
  formatPayoutFailedAlert,
  formatSkip,
  formatWiped,
} from "../telegram/format.js";
import {
  resolveJackpotPayout,
  sendJackpotPayout,
  type SendJackpotPayout,
} from "./payout.js";
import { skipRingReason } from "./skip.js";
import { totalTickets } from "../tickets/engine.js";

/**
 * Draw keeper: snapshot → (optional) payout → wipe.
 * One settle per windowId. DRY_RUN_PAYOUTS default true.
 */
export class DrawKeeper {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly store: DrawStore;

  constructor(
    private readonly pool: Pool,
    private readonly runtime: BellRuntime,
    private readonly bot: TelegramBot,
    private readonly sendPayout: SendJackpotPayout = sendJackpotPayout,
  ) {
    this.store = new DrawStore(pool);
  }

  start(): void {
    console.log(
      `Draw keeper starting (dryRun=${config.dryRunPayouts}, poll=${config.keeperPollMs}ms)`,
    );
    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, config.keeperPollMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Force a dry-run settle for tests / ops against the current locked bag. */
  async forceSettleForTest(now = new Date()): Promise<void> {
    const upcoming = nextBell(now, config.bells24_7);
    if (!upcoming) return;
    await this.ensureLocked(upcoming, now);
    await this.settle(upcoming, now);
  }

  /** One keeper pass: settle any due/prior unsettled bell, then lock the upcoming bag. */
  async tick(nowInput?: Date): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = nowInput ?? new Date();

      // Option A settle-gate: finish a prior unsettled bell before locking next.
      // - If the prior window is already locked in DB, settle it even past grace
      //   so the bag cannot stick locked across the next snapshot.
      // - If it was never locked, only settle within the grace window (no stale
      //   retro-ring of an unlocked bag).
      const previous = previousBell(now, config.bells24_7);
      if (previous) {
        const priorRow = await this.store.get(this.windowIdFor(previous));
        if (priorRow?.phase === "locked") {
          await this.settle(previous, now);
        } else if (this.dueBell(now)) {
          await this.settle(previous, now);
        }
      }

      const upcoming = nextBell(now, config.bells24_7);
      if (upcoming) {
        const snapAt = snapshotAtForBell(
          upcoming.at,
          config.snapshotLeadSeconds,
        );
        if (now.getTime() >= snapAt.getTime()) {
          await this.ensureLocked(upcoming, now);
        }
      }
    } catch (err) {
      console.error("Draw keeper tick error:", err);
    } finally {
      this.running = false;
    }
  }

  /**
   * Bell that is due to ring. `nextBell` only returns bells strictly after
   * `now`, so the ring must be driven off `previousBell`, which includes a
   * bell landing exactly on `now`. Bells older than the grace window are left
   * alone so a restart cannot retro-ring a stale bag.
   */
  private dueBell(now: Date): BellOccurrence | null {
    const previous = previousBell(now, config.bells24_7);
    if (!previous) return null;
    const lateBy = now.getTime() - previous.at.getTime();
    if (lateBy < 0 || lateBy > config.settleGraceSeconds * 1000) return null;
    return previous;
  }

  private windowIdFor(bell: BellOccurrence): string {
    return `bell-${bell.kind}-${bell.at.toISOString()}`;
  }

  private async ensureLocked(
    bell: BellOccurrence,
    now: Date,
  ): Promise<void> {
    const windowId = this.windowIdFor(bell);
    const existing = await this.store.get(windowId);
    if (existing) {
      if (this.runtime.phase === "open") {
        this.runtime.lockBag({
          windowId,
          bellAt: bell.at,
          blockhash: existing.blockhash ?? syntheticBlockhash(windowId, bell.at),
        });
      }
      return;
    }

    const snapAt = snapshotAtForBell(bell.at, config.snapshotLeadSeconds);
    const blockhash = await resolveSnapshotBlockhash({
      fixtureMode: config.fixtureMode,
      rpcUrl: config.rpcUrl,
      windowId,
      at: snapAt,
    });

    const { inserted } = await this.store.tryLock({
      windowId,
      bellKind: bell.kind,
      bellAt: bell.at,
      snapshotAt: snapAt,
      blockhash,
      carriedWeekend: bell.carriesWeekend,
    });

    this.runtime.lockBag({ windowId, bellAt: bell.at, blockhash });

    if (inserted) {
      const book = this.runtime.snapshot ?? this.runtime.live;
      await this.runtime.refreshPot();
      await this.bot.send(
        formatBagLocked({
          bellLabel: bell.label,
          bellAt: bell.at.toISOString(),
          ticketsOut: totalTickets(book),
          wallets: [...book.values()].filter((w) => w.tickets > 0).length,
          pot: this.runtime.pot(),
        }),
      );
    }
  }

  private async settle(bell: BellOccurrence, now: Date): Promise<void> {
    const windowId = this.windowIdFor(bell);
    const draw = await this.store.get(windowId);
    if (!draw) {
      await this.ensureLocked(bell, now);
    }
    const locked = await this.store.get(windowId);
    if (!locked || locked.phase !== "locked") {
      // Already settled/skipped in DB. If memory is still locked, wipe once.
      if (locked && locked.phase !== "locked" && this.runtime.phase === "locked") {
        this.runtime.wipeAndSettle(bell.at);
      }
      return;
    }

    if (!this.runtime.snapshot) {
      this.runtime.lockBag({
        windowId,
        bellAt: bell.at,
        blockhash: locked.blockhash ?? syntheticBlockhash(windowId, bell.at),
      });
    }

    const pot = await this.runtime.refreshPot();
    const eligibleBook = await this.runtime.eligibleTicketBook();
    const potGme = pot.displayPot;
    const drawBook = eligibleBook;
    const entrants = buildDrawEntrants(
      drawBook,
      config.oddsCapBps,
    );
    const totalWeight = totalDrawWeight(entrants);
    const skip = skipRingReason({
      potGme: config.dryRunPayouts ? potGme : pot.jackpotWalletBalance,
      minPotGme: config.minPotGme,
      totalWeight,
    });

    if (skip === "empty bag") {
      await this.store.markSkipped(windowId, "empty bag", potGme);
      this.runtime.wipeAndSettle(bell.at);
      await this.bot.send(
        formatSkip({
          bellLabel: bell.label,
          reason: "empty bag (totalWeight=0)",
          potGme,
        }),
      );
      await this.bot.send(formatWiped({ windowId }));
      return;
    }

    if (skip) {
      await this.store.markSkipped(windowId, skip, potGme);
      this.runtime.wipeAndSettle(bell.at);
      await this.bot.send(
        formatSkip({
          bellLabel: bell.label,
          reason: `pot ${potGme} GME < MIN_POT_GME ${config.minPotGme}`,
          potGme,
        }),
      );
      await this.bot.send(formatWiped({ windowId }));
      return;
    }

    const seed = drawSeedHex({
      blockhashAtSnapshot:
        locked.blockhash ?? syntheticBlockhash(windowId, bell.at),
      windowId,
      potBalance: potGme,
    });
    const picked = pickWeightedWinner(entrants, seed);
    if (!picked) {
      await this.store.markSkipped(windowId, "no winner", potGme);
      this.runtime.wipeAndSettle(bell.at);
      await this.bot.send(
        formatSkip({
          bellLabel: bell.label,
          reason: "no winner from weighted walk",
          potGme,
        }),
      );
      return;
    }

    if (this.runtime.eoaGate) {
      try {
        await this.runtime.eoaGate.assertEoaWinner(picked.winner.address);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Jackpot skip: ${message}`);
        await this.store.markSkipped(windowId, "contract winner", potGme);
        this.runtime.wipeAndSettle(bell.at);
        await this.bot.send(
          formatSkip({
            bellLabel: bell.label,
            reason: "no winner from weighted walk",
            potGme,
          }),
        );
        return;
      }
    }

    const livePot = config.dryRunPayouts
      ? pot
      : await this.runtime.refreshPot();
    const payableGme = config.dryRunPayouts
      ? potGme
      : livePot.jackpotWalletBalance;
    const payout = await resolveJackpotPayout({
      dryRun: config.dryRunPayouts,
      existingTxHash: locked.txHash,
      existingPhase: locked.phase,
      winner: picked.winner.address as `0x${string}`,
      amountGme: payableGme,
      send: async (input) => {
        if (this.runtime.eoaGate) {
          await this.runtime.eoaGate.assertEoaWinner(input.winner);
        }
        return this.sendPayout(input);
      },
    });
    const txHash = payout.txHash;
    const phase = payout.phase;
    const payoutFailed = phase === "failed";
    const paidAmountGme = phase === "paid" ? payableGme : null;
    const recordedAmountGme = paidAmountGme ?? potGme;

    if (payoutFailed) {
      console.error(
        `Payout failed for ${windowId} (winner recorded, no GME sent):`,
        payout.error ?? "unknown error",
      );
    }

    const updated = await this.store.markSettled({
      windowId,
      phase,
      potGme,
      totalWeight: picked.totalWeight,
      winner: picked.winner.address,
      ticketsAtRing: picked.winner.tickets,
      oddsAtRing: picked.winner.odds,
      txHash,
      dryRun: phase === "dry_run",
      skipReason: payoutFailed
        ? `payout send failed: ${payout.error ?? "unknown error"}`
        : null,
      receiptJson: buildRingReceipt({
        windowId,
        announcedWinner: picked.winner.address,
        blockhashAtSnapshot:
          locked.blockhash ?? syntheticBlockhash(windowId, bell.at),
        potBalance: potGme,
        paidAmountGme,
        oddsCapBps: config.oddsCapBps,
        snapshot: ticketBookToSnapshot(drawBook),
        dryRun: phase === "dry_run",
        txHash,
        ringedAt: bell.at.toISOString(),
      }),
    });

    if (!updated) {
      // Lost race — another worker settled.
      return;
    }

    await this.store.insertWinner({
      id: windowId,
      address: picked.winner.address,
      kind: bell.kind,
      amountGme: recordedAmountGme,
      ticketsAtRing: picked.winner.tickets,
      oddsAtRing: picked.winner.odds,
      ringedAt: bell.at,
      carriedWeekend: bell.carriesWeekend,
      windowId,
      txHash,
      dryRun: phase === "dry_run",
    });

    this.runtime.wipeAndSettle(bell.at);

    await this.bot.announceWin({
      bellLabel: bell.label,
      bellAt: bell.at.toISOString(),
      winner: picked.winner.address,
      odds: picked.winner.odds,
      amountGme: recordedAmountGme,
      amountUsd: recordedAmountGme * pot.gmeUsdPrice,
      ticketsAtRing: picked.winner.tickets,
      dryRun: phase === "dry_run",
      payoutFailed,
      txHash,
      windowId,
    });
    if (payoutFailed) {
      await this.bot.send(
        formatPayoutFailedAlert({
          windowId,
          winner: picked.winner.address,
          amountGme: recordedAmountGme,
          error: payout.error ?? "unknown error",
        }),
      );
    }
    await this.bot.send(formatWiped({ windowId }));
  }
}
