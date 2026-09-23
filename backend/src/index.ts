import { config } from "./config.js";
import { getPool, waitForDb, closePool } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { createEoaGateFromRpc } from "./chain/eoa-gate.js";
import { rpcHost } from "./indexer/rpc-fallback.js";
import { resolveLiveAdapters, IndexerService } from "./indexer/service.js";
import { BellRuntime } from "./runtime/bell-runtime.js";
import { buildServer } from "./api/server.js";
import { TelegramBot } from "./telegram/bot.js";
import { DrawKeeper } from "./keeper/draw-keeper.js";
import { assertJackpotPayoutConfig } from "./keeper/payout.js";
import { PotFeed, livePotInputFromConfig } from "./pot/chain.js";

async function main() {
  console.log(
    `Closing Bell API starting (fixtureMode=${config.fixtureMode}, dryRun=${config.dryRunPayouts}, chainId=${config.chainId})`,
  );

  if (!config.fixtureMode) {
    console.log(
      "FIXTURE_MODE=false: PONS launch adapter will index CurveBuy/CurveSell then UV4 Swap after PoolCreated. Backfill from START_BLOCK (cursor seeds START_BLOCK-1). If tickets stay at 0 after a real buy, check START_BLOCK and curve address, then set FIXTURE_MODE=true to rollback.",
    );
    if (!config.tokenAddress) {
      console.warn(
        "FIXTURE_MODE=false but TOKEN_ADDRESS is empty. Indexer adapters will idle until launch addresses are set.",
      );
    }
    if (!config.rpcUrl) {
      console.warn("RPC_URL is empty; live indexing cannot proceed.");
    } else {
      console.log(
        `Indexer RPC log primary host=${rpcHost(config.rpcFallbackUrl) || "none"} (public RH). Configured RPC_URL host=${rpcHost(config.rpcUrl) || "none"} is pot/payout/seed, not getLogs.`,
      );
    }
  }

  if (!config.dryRunPayouts) {
    console.warn(
      "DRY_RUN_PAYOUTS=false — keeper will send GME from JACKPOT_WALLET on rings.",
    );
  }

  assertJackpotPayoutConfig();

  await waitForDb();
  await migrate();

  const pool = getPool();
  const runtime = new BellRuntime(config);
  runtime.attachPotFeed(new PotFeed(livePotInputFromConfig(config)));
  const eoaGate = createEoaGateFromRpc(config.rpcFallbackUrl);
  runtime.attachEoaGate(eoaGate);
  await runtime.refreshPot();
  const adapters = await resolveLiveAdapters();
  const indexer = new IndexerService(
    pool,
    runtime,
    adapters,
    BigInt(config.startBlock),
    eoaGate,
  );
  const bot = new TelegramBot(runtime);
  const keeper = new DrawKeeper(pool, runtime, bot);

  if (config.telegramAnnounceBuys) {
    indexer.setTradeHandler(async (event) => {
      try {
        await bot.announceBuy(event);
      } catch (err) {
        console.error("Buy announce failed:", err);
      }
    });
  } else {
    console.log(
      "TELEGRAM_ANNOUNCE_BUYS=false: indexer still mints tickets; no per-buy Telegram posts.",
    );
  }

  await indexer.replayAll();
  await indexer.start();
  await bot.start();
  keeper.start();

  const app = buildServer(runtime);
  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`Listening on :${config.port}`);

  const shutdown = async () => {
    console.log("Shutting down…");
    keeper.stop();
    bot.stop();
    indexer.stop();
    await app.close();
    await closePool();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

process.on("unhandledRejection", (err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`unhandledRejection (process stays up): ${message}`);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
