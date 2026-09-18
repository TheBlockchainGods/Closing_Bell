/**
 * Indexer cursor is last-processed block (exclusive).
 * Seed at START_BLOCK - 1 so the first poll includes the deploy block.
 * START_BLOCK=0 seeds -1 so block 0 (launchAndBuy in the create tx) is not missed.
 */
export function cursorSeed(startBlock: bigint): bigint {
  return startBlock - 1n;
}

/** Inclusive RPC from-block for a cursor that has already processed `fromBlock`. */
export function rpcFromBlock(fromBlock: bigint): bigint {
  const next = fromBlock + 1n;
  return next < 0n ? 0n : next;
}

/**
 * On boot, never sit ahead of START_BLOCK.
 * A late process that first wrote a tip cursor must rewind so backfill
 * still replays deploy-block / launchAndBuy logs.
 */
export function mergeCursor(
  startBlock: bigint,
  existing: bigint | null,
): bigint {
  const seed = cursorSeed(startBlock);
  if (existing === null) return seed;
  return existing < seed ? existing : seed;
}

/**
 * Decide last_block on process start.
 * Rewind only when START_BLOCK is new or was lowered. Everyday restarts
 * keep the tip cursor so we do not rescan the whole chain.
 */
export function bootCursor(input: {
  startBlock: bigint;
  existingLast: bigint | null;
  existingStart: bigint | null;
}): bigint {
  if (input.existingLast === null) return cursorSeed(input.startBlock);
  const startLowered =
    input.existingStart === null || input.existingStart > input.startBlock;
  if (startLowered) {
    return mergeCursor(input.startBlock, input.existingLast);
  }
  return input.existingLast;
}
