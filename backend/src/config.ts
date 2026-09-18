import { config as loadDotenv, parse as parseDotenv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
loadDotenv({ path: resolve(here, "../.env") });

const telegramSecretsPath = resolve(here, "../telegram.secrets.env");
if (existsSync(telegramSecretsPath)) {
  const parsed = parseDotenv(readFileSync(telegramSecretsPath));
  for (const [key, value] of Object.entries(parsed)) {
    if (value && value.trim() !== "") {
      process.env[key] = value.trim();
    }
  }
}

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

function envStringAny(names: string[], fallback = ""): string {
  for (const name of names) {
    const value = envString(name);
    if (value) return value;
  }
  return fallback;
}

function envAddressAny(names: string[], fallback = ""): string {
  for (const name of names) {
    const raw = process.env[name];
    if (raw !== undefined && raw.trim() !== "") {
      return envAddress(name);
    }
  }
  return envAddress(names[0], fallback);
}

function envOptionalInt(name: string): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer for ${name}, got ${raw}`);
  }
  return value;
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
  /**
   * Kept so existing Lightsail env still parses. Remote Postgres always uses
   * TLS (`rejectUnauthorized: false`); this flag is not required.
   */
  databaseSslInsecure: envBool("DATABASE_SSL_INSECURE", false),
  fixtureMode: envBool("FIXTURE_MODE", true),
  dryRunPayouts: envBool("DRY_RUN_PAYOUTS", true),

  chainId: envInt("CHAIN_ID", 4663),
  rpcUrl: envStringAny(["RPC_URL", "CHAIN_RPC_URL"]),
  tokenAddress: envAddress("TOKEN_ADDRESS"),
  curveOrPool: envAddress("CURVE_OR_POOL"),
  jackpotWallet: envAddressAny(
    ["JACKPOT_WALLET", "JACKPOT_WALLET_ADDRESS"],
    "0x1111111111111111111111111111111111111111",
  ),
  gmeTokenAddress: envAddress("GME_TOKEN_ADDRESS"),
  /** Signing key for JACKPOT_WALLET only. Never log this. */
  jackpotPrivateKey: envStringAny([
    "JACKPOT_PRIVATE_KEY",
    "JACKPOT_WALLET_PRIVATE_KEY",
  ]),
  /** Blockscout (or other) tx URL prefix, e.g. https://robinhoodchain.blockscout.com/tx */
  explorerTxUrlPrefix: envString("EXPLORER_TX_URL_PREFIX"),
  payoutGasLimit: envOptionalInt("PAYOUT_GAS_LIMIT"),
  /** Fallback if the GME token decimals() call is unavailable. */
  gmeTokenDecimals: envOptionalInt("GME_TOKEN_DECIMALS"),

  gmeUsdPrice: envNumber("GME_USD_PRICE", 23.18),
  priceFeedUrl: envString("PRICE_FEED_URL"),

  oddsCapBps: envInt("ODDS_CAP_BPS", 1000),
  jackpotShareBps: envInt("JACKPOT_SHARE_BPS", 2000),
  minBuyUsd: envNumber("MIN_BUY_USD", 5),
  ticketsPerUsd: envNumber("TICKETS_PER_USD", 1000),
  minPotGme: envNumber("MIN_POT_GME", 1),
  bells24_7: envBool("BELLS_24_7", true),
  snapshotLeadSeconds: envInt("SNAPSHOT_LEAD_SECONDS", 120),
  // How late the keeper may still ring a bell it has not settled. Bounds
  // catch-up after a restart so an outage cannot retro-fire a stale ring.
  settleGraceSeconds: envInt("SETTLE_GRACE_SECONDS", 900),

  ponsClaimableGme: envNumber("PONS_CLAIMABLE_GME", 0),
  jackpotWalletBalanceGme: envNumber("JACKPOT_WALLET_BALANCE_GME", 0),

  startBlock: envInt("START_BLOCK", 0),
  indexerPollMs: envInt("INDEXER_POLL_MS", 2000),
  keeperPollMs: envInt("KEEPER_POLL_MS", 1000),

  telegramBotToken: envString("TELEGRAM_BOT_TOKEN"),
  telegramChatId: envString("TELEGRAM_CHAT_ID"),
  ponsFactoryAddress: envAddress(
    "PONS_FACTORY_ADDRESS",
    "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  ),
  ponsHookAddress: envAddress(
    "PONS_HOOK_ADDRESS",
    "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",
  ),
  uniswapV4PoolManager: envAddress(
    "UNISWAP_V4_POOL_MANAGER",
    "0x8366a39cc670b4001a1121b8f6a443a643e40951",
  ),
  publicSiteUrl: envString(
    "PUBLIC_SITE_URL",
    "https://closingbellonrh.com",
  ),
  publicApiUrl: envString(
    "PUBLIC_API_URL",
    "https://closing-bell-api.qdwgj1kmyrm0a.us-west-2.cs.amazonlightsail.com",
  ),
  xUrl: envString("X_URL", "https://x.com/ClosingBellOnRH"),

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
      settleGraceSeconds: this.settleGraceSeconds,
    };
  },
} as const;

export type AppConfig = typeof config;
