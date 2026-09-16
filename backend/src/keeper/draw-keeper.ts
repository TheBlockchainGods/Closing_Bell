import type { Pool } from "pg";
import { buildRingReceipt } from "@closing-bell/fairness";

import { config } from "../config.js";
import {
  nextBell,
  snapshotAtForBell,
  type BellOccurrence,
} from "../clock/market-clock.js";
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
  formatRingResult,
  formatSkip,
  formatWiped,
} from "../telegram/format.js";
import { sendJackpotPayout } from "./payout.js";
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

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const upcoming = nextBell(now, config.bells24_7);
      if (!upcoming) return;

      const snapAt = snapshotAtForBell(
        upcoming.at,
        config.snapshotLeadSeconds,
      );

      if (now.getTime() >= snapAt.getTime()) {
        await this.ensureLocked(upcoming, now);
      }

      if (now.getTime() >= upcoming.at.getTime()) {
        await this.settle(upcoming, now);
      }
    } catch (err) {
      console.error("Draw keeper tick error:", err);
    } finally {
      this.running = false;
    }
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
    const blockhash = config.fixtureMode
      ? syntheticBlockhash(windowId, snapAt)
      : syntheticBlockhash(windowId, snapAt);
    // Live path can later replace with eth_getBlockByNumber hash at snapshot.

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

    const pot = this.runtime.pot();
    const potGme = pot.displayPot;
    const entrants = buildDrawEntrants(
      this.runtime.snapshot ?? this.runtime.live,
      config.oddsCapBps,
    );
    const totalWeight = totalDrawWeight(entrants);

    if (totalWeight === 0) {
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

    if (potGme < config.minPotGme) {
      await this.store.markSkipped(
        windowId,
        `pot below MIN_POT_GME (${config.minPotGme})`,
        potGme,
      );
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

    let txHash: string | null = null;
    let phase: "dry_run" | "paid" | "failed" = "dry_run";

    if (config.dryRunPayouts) {
      phase = "dry_run";
    } else {
      try {
        const paid = await sendJackpotPayout({
          winner: picked.winner.address as `0x${string}`,
          amountGme: pot.inPot,
        });
        txHash = paid.txHash;
        phase = "paid";
      } catch (err) {
        console.error("Payout failed (no double-pay; leaving draw locked):", err);
        // Do not wipe or mark paid — retry next tick while still locked.
        return;
      }
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
      receiptJson: buildRingReceipt({
        windowId,
        announcedWinner: picked.winner.address,
        blockhashAtSnapshot:
          locked.blockhash ?? syntheticBlockhash(windowId, bell.at),
        potBalance: potGme,
        oddsCapBps: config.oddsCapBps,
        snapshot: ticketBookToSnapshot(
          this.runtime.snapshot ?? this.runtime.live,
        ),
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
      amountGme: potGme,
      ticketsAtRing: picked.winner.tickets,
      oddsAtRing: picked.winner.odds,
      ringedAt: bell.at,
      carriedWeekend: bell.carriesWeekend,
      windowId,
      txHash,
      dryRun: phase === "dry_run",
    });

    this.runtime.wipeAndSettle(bell.at);

    await this.bot.send(
      formatRingResult({
        bellLabel: bell.label,
        winner: picked.winner.address,
        odds: picked.winner.odds,
        amountGme: potGme,
        ticketsAtRing: picked.winner.tickets,
        dryRun: phase === "dry_run",
        txHash,
      }),
    );
    await this.bot.send(formatWiped({ windowId }));
  }
}
