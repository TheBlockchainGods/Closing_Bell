import pg from "pg";

import { config } from "../config.js";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.databaseUrl });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function waitForDb(retries = 30, delayMs = 1000): Promise<void> {
  const p = getPool();
  let lastError: unknown;
  for (let i = 0; i < retries; i += 1) {
    try {
      await p.query("SELECT 1");
      return;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Database not reachable");
}
