const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

/** Robinhood Chain explorer (Blockscout). */
export const EXPLORER_TX_PREFIX = "https://robinhoodchain.blockscout.com/tx";

export function explorerTxUrl(txHash: string | null | undefined): string | null {
  const hash = txHash?.trim() ?? "";
  if (!TX_HASH_RE.test(hash)) return null;
  return `${EXPLORER_TX_PREFIX}/${hash}`;
}
