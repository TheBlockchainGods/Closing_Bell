/**
 * Read-only draw/ring inspector for incident triage.
 * Reads DATABASE_URL from lightsail-deployment.json (gitignored) and never prints it.
 * Usage: npx tsx scripts/inspect-draws.ts [hoursBack]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

import { buildPoolConfig } from "../src/db/client.js";

const hoursBack = Number(process.argv[2] ?? 48);

function databaseUrl(): string {
  const path = resolve(import.meta.dirname, "../lightsail-deployment.json");
  const json = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    { environment?: Record<string, string> }
  >;
  const container = json.api ?? Object.values(json)[0];
  const url = container?.environment?.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not found in deployment file");
  const host = url.split("@")[1]?.split(":")[0] ?? "unknown";
  console.log(`target host: ${host}`);
  return url;
}

async function main(): Promise<void> {
  const pool = new Pool(buildPoolConfig(databaseUrl()));
  try {
    const draws = await pool.query(
      `SELECT window_id, bell_kind, bell_at, phase, pot_gme, total_weight,
              winner, tx_hash, dry_run, skip_reason, created_at, settled_at
         FROM draws
        WHERE bell_at > NOW() - ($1 || ' hours')::interval
        ORDER BY bell_at ASC`,
      [String(hoursBack)],
    );
    console.log(`draws in last ${hoursBack}h: ${draws.rowCount}`);
    for (const row of draws.rows) {
      console.log(
        JSON.stringify({
          bellAt: new Date(row.bell_at).toISOString(),
          et: new Date(row.bell_at).toLocaleString("en-US", {
            timeZone: "America/New_York",
          }),
          kind: row.bell_kind,
          phase: row.phase,
          pot: row.pot_gme,
          weight: row.total_weight,
          winner: row.winner ? `${String(row.winner).slice(0, 10)}…` : null,
          dryRun: row.dry_run,
          skip: row.skip_reason,
        }),
      );
    }

    const counts = await pool.query(
      `SELECT COUNT(*)::int AS draws,
              (SELECT COUNT(*)::int FROM winners) AS winners,
              (SELECT COUNT(*)::int FROM ingested_events) AS events
         FROM draws`,
    );
    console.log("totals:", JSON.stringify(counts.rows[0]));

    const cursors = await pool.query(
      `SELECT adapter, last_block::text AS last_block, updated_at FROM indexer_cursor`,
    );
    console.log("cursors:", JSON.stringify(cursors.rows));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
