/**
 * Contracts (routers, hooks, pools) must not receive tickets or jackpot GME.
 * Bytecode via eth_getCode is the gate. Denylist is backup only.
 */
import { createPublicClient, http, type Hex } from "viem";

import { PUBLIC_RH_RPC_URL } from "../indexer/rpc-fallback.js";

export const KNOWN_ROUTER_DENYLIST: readonly string[] = [
  "0x7ab338fde039feb0da5a38d90d1a08fff1c31af0",
  "0x8f10b468b06c6fd214b65f87778827f7d113f996",
  "0x65050a9b7e5075a2ba5ced7b1b64ee66262c40dc",
];

const DEFAULT_TTL_MS = 30_000;

export type GetCodeFn = (address: Hex) => Promise<string>;
export type GetTxFromFn = (txHash: Hex) => Promise<string | null>;

export type TicketCreditAction = "eoa" | "unwrap" | "skip";

export interface TicketCredit {
  action: TicketCreditAction;
  /** Wallet that may receive tickets. Null when the fill is skipped. */
  creditWallet: string | null;
  recipient: string;
  txFrom: string | null;
  reason: string;
}

export interface EoaGateStats {
  skips: number;
  unwraps: number;
  drawSkips: number;
  denylist: number;
  cacheSize: number;
}

function normalize(address: string): string {
  return address.trim().toLowerCase();
}

export function codeIsContract(code: string | null | undefined): boolean {
  if (!code) return false;
  const hex = code.trim().toLowerCase();
  if (hex === "" || hex === "0x" || hex === "0x0") return false;
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  return body.length > 0;
}

export class EoaGate {
  private readonly ttlMs: number;
  private readonly denylist: Set<string>;
  private readonly cache = new Map<
    string,
    { contract: boolean; at: number }
  >();
  skips = 0;
  unwraps = 0;
  drawSkips = 0;

  constructor(
    private readonly getCodeFn: GetCodeFn | null,
    private readonly getTxFromFn: GetTxFromFn | null = null,
    opts?: { ttlMs?: number; extraDenylist?: string[] },
  ) {
    this.ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
    this.denylist = new Set(KNOWN_ROUTER_DENYLIST);
    for (const row of opts?.extraDenylist ?? []) {
      if (row) this.denylist.add(normalize(row));
    }
  }

  stats(): EoaGateStats {
    return {
      skips: this.skips,
      unwraps: this.unwraps,
      drawSkips: this.drawSkips,
      denylist: this.denylist.size,
      cacheSize: this.cache.size,
    };
  }

  isDenylisted(address: string): boolean {
    return this.denylist.has(normalize(address));
  }

  /** Sync view: denylist plus cached contracts. Uncached addresses are not excluded. */
  isIneligibleCached(address: string): boolean {
    const key = normalize(address);
    if (this.denylist.has(key)) return true;
    return this.cache.get(key)?.contract === true;
  }

  async isContract(address: string): Promise<boolean> {
    const key = normalize(address);
    if (!/^0x[0-9a-f]{40}$/.test(key)) return false;
    if (this.denylist.has(key)) return true;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.contract;
    let contract = false;
    if (this.getCodeFn) {
      try {
        const code = await this.getCodeFn(key as Hex);
        contract = codeIsContract(code);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`getCode failed for ${key}: ${message}`);
        contract = false;
      }
    }
    this.cache.set(key, { contract, at: Date.now() });
    return contract;
  }

  async creditForTrade(input: {
    recipient: string;
    txHash?: string;
    txFrom?: string | null;
  }): Promise<TicketCredit> {
    const recipient = normalize(input.recipient);
    const recipientContract = await this.isContract(recipient);
    if (!recipientContract) {
      return {
        action: "eoa",
        creditWallet: recipient,
        recipient,
        txFrom: input.txFrom ? normalize(input.txFrom) : null,
        reason: "recipient is EOA",
      };
    }

    let txFrom = input.txFrom ? normalize(input.txFrom) : null;
    if (!txFrom && input.txHash && this.getTxFromFn) {
      try {
        const fetched = await this.getTxFromFn(input.txHash as Hex);
        txFrom = fetched ? normalize(fetched) : null;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`getTransaction.from failed for ${input.txHash}: ${message}`);
      }
    }

    if (txFrom && txFrom !== recipient) {
      const fromIsContract = await this.isContract(txFrom);
      if (!fromIsContract) {
        this.unwraps += 1;
        const reason = `unwrap contract ${recipient} -> EOA ${txFrom}`;
        console.log(`ticket credit: ${reason}`);
        return {
          action: "unwrap",
          creditWallet: txFrom,
          recipient,
          txFrom,
          reason,
        };
      }
    }

    this.skips += 1;
    const reason = txFrom
      ? `skip contract recipient ${recipient} (tx.from also contract ${txFrom})`
      : `skip contract recipient ${recipient} (no EOA tx.from)`;
    console.log(`ticket credit: ${reason}`);
    return {
      action: "skip",
      creditWallet: null,
      recipient,
      txFrom,
      reason,
    };
  }

  async assertEoaWinner(address: string): Promise<void> {
    if (await this.isContract(address)) {
      this.skips += 1;
      const reason = `Winner is a contract; refusing GME send (${normalize(address)})`;
      console.error(`Jackpot skip: ${reason}`);
      throw new Error(reason);
    }
  }

  async eoaTicketBook<T extends { tickets: number }>(
    book: Map<string, T>,
  ): Promise<Map<string, T>> {
    const out = new Map<string, T>();
    for (const [address, row] of book.entries()) {
      if (row.tickets <= 0) continue;
      if (await this.isContract(address)) {
        this.drawSkips += 1;
        console.log(`draw bag: skip contract ticket holder ${address}`);
        continue;
      }
      out.set(address, row);
    }
    return out;
  }
}

export function createEoaGateFromRpc(rpcUrl?: string): EoaGate {
  const url = (rpcUrl ?? "").trim() || PUBLIC_RH_RPC_URL;
  const client = createPublicClient({
    cacheTime: 0,
    transport: http(url),
  });
  return new EoaGate(
    async (address) => {
      const code = await client.request({
        method: "eth_getCode",
        params: [address, "latest"],
      });
      return typeof code === "string" ? code : "0x";
    },
    async (hash) => {
      const tx = await client.getTransaction({ hash });
      return tx.from ?? null;
    },
  );
}
