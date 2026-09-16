/**
 * Forces a dry-run lock → draw → wipe against the current fixture bag
 * without waiting for the ET bell. Requires Postgres.
 *
 *   npm run demo:dry-ring
 */
import { config } from "../src/config.js";
import { closePool, getPool, waitForDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { buildAdapters, IndexerService } from "../src/indexer/service.js";
import { BellRuntime } from "../src/runtime/bell-runtime.js";
import { TelegramBot } from "../src/telegram/bot.js";
import { DrawStore } from "../src/draw/store.js";
import {
  buildDrawEntrants,
  drawSeedHex,
  pickWeightedWinner,
  syntheticBlockhash,
  totalDrawWeight,
} from "../src/draw/select.js";
import {
  formatBagLocked,
  formatBuyAnnounce,
  formatRingResult,
  formatWiped,
} from "../src/telegram/format.js";
import { mintTickets, totalTickets, usdSpent } from "../src/tickets/engine.js";
import { createTelegramSender } from "../src/telegram/client.js";
import { nextBell, remainingUntil } from "../src/clock/market-clock.js";

async function main() {
  process.env.DRY_RUN_PAYOUTS = "true";

  await waitForDb();
  await migrate();

  const pool = getPool();
  const runtime = new BellRuntime(config);
  const indexer = new IndexerService(
    pool,
    runtime,
    buildAdapters(),
    BigInt(config.startBlock),
  );
  const tg = createTelegramSender({
    botToken: config.telegramBotToken,
    chatId: config.telegramChatId,
  });
  const store = new DrawStore(pool);

  // Reset fixture cursor so demo re-ingests cleanly when DB is fresh;
  // existing events are idempotent.
  await indexer.replayAll();
  await indexer.pollOnce();

  // Sample buy announce from top ladder wallet (or first live wallet).
  const ladder = runtime.ladder(1);
  if (ladder[0]) {
    const gmeSpent = ladder[0].spentInWindowGme || 5;
    const usd = usdSpent(gmeSpent, config.gmeUsdPrice);
    const minted = mintTickets(usd, config);
    const upcoming = nextBell(new Date(), config.bells24_7);
    await tg.send(
      formatBuyAnnounce({
        wallet: ladder[0].address,
        gmeSpent,
        usdSpent: usd,
        minted: minted || ladder[0].tickets,
        odds: runtime.oddsFor(ladder[0].address),
        pot: runtime.pot(),
        nextBellLabel: upcoming?.label ?? null,
        countdown: upcoming
          ? remainingUntil(upcoming.at, new Date())
          : null,
        ladderRank: 1,
      }),
    );
  }

  const now = new Date();
  const windowId = `demo-${now.toISOString()}`;
  const blockhash = syntheticBlockhash(windowId, now);
  const bell = nextBell(now, config.bells24_7);
  const bellKind = bell?.kind ?? "close";
  const bellAt = bell?.at ?? now;
  const bellLabel = bell?.label ?? "Demo Bell";

  await store.tryLock({
    windowId,
    bellKind,
    bellAt,
    snapshotAt: now,
    blockhash,
    carriedWeekend: bell?.carriesWeekend ?? false,
  });
  runtime.lockBag({ windowId, bellAt, blockhash });

  const book = runtime.snapshot ?? runtime.live;
  await tg.send(
    formatBagLocked({
      bellLabel,
      bellAt: bellAt.toISOString(),
      ticketsOut: totalTickets(book),
      wallets: [...book.values()].filter((w) => w.tickets > 0).length,
      pot: runtime.pot(),
    }),
  );

  const pot = runtime.pot();
  const entrants = buildDrawEntrants(book, config.oddsCapBps);
  const totalWeight = totalDrawWeight(entrants);
  if (totalWeight <= 0) {
    throw new Error("Demo bag is empty — check fixtures / FIXTURE_MODE");
  }

  const seed = drawSeedHex({
    blockhashAtSnapshot: blockhash,
    windowId,
    potBalance: pot.displayPot,
  });
  const picked = pickWeightedWinner(entrants, seed);
  if (!picked) throw new Error("Demo draw produced no winner");

  await store.markSettled({
    windowId,
    phase: "dry_run",
    potGme: pot.displayPot,
    totalWeight: picked.totalWeight,
    winner: picked.winner.address,
    ticketsAtRing: picked.winner.tickets,
    oddsAtRing: picked.winner.odds,
    txHash: null,
    dryRun: true,
  });
  await store.insertWinner({
    id: windowId,
    address: picked.winner.address,
    kind: bellKind,
    amountGme: pot.displayPot,
    ticketsAtRing: picked.winner.tickets,
    oddsAtRing: picked.winner.odds,
    ringedAt: bellAt,
    carriedWeekend: bell?.carriesWeekend ?? false,
    windowId,
    txHash: null,
    dryRun: true,
  });

  runtime.wipeAndSettle(bellAt);

  await tg.send(
    formatRingResult({
      bellLabel,
      winner: picked.winner.address,
      odds: picked.winner.odds,
      amountGme: pot.displayPot,
      ticketsAtRing: picked.winner.tickets,
      dryRun: true,
      txHash: null,
    }),
  );
  await tg.send(formatWiped({ windowId }));

  console.log(
    `Demo dry-run complete. Winner ${picked.winner.address} · ticketsOut now ${totalTickets(runtime.live)}`,
  );
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
