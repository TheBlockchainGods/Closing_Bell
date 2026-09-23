import { parseAbiItem, type AbiEvent, type Hex } from "viem";

/** PONS v2 factory on Robinhood Chain (docs.ponsfamily.com/v2). Not a $BELL CA. */
export const PONS_V2_FACTORY =
  "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as const;
export const PONS_V2_HOOK =
  "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044" as const;
export const UNISWAP_V4_POOL_MANAGER =
  "0x8366a39cc670b4001a1121b8f6a443a643e40951" as const;
/** PONS v2 FeeEscrow on Robinhood Chain (docs.ponsfamily.com/v2). Fallback if factory.feeEscrow() fails. */
export const PONS_V2_FEE_ESCROW =
  "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e" as const;
export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

export function isConfiguredAddress(
  value: string | null | undefined,
): value is Hex {
  if (!value) return false;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return false;
  return value.toLowerCase() !== ZERO_ADDRESS;
}

/** Factory curve wins after launch; CREATE2 predicted curve is used before getLaunchedToken exists. */
export function pickCurveAddress(input: {
  factoryCurve?: string | null;
  predictedCurve?: string | null;
}): Hex | null {
  if (isConfiguredAddress(input.factoryCurve)) return input.factoryCurve;
  if (isConfiguredAddress(input.predictedCurve)) return input.predictedCurve;
  return null;
}

export const CURVE_BUY_EVENT = parseAbiItem(
  "event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)",
);
export const CURVE_SELL_EVENT = parseAbiItem(
  "event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)",
);
export const CURVE_BUY_REFUNDED_EVENT = parseAbiItem(
  "event CurveBuyRefunded(address indexed buyer, uint256 refundedQuote)",
);

export const UV4_SWAP_EVENT = parseAbiItem(
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
);

export const POOL_REGISTERED_EVENT = parseAbiItem(
  "event PoolRegistered(bytes32 indexed poolId, address memecoin, address quoteToken, address creator)",
);

export const CURVE_TRADE_EVENTS: AbiEvent[] = [
  CURVE_BUY_EVENT,
  CURVE_SELL_EVENT,
];

export const GET_LAUNCHED_TOKEN_ABI = [
  {
    type: "function",
    name: "getLaunchedToken",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "curve", type: "address" },
          { name: "deployer", type: "address" },
          { name: "creatorFeeRecipient", type: "address" },
          { name: "pairToken", type: "address" },
          { name: "graduationThreshold", type: "uint256" },
          { name: "poolFee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "creatorTaxBps", type: "uint16" },
          { name: "buybackEnabled", type: "bool" },
          { name: "phase", type: "uint8" },
          { name: "sweptQuote", type: "uint256" },
          { name: "sweptTokens", type: "uint256" },
          { name: "sweptAt", type: "uint256" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
] as const;

export enum LaunchPhase {
  NotGraduated = 0,
  Swept = 1,
  PoolCreated = 2,
  Rescued = 3,
}

export function launchPhaseName(phase: number): string {
  switch (phase) {
    case LaunchPhase.NotGraduated:
      return "NotGraduated";
    case LaunchPhase.Swept:
      return "Swept";
    case LaunchPhase.PoolCreated:
      return "PoolCreated";
    case LaunchPhase.Rescued:
      return "Rescued";
    default:
      return `unknown(${phase})`;
  }
}
