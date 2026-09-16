import pg from "pg";

import { config } from "../config.js";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS indexer_cursor (
  adapter TEXT PRIMARY KEY,
  last_block BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingested_events (
  event_id TEXT PRIMARY KEY,
  adapter TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('buy', 'sell')),
  wallet TEXT NOT NULL,
  gme_amount NUMERIC NOT NULL,
  bell_amount NUMERIC NOT NULL,
  bell_balance_before NUMERIC,
  occurred_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingested_events_block_idx
  ON ingested_events (block_number, log_index);

CREATE TABLE IF NOT EXISTS winners (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_gme NUMERIC NOT NULL,
  tickets_at_ring BIGINT NOT NULL,
  odds_at_ring DOUBLE PRECISION NOT NULL,
  ringed_at TIMESTAMPTZ NOT NULL,
  carried_weekend BOOLEAN NOT NULL DEFAULT FALSE,
  window_id TEXT,
  tx_hash TEXT,
  dry_run BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS winners_ringed_at_idx ON winners (ringed_at DESC);

CREATE TABLE IF NOT EXISTS draws (
  window_id TEXT PRIMARY KEY,
  bell_kind TEXT NOT NULL,
  bell_at TIMESTAMPTZ NOT NULL,
  phase TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ,
  blockhash TEXT,
  pot_gme NUMERIC,
  total_weight BIGINT,
  winner TEXT,
  tickets_at_ring BIGINT,
  odds_at_ring DOUBLE PRECISION,
  tx_hash TEXT,
  dry_run BOOLEAN NOT NULL DEFAULT TRUE,
  skip_reason TEXT,
  carried_weekend BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);
`;

/** Additive patches for DBs that already ran Phase 1 migrate. */
const PATCHES = [
  `ALTER TABLE winners ADD COLUMN IF NOT EXISTS window_id TEXT`,
  `ALTER TABLE winners ADD COLUMN IF NOT EXISTS tx_hash TEXT`,
  `ALTER TABLE winners ADD COLUMN IF NOT EXISTS dry_run BOOLEAN NOT NULL DEFAULT TRUE`,
  `ALTER TABLE draws ADD COLUMN IF NOT EXISTS receipt_json JSONB`,
];

export async function migrate(databaseUrl = config.databaseUrl): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(SCHEMA_SQL);
    for (const patch of PATCHES) {
      await client.query(patch);
    }
  } finally {
    await client.end();
  }
}

const isDirectRun = process.argv[1]?.includes("migrate");
if (isDirectRun) {
  migrate()
    .then(() => {
      console.log("Migrations applied.");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
