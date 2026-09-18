import { createPublicClient, http, type Hex } from "viem";

import { syntheticBlockhash } from "../draw/select.js";

export type FetchLatestBlockhash = (rpcUrl: string) => Promise<Hex>;

export async function fetchLatestBlockhash(rpcUrl: string): Promise<Hex> {
  const client = createPublicClient({ transport: http(rpcUrl) });
  const block = await client.getBlock({ blockTag: "latest" });
  if (!block.hash) {
    throw new Error("RPC latest block has no hash");
  }
  return block.hash;
}

/**
 * Bag-lock seed material.
 * Fixture mode always uses syntheticBlockhash (deterministic, no RPC).
 * Live mode (FIXTURE_MODE=false) reads eth_getBlockByNumber latest.
 * If RPC fails, logs loudly and falls back to synthetic so the ring can
 * still publish a receipt. /verify MATCHES the published hash either way.
 */
export async function resolveSnapshotBlockhash(input: {
  fixtureMode: boolean;
  rpcUrl: string;
  windowId: string;
  at: Date;
  fetchLatest?: FetchLatestBlockhash;
}): Promise<Hex> {
  const synthetic = syntheticBlockhash(input.windowId, input.at);
  if (input.fixtureMode) return synthetic;
  if (!input.rpcUrl.trim()) {
    console.error(
      "FIXTURE_MODE=false but RPC_URL is empty. Draw seed using synthetic blockhash (not a chain hash).",
    );
    return synthetic;
  }
  const fetchLatest = input.fetchLatest ?? fetchLatestBlockhash;
  try {
    return await fetchLatest(input.rpcUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `Live snapshot blockhash RPC failed (${message}). Falling back to synthetic blockhash. Receipt will still MATCH /verify against the published hash.`,
    );
    return synthetic;
  }
}
