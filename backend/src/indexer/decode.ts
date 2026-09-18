import {
  decodeAbiParameters,
  encodeAbiParameters,
  formatUnits,
  keccak256,
  toEventHash,
  type Hex,
} from "viem";

import {
  CURVE_BUY_EVENT,
  CURVE_BUY_REFUNDED_EVENT,
  CURVE_SELL_EVENT,
  UV4_SWAP_EVENT,
} from "./abi.js";
import type { ChainTradeEvent } from "./types.js";

export interface DecodeAmounts {
  quoteDecimals: number;
  tokenDecimals: number;
}

const DEFAULT_AMOUNTS: DecodeAmounts = {
  quoteDecimals: 18,
  tokenDecimals: 18,
};

function addressFromTopic(topic: Hex | undefined): Hex | null {
  if (!topic || topic.length < 42) return null;
  return `0x${topic.slice(-40)}` as Hex;
}

function amountFromWei(value: bigint, decimals: number): number {
  if (value === 0n) return 0;
  return Number(formatUnits(value, decimals));
}

function absAmount(value: bigint, decimals: number): number {
  const mag = value < 0n ? -value : value;
  return amountFromWei(mag, decimals);
}

/**
 * CurveBuy / CurveSell → ticket trades.
 * Tickets mint to CurveBuy.recipient (wallet that receives $BELL).
 * Tickets burn from CurveSell.seller (wallet that spends $BELL).
 * CurveBuyRefunded is ignored: quoteIn/tokensOut on CurveBuy are the fill.
 */
