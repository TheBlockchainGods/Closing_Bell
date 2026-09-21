/**
 * Attach the Close 2026-09-21 on-chain GME payout to the published ring.
 * Does not change winner, seed potBalance, snapshot, or formula inputs.
 *
 * Reads DATABASE_URL from lightsail-deployment.json (gitignored). Never prints it.
 *
 *   npx tsx scripts/patch-close-payout.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

import { buildPoolConfig } from "../src/db/client.js";
import { DrawStore } from "../src/draw/store.js";

const WINNER = "0x65050A9b7E5075A2bA5cED7b1b64EE66262c40Dc";
const TX_HASH =
  "0x08ec83a38d49b8d8e225714920298dcfad9ed8c6e2b3be072c14dad7bdce37c9";
const PAID_GME = "8.8582515";
const BELL_KIND = "close";
const BELL_DAY_ET = "2026-09-21";

function databaseUrl(): string {
  const path = resolve(import.meta.dirname, "../lightsail-deployment.json");
  const json = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    { environment?: Record<string, string> }
  >;
  const container = json.api ?? json["closing-bell-api"] ?? Object.values(json)[0];
  const url = container?.environment?.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not found in deployment file");
  const host = url.split("@")[1]?.split(":")[0] ?? "unknown";
  console.log(`target host: ${host}`);
  return url;
}

function short(value: string, left = 10, right = 6): string {
  if (value.length <= left + right + 1) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

async function main(): Promise<void> {
  const pool = new Pool(buildPoolConfig(databaseUrl()));
  const store = new DrawStore(pool);
  try {
    const found = await pool.query(
      `SELECT d.window_id, d.winner, d.pot_gme, d.tx_hash, d.phase, d.dry_run,
              d.receipt_json, w.amount_gme
         FROM draws d
         LEFT JOIN winners w ON w.id = d.window_id OR w.window_id = d.window_id
        WHERE lower(d.winner) = lower($1)
          AND d.bell_kind = $2
          AND (d.bell_at AT TIME ZONE 'America/New_York')::date = $3::date
        ORDER BY d.bell_at DESC
        LIMIT 2`,
      [WINNER, BELL_KIND, BELL_DAY_ET],
    );

    if (found.rowCount !== 1) {
      throw new Error(
        `expected exactly one ${BELL_KIND} draw for ${BELL_DAY_ET} ET with that winner, got ${found.rowCount ?? 0}`,
      );
    }

    const row = found.rows[0] as {
      window_id: string;
      winner: string;
      pot_gme: string | number | null;
      tx_hash: string | null;
      phase: string;
      dry_run: boolean;
      receipt_json: { potBalance?: unknown; announcedWinner?: unknown } | null;
      amount_gme: string | number | null;
    };

    const receiptWinner =
      typeof row.receipt_json?.announcedWinner === "string"
        ? row.receipt_json.announcedWinner
        : null;
    if (
      receiptWinner &&
      receiptWinner.toLowerCase() !== WINNER.toLowerCase()
    ) {
      throw new Error("receipt announcedWinner does not match on-chain winner");
    }

    console.log(
      JSON.stringify({
        windowId: row.window_id,
        winner: short(row.winner),
        phase: row.phase,
        seedPot: row.pot_gme,
        priorPaid: row.amount_gme,
        priorTx: row.tx_hash ? short(row.tx_hash) : null,
      }),
    );

    const patched = await store.recordSettledPayout({
      windowId: row.window_id,
      winner: WINNER,
      paidAmountGme: PAID_GME,
      txHash: TX_HASH,
    });
    if (!patched.ok) {
      throw new Error(patched.reason);
    }

    const after = await pool.query(
      `SELECT d.window_id, d.winner, d.pot_gme, d.tx_hash, d.phase, d.dry_run,
              d.receipt_json, w.amount_gme
         FROM draws d
         LEFT JOIN winners w ON w.id = d.window_id OR w.window_id = d.window_id
        WHERE d.window_id = $1`,
      [row.window_id],
    );
    const next = after.rows[0] as {
      window_id: string;
      winner: string;
      pot_gme: string | number | null;
      tx_hash: string | null;
      phase: string;
      dry_run: boolean;
      receipt_json: {
        potBalance?: unknown;
        paidAmountGme?: unknown;
        announcedWinner?: unknown;
        txHash?: unknown;
      } | null;
      amount_gme: string | number | null;
    };

    console.log(
      JSON.stringify({
        patched: true,
        windowId: next.window_id,
        winner: short(next.winner),
        phase: next.phase,
        dryRun: next.dry_run,
        seedPotUnchanged: next.pot_gme,
        paid: next.amount_gme,
        receiptPaid: next.receipt_json?.paidAmountGme ?? null,
        receiptPot: next.receipt_json?.potBalance ?? null,
        tx: next.tx_hash ? short(next.tx_hash) : null,
      }),
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
