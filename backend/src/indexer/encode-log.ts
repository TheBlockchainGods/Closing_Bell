import { encodeAbiParameters, pad, toEventHash, type Hex } from "viem";

import {
  CURVE_BUY_EVENT,
  CURVE_BUY_REFUNDED_EVENT,
  CURVE_SELL_EVENT,
  UV4_SWAP_EVENT,
} from "./abi.js";

function topicAddress(address: string): Hex {
  return pad(address.toLowerCase() as Hex, { size: 32 });
}

function topicBytes32(value: Hex): Hex {
  return pad(value, { size: 32 });
}

export function encodeCurveBuyLog(args: {
  buyer: Hex;
  recipient: Hex;
  quoteIn: bigint;
  tokensOut: bigint;
  fee: bigint;
  tax: bigint;
}): { topics: Hex[]; data: Hex } {
  return {
    topics: [
      toEventHash(CURVE_BUY_EVENT),
      topicAddress(args.buyer),
      topicAddress(args.recipient),
    ],
    data: encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [args.quoteIn, args.tokensOut, args.fee, args.tax],
    ),
  };
}

export function encodeCurveSellLog(args: {
  seller: Hex;
  recipient: Hex;
  tokensIn: bigint;
  quoteOut: bigint;
  fee: bigint;
  tax: bigint;
}): { topics: Hex[]; data: Hex } {
  return {
    topics: [
      toEventHash(CURVE_SELL_EVENT),
      topicAddress(args.seller),
      topicAddress(args.recipient),
    ],
    data: encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [args.tokensIn, args.quoteOut, args.fee, args.tax],
    ),
  };
}

export function encodeCurveBuyRefundedLog(args: {
  buyer: Hex;
  refundedQuote: bigint;
}): { topics: Hex[]; data: Hex } {
  return {
    topics: [
      toEventHash(CURVE_BUY_REFUNDED_EVENT),
      topicAddress(args.buyer),
    ],
    data: encodeAbiParameters([{ type: "uint256" }], [args.refundedQuote]),
  };
}

export function encodeUv4SwapLog(args: {
  id: Hex;
  sender: Hex;
  amount0: bigint;
  amount1: bigint;
  sqrtPriceX96?: bigint;
  liquidity?: bigint;
  tick?: number;
  fee?: number;
}): { topics: Hex[]; data: Hex } {
  return {
    topics: [
      toEventHash(UV4_SWAP_EVENT),
      topicBytes32(args.id),
      topicAddress(args.sender),
    ],
    data: encodeAbiParameters(
      [
        { type: "int128" },
        { type: "int128" },
        { type: "uint160" },
        { type: "uint128" },
        { type: "int24" },
        { type: "uint24" },
      ],
      [
        args.amount0,
        args.amount1,
        args.sqrtPriceX96 ?? 1n,
        args.liquidity ?? 0n,
        args.tick ?? 0,
        args.fee ?? 0,
      ],
    ),
  };
}
