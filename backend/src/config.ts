import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
loadDotenv({ path: resolve(here, "../.env") });

function envString(name: string, fallback = ""): string {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw.trim();
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number for ${name}: ${raw}`);
  }
  return value;
}

function envInt(name: string, fallback: number): number {
  const value = envNumber(name, fallback);
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer for ${name}, got ${value}`);
  }
  return value;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean for ${name}: ${raw}`);
}

function envAddress(name: string, fallback = ""): string {
  const value = envString(name, fallback);
  if (!value) return "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Invalid address for ${name}: ${value}`);
  }
  return value.toLowerCase();
}

/**
 * Single source of runtime knobs. Change via `.env` + restart.
 * Do not scatter magic numbers elsewhere.
 *
 * Never put marketing/ops/dev fee wallets in publicMeta() or client logs.
 */
export const config = {
  port: envInt("PORT", 8787),
  databaseUrl: envString(
    "DATABASE_URL",
    "postgres://bell:bell@localhost:5432/closing_bell",
  ),
  fixtureMode: envBool("FIXTURE_MODE", true),
  dryRunPayouts: envBool("DRY_RUN_PAYOUTS", true),

  chainId: envInt("CHAIN_ID", 4663),
  rpcUrl: envString("RPC_URL"),
  tokenAddress: envAddress("TOKEN_ADDRESS"),
  curveOrPool: envAddress("CURVE_OR_POOL"),
  jackpotWallet: envAddress(
    "JACKPOT_WALLET",
    "0x1111111111111111111111111111111111111111",
  ),
  gmeTokenAddress: envAddress("GME_TOKEN_ADDRESS"),
  /** Signing key for JACKPOT_WALLET only. Never log this. */
  jackpotPrivateKey: envString("JACKPOT_PRIVATE_KEY"),

  gmeUsdPrice: envNumber("GME_USD_PRICE", 23.18),
  priceFeedUrl: envString("PRICE_FEED_URL"),

  oddsCapBps: envInt("ODDS_CAP_BPS", 1000),
  jackpotShareBps: envInt("JACKPOT_SHARE_BPS", 2000),
  minBuyUsd: envNumber("MIN_BUY_USD", 5),
  ticketsPerUsd: envNumber("TICKETS_PER_USD", 1000),
  minPotGme: envNumber("MIN_POT_GME", 1),
  bells24_7: envBool("BELLS_24_7", true),
  snapshotLeadSeconds: envInt("SNAPSHOT_LEAD_SECONDS", 120),

  ponsClaimableGme: envNumber("PONS_CLAIMABLE_GME", 96.41),
  jackpotWalletBalanceGme: envNumber("JACKPOT_WALLET_BALANCE_GME", 1284.62),

  startBlock: envInt("START_BLOCK", 0),
  indexerPollMs: envInt("INDEXER_POLL_MS", 2000),
  keeperPollMs: envInt("KEEPER_POLL_MS", 1000),

  telegramBotToken: envString("TELEGRAM_BOT_TOKEN"),
  telegramChatId: envString("TELEGRAM_CHAT_ID"),

  get oddsCapFraction() {
    return this.oddsCapBps / 10_000;
  },

  publicMeta() {
    return {
      chainId: this.chainId,
      fixtureMode: this.fixtureMode,
      dryRunPayouts: this.dryRunPayouts,
      tokenAddress: this.tokenAddress || null,
      curveOrPool: this.curveOrPool || null,
      jackpotWallet: this.jackpotWallet || null,
      oddsCapBps: this.oddsCapBps,
      jackpotShareBps: this.jackpotShareBps,
      minBuyUsd: this.minBuyUsd,
      minPotGme: this.minPotGme,
      ticketsPerUsd: this.ticketsPerUsd,
      bells24_7: this.bells24_7,
      snapshotLeadSeconds: this.snapshotLeadSeconds,
    };
  },
} as const;

export type AppConfig = typeof config;
