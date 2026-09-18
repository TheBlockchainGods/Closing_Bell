import pg from "pg";

import { config } from "../config.js";

let pool: pg.Pool | null = null;

function isDevPostgresHost(host: string): boolean {
  const h = host.toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "[::1]" ||
    h === "host.docker.internal"
  ) {
    return true;
  }
  // docker compose service names (e.g. "db") have no dots; RDS/Lightsail always do.
  return !h.includes(".");
}

/**
 * Discrete Pool fields, not a URL. pg 8's connection-string parser can drop
 * ssl objects or treat missing sslmode as no TLS. Query params including
 * sslmode are stripped by this parse: Lightsail/RDS require TLS but present a
 * chain Node will not validate, so remote hosts always use
 * `ssl: { rejectUnauthorized: false }` without waiting on DATABASE_SSL_INSECURE.
 */
export function buildPoolConfig(databaseUrl: string): pg.PoolConfig {
  const normalized = databaseUrl.replace(/^postgres(ql)?:\/\//i, "http://");
  const u = new URL(normalized);
  const host = u.hostname || "localhost";
  const port = u.port ? Number(u.port) : 5432;
  const user = u.username ? decodeURIComponent(u.username) : undefined;
  const password = u.password ? decodeURIComponent(u.password) : undefined;
  const database = decodeURIComponent(u.pathname.replace(/^\//, "")) || "closing_bell";
  const isLocal = isDevPostgresHost(host);

  const opts: pg.PoolConfig = { host, port, user, password, database };
  if (!isLocal) {
    opts.ssl = { rejectUnauthorized: false };
  }
  return opts;
}

function connectionConfig(): pg.PoolConfig {
  const opts = buildPoolConfig(config.databaseUrl);
  console.log(
    `db pool: host=${opts.host} db=${opts.database} local=${!opts.ssl} sslObject=${Boolean(opts.ssl)}`,
  );
  return opts;
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool(connectionConfig());
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function waitForDb(retries = 60, delayMs = 2000): Promise<void> {
  const p = getPool();
  let lastError: unknown;
  for (let i = 0; i < retries; i += 1) {
    try {
      await p.query("SELECT 1");
      return;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`waitForDb attempt failed: ${msg}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Database not reachable");
}