export function decodePonsCurveLog(
  raw: {
    address: Hex;
    topics: readonly Hex[] | Hex[];
    data: Hex;
    blockNumber: bigint | null;
    logIndex: number | null;
    transactionHash: Hex | null;
    blockTimestamp?: Date;
  },
  amounts: DecodeAmounts = DEFAULT_AMOUNTS,
): ChainTradeEvent | null {
  const topic0 = (raw.topics[0] ?? "").toLowerCase();
  const txHash = (raw.transactionHash ?? "0x").toLowerCase();
  const logIndex = raw.logIndex ?? 0;
  const blockNumber = raw.blockNumber ?? 0n;
  const occurredAt = raw.blockTimestamp ?? new Date(0);

  if (topic0 === toEventHash(CURVE_BUY_REFUNDED_EVENT).toLowerCase()) {
    return null;
  }
  try {
    if (topic0 === toEventHash(CURVE_BUY_EVENT).toLowerCase()) {
      const recipient = addressFromTopic(raw.topics[2] as Hex);
      if (!recipient) return null;
      const [quoteIn, tokensOut] = decodeAbiParameters(
        [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
        raw.data,
      );
      return {
        eventId: `${txHash}:${logIndex}`,
        adapter: "pons-curve",
        txHash,
        logIndex,
        blockNumber,
        kind: "buy",
        wallet: recipient.toLowerCase(),
        gmeAmount: amountFromWei(quoteIn, amounts.quoteDecimals),
        bellAmount: amountFromWei(tokensOut, amounts.tokenDecimals),
        occurredAt,
      };
    }
    if (topic0 === toEventHash(CURVE_SELL_EVENT).toLowerCase()) {
      const seller = addressFromTopic(raw.topics[1] as Hex);
      if (!seller) return null;
      const [tokensIn, quoteOut] = decodeAbiParameters(
        [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
        raw.data,
      );
      return {
        eventId: `${txHash}:${logIndex}`,
        adapter: "pons-curve",
        txHash,
        logIndex,
        blockNumber,
        kind: "sell",
        wallet: seller.toLowerCase(),
        gmeAmount: amountFromWei(quoteOut, amounts.quoteDecimals),
        bellAmount: amountFromWei(tokensIn, amounts.tokenDecimals),
        occurredAt,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function decodePonsCurveLogs(
  logs: Array<Parameters<typeof decodePonsCurveLog>[0]>,
  amounts?: DecodeAmounts,
): ChainTradeEvent[] {
  return logs
    .map((log) => decodePonsCurveLog(log, amounts))
    .filter((row): row is ChainTradeEvent => row !== null)
    .sort((a, b) => {
      if (a.blockNumber === b.blockNumber) return a.logIndex - b.logIndex;
      return a.blockNumber < b.blockNumber ? -1 : 1;
    });
}

/**
 * Uniswap v4 PoolManager Swap.
 * amount0/amount1: positive = pool sent the token (user bought it),
 * negative = pool received it (user sold it).
 * Wallet is Swap.sender (fixture tests set this to the trader).
 */
export function decodeUniswapV4SwapLog(
  raw: {
    address: Hex;
    topics: readonly Hex[] | Hex[];
    data: Hex;
    blockNumber: bigint | null;
    logIndex: number | null;
    transactionHash: Hex | null;
    blockTimestamp?: Date;
  },
  input: {
    tokenAddress: string;
    quoteAddress: string;
    tokenIsCurrency0: boolean;
    amounts?: DecodeAmounts;
  },
): ChainTradeEvent | null {
  const amounts = input.amounts ?? DEFAULT_AMOUNTS;
  const topic0 = (raw.topics[0] ?? "").toLowerCase();
  if (topic0 !== toEventHash(UV4_SWAP_EVENT).toLowerCase()) return null;
  const sender = addressFromTopic(raw.topics[2] as Hex);
  if (!sender) return null;
  try {
    const [amount0, amount1] = decodeAbiParameters(
      [
        { type: "int128" },
        { type: "int128" },
        { type: "uint160" },
        { type: "uint128" },
        { type: "int24" },
        { type: "uint24" },
      ],
      raw.data,
    );
    const tokenDelta = input.tokenIsCurrency0 ? amount0 : amount1;
    const quoteDelta = input.tokenIsCurrency0 ? amount1 : amount0;
    if (tokenDelta === 0n) return null;
    const kind = tokenDelta > 0n ? "buy" : "sell";
    const txHash = (raw.transactionHash ?? "0x").toLowerCase();
    const logIndex = raw.logIndex ?? 0;
    return {
      eventId: `${txHash}:${logIndex}`,
      adapter: "uniswap-v4",
      txHash,
      logIndex,
      blockNumber: raw.blockNumber ?? 0n,
      kind,
      wallet: sender.toLowerCase(),
      gmeAmount: absAmount(quoteDelta, amounts.quoteDecimals),
      bellAmount: absAmount(tokenDelta, amounts.tokenDecimals),
      occurredAt: raw.blockTimestamp ?? new Date(0),
    };
  } catch {
    return null;
  }
}

export function tokenIsCurrency0(token: string, quote: string): boolean {
  return token.toLowerCase() < quote.toLowerCase();
}

/** Uniswap v4 PoolId = keccak256(abi.encode(PoolKey)). */
export function computePoolId(input: {
  token: string;
  quote: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}): Hex {
  const token = input.token.toLowerCase() as Hex;
  const quote = input.quote.toLowerCase() as Hex;
  const [currency0, currency1] =
    token < quote ? [token, quote] : [quote, token];
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [
        currency0,
        currency1,
        input.fee,
        input.tickSpacing,
        input.hooks.toLowerCase() as Hex,
      ],
    ),
  );
}

export function decodeUniswapV4SwapLogs(
  logs: Array<Parameters<typeof decodeUniswapV4SwapLog>[0]>,
  input: Parameters<typeof decodeUniswapV4SwapLog>[1],
): ChainTradeEvent[] {
  return logs
    .map((log) => decodeUniswapV4SwapLog(log, input))
    .filter((row): row is ChainTradeEvent => row !== null)
    .sort((a, b) => {
      if (a.blockNumber === b.blockNumber) return a.logIndex - b.logIndex;
      return a.blockNumber < b.blockNumber ? -1 : 1;
    });
}
