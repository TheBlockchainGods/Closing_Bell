/**
 * Live pot: GME.balanceOf(JACKPOT_WALLET) + JACKPOT_SHARE_BPS of unclaimed
 * PONS creator GME (FeeEscrow + unswept curve/hook). Env stubs override
 * chain only when set.
 */
import {
  createPublicClient,
  formatUnits,
  http,
  parseAbi,
  type Hex,
} from "viem";

import type { AppConfig } from "../config.js";
import {
  GET_LAUNCHED_TOKEN_ABI,
  LaunchPhase,
  PONS_V2_FACTORY,
  PONS_V2_FEE_ESCROW,
  PONS_V2_HOOK,
  isConfiguredAddress,
  pickCurveAddress,
} from "../indexer/abi.js";
import { computePoolId } from "../indexer/decode.js";
import { computePotDisplay, type PotBreakdown } from "./display.js";

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);
const FACTORY_FEE_ESCROW_ABI = parseAbi([
  "function feeEscrow() view returns (address)",
]);
const ESCROW_ABI = parseAbi([
  "function balanceOfToken(address recipient, address token) view returns (uint256)",
]);
const CURVE_FEE_ABI = parseAbi([
  "function quoteFeeBalance() view returns (uint256)",
  "function creatorTaxBalance() view returns (uint256)",
]);
const HOOK_PENDING_ABI = parseAbi([
  "function pendingFees(bytes32 poolId, address currency) view returns (uint256)",
  "function pendingCreatorTax(bytes32 poolId, address currency) view returns (uint256)",
]);

export const POT_CACHE_MS = 5_000;

export type PotReadContract = (args: {
  address: Hex;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}) => Promise<unknown>;

export interface LivePotInput {
  rpcUrl: string;
  gmeTokenAddress: string;
  jackpotWallet: string;
  jackpotShareBps: number;
  gmeUsdPrice: number;
  gmeTokenDecimals: number | null;
  walletOverride: number | null;
  claimableOverride: number | null;
  tokenAddress: string;
  curveOrPool: string;
  factoryAddress: string;
  hookAddress: string;
  feeEscrowAddress: string;
  creatorFeeRecipient: string;
  readContract?: PotReadContract;
}

export interface LaunchFeeView {
  token: Hex;
  curve: Hex;
  pairToken: Hex;
  creatorFeeRecipient: Hex;
  phase: number;
  exists: boolean;
  poolFee: number;
  tickSpacing: number;
}

function asHex(value: string): Hex {
  return value.toLowerCase() as Hex;
}

function weiToGme(wei: bigint, decimals: number): number {
  if (wei <= 0n) return 0;
  return Number(formatUnits(wei, decimals));
}

export function createPotReadContract(rpcUrl: string): PotReadContract {
  const client = createPublicClient({ transport: http(rpcUrl) });
  return async (args) =>
    client.readContract({
      address: args.address,
      abi: args.abi as never,
      functionName: args.functionName as never,
      args: (args.args ?? []) as never,
    });
}

async function readBigint(
  read: PotReadContract,
  address: Hex,
  abi: readonly unknown[],
  functionName: string,
  args: readonly unknown[] = [],
): Promise<bigint> {
  const value = await read({ address, abi, functionName, args });
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(value);
  if (typeof value === "string" && value !== "") return BigInt(value);
  return 0n;
}

async function readAddress(
  read: PotReadContract,
  address: Hex,
  abi: readonly unknown[],
  functionName: string,
  args: readonly unknown[] = [],
): Promise<Hex | null> {
  try {
    const value = await read({ address, abi, functionName, args });
    if (typeof value === "string" && isConfiguredAddress(value)) {
      return value.toLowerCase() as Hex;
    }
  } catch {
    return null;
  }
  return null;
}

export async function resolveFeeEscrow(
  input: LivePotInput,
  read: PotReadContract,
): Promise<Hex | null> {
  if (isConfiguredAddress(input.feeEscrowAddress)) {
    return asHex(input.feeEscrowAddress);
  }
  const factory = isConfiguredAddress(input.factoryAddress)
    ? asHex(input.factoryAddress)
    : PONS_V2_FACTORY;
  const fromFactory = await readAddress(
    read,
    factory,
    FACTORY_FEE_ESCROW_ABI,
    "feeEscrow",
  );
  if (fromFactory) return fromFactory;
  return PONS_V2_FEE_ESCROW;
}

export async function readLaunchFeeView(
  input: LivePotInput,
  read: PotReadContract,
): Promise<LaunchFeeView | null> {
  if (!isConfiguredAddress(input.tokenAddress)) return null;
  const factory = isConfiguredAddress(input.factoryAddress)
    ? asHex(input.factoryAddress)
    : PONS_V2_FACTORY;
  try {
    const row = (await read({
      address: factory,
      abi: GET_LAUNCHED_TOKEN_ABI,
      functionName: "getLaunchedToken",
      args: [asHex(input.tokenAddress)],
    })) as {
      token: Hex;
      curve: Hex;
      pairToken: Hex;
      creatorFeeRecipient: Hex;
      phase: number;
      exists: boolean;
      poolFee: number;
      tickSpacing: number;
    };
    if (!row?.exists) return null;
    return {
      token: row.token,
      curve: row.curve,
      pairToken: row.pairToken,
      creatorFeeRecipient: row.creatorFeeRecipient,
      phase: Number(row.phase),
      exists: true,
      poolFee: Number(row.poolFee),
      tickSpacing: Number(row.tickSpacing),
    };
  } catch {
    return null;
  }
}

function creatorRecipient(
  input: LivePotInput,
  launch: LaunchFeeView | null,
): Hex | null {
  if (isConfiguredAddress(input.creatorFeeRecipient)) {
    return asHex(input.creatorFeeRecipient);
  }
  if (launch && isConfiguredAddress(launch.creatorFeeRecipient)) {
    return asHex(launch.creatorFeeRecipient);
  }
  if (isConfiguredAddress(input.jackpotWallet)) {
    return asHex(input.jackpotWallet);
  }
  return null;
}

export async function fetchWalletGme(
  input: LivePotInput,
  read: PotReadContract,
  decimals: number,
): Promise<number> {
  if (input.walletOverride !== null) return Math.max(0, input.walletOverride);
  if (
    !isConfiguredAddress(input.gmeTokenAddress) ||
    !isConfiguredAddress(input.jackpotWallet)
  ) {
    return 0;
  }
  try {
    const wei = await readBigint(
      read,
      asHex(input.gmeTokenAddress),
      ERC20_ABI,
      "balanceOf",
      [asHex(input.jackpotWallet)],
    );
    return weiToGme(wei, decimals);
  } catch {
    return 0;
  }
}

async function fetchEscrowWei(
  input: LivePotInput,
  read: PotReadContract,
  recipient: Hex,
): Promise<bigint> {
  const escrow = await resolveFeeEscrow(input, read);
  if (!escrow || !isConfiguredAddress(input.gmeTokenAddress)) return 0n;
  try {
    return await readBigint(
      read,
      escrow,
      ESCROW_ABI,
      "balanceOfToken",
      [recipient, asHex(input.gmeTokenAddress)],
    );
  } catch {
    return 0n;
  }
}

async function fetchUnsweptWei(
  input: LivePotInput,
  read: PotReadContract,
  launch: LaunchFeeView | null,
): Promise<bigint> {
  const quote = isConfiguredAddress(input.gmeTokenAddress)
    ? asHex(input.gmeTokenAddress)
    : null;
  if (!quote) return 0n;

  const curve = pickCurveAddress({
    factoryCurve: launch?.curve,
    predictedCurve: input.curveOrPool,
  });
  const phase = launch?.phase ?? LaunchPhase.NotGraduated;
  let unswept = 0n;

  if (curve && phase !== LaunchPhase.PoolCreated) {
    try {
      const quoteFee = await readBigint(
        read,
        curve,
        CURVE_FEE_ABI,
        "quoteFeeBalance",
      );
      const tax = await readBigint(
        read,
        curve,
        CURVE_FEE_ABI,
        "creatorTaxBalance",
      );
      unswept += quoteFee + tax;
    } catch {
      // Curve not deployed yet, or ABI mismatch.
    }
  }

  if (phase === LaunchPhase.PoolCreated && launch) {
    const token = isConfiguredAddress(launch.token)
      ? asHex(launch.token)
      : isConfiguredAddress(input.tokenAddress)
        ? asHex(input.tokenAddress)
        : null;
    if (token) {
      const hook = isConfiguredAddress(input.hookAddress)
        ? asHex(input.hookAddress)
        : PONS_V2_HOOK;
      const poolId = computePoolId({
        token,
        quote,
        fee: launch.poolFee,
        tickSpacing: launch.tickSpacing,
        hooks: hook,
      });
      try {
        const fees = await readBigint(
          read,
          hook,
          HOOK_PENDING_ABI,
          "pendingFees",
          [poolId, quote],
        );
        const tax = await readBigint(
          read,
          hook,
          HOOK_PENDING_ABI,
          "pendingCreatorTax",
          [poolId, quote],
        );
        unswept += fees + tax;
      } catch {
        // Hook pending views unavailable.
      }
    }
  }

  return unswept;
}

export async function fetchPonsClaimableGme(
  input: LivePotInput,
  read: PotReadContract,
  decimals: number,
): Promise<number> {
  if (input.claimableOverride !== null) {
    return Math.max(0, input.claimableOverride);
  }
  const launch = await readLaunchFeeView(input, read);
  const recipient = creatorRecipient(input, launch);
  if (!recipient) return 0;
  const escrow = await fetchEscrowWei(input, read, recipient);
  const unswept = await fetchUnsweptWei(input, read, launch);
  return weiToGme(escrow + unswept, decimals);
}

async function resolveDecimals(
  input: LivePotInput,
  read: PotReadContract,
): Promise<number> {
  if (input.gmeTokenDecimals != null) return input.gmeTokenDecimals;
  if (!isConfiguredAddress(input.gmeTokenAddress)) return 18;
  try {
    const value = await read({
      address: asHex(input.gmeTokenAddress),
      abi: ERC20_ABI,
      functionName: "decimals",
    });
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 36 ? n : 18;
  } catch {
    return 18;
  }
}

export async function fetchLivePot(input: LivePotInput): Promise<PotBreakdown> {
  const empty = computePotDisplay({
    jackpotWalletBalance: input.walletOverride ?? 0,
    ponsClaimable: input.claimableOverride ?? 0,
    jackpotShareBps: input.jackpotShareBps,
    gmeUsdPrice: input.gmeUsdPrice,
  });
  const bothOverridden =
    input.walletOverride !== null && input.claimableOverride !== null;
  if (bothOverridden) return empty;

  const read =
    input.readContract ??
    (input.rpcUrl ? createPotReadContract(input.rpcUrl) : null);
  if (!read) {
    return computePotDisplay({
      jackpotWalletBalance: input.walletOverride ?? 0,
      ponsClaimable: input.claimableOverride ?? 0,
      jackpotShareBps: input.jackpotShareBps,
      gmeUsdPrice: input.gmeUsdPrice,
    });
  }

  const decimals = await resolveDecimals(input, read);
  const [wallet, claimable] = await Promise.all([
    fetchWalletGme(input, read, decimals),
    fetchPonsClaimableGme(input, read, decimals),
  ]);
  return computePotDisplay({
    jackpotWalletBalance: wallet,
    ponsClaimable: claimable,
    jackpotShareBps: input.jackpotShareBps,
    gmeUsdPrice: input.gmeUsdPrice,
  });
}

export function livePotInputFromConfig(
  cfg: AppConfig,
  readContract?: PotReadContract,
): LivePotInput {
  return {
    rpcUrl: cfg.rpcUrl,
    gmeTokenAddress: cfg.gmeTokenAddress,
    jackpotWallet: cfg.jackpotWallet,
    jackpotShareBps: cfg.jackpotShareBps,
    gmeUsdPrice: cfg.gmeUsdPrice,
    gmeTokenDecimals: cfg.gmeTokenDecimals,
    walletOverride: cfg.jackpotWalletBalanceGmeOverride,
    claimableOverride: cfg.ponsClaimableGmeOverride,
    tokenAddress: cfg.tokenAddress,
    curveOrPool: cfg.curveOrPool,
    factoryAddress: cfg.ponsFactoryAddress,
    hookAddress: cfg.ponsHookAddress,
    feeEscrowAddress: cfg.ponsFeeEscrowAddress,
    creatorFeeRecipient: cfg.ponsCreatorFeeRecipient,
    readContract,
  };
}

export class PotFeed {
  private cached: PotBreakdown;
  private cachedAt = 0;
  private warned = false;

  constructor(private readonly input: LivePotInput) {
    this.cached = computePotDisplay({
      jackpotWalletBalance: input.walletOverride ?? 0,
      ponsClaimable: input.claimableOverride ?? 0,
      jackpotShareBps: input.jackpotShareBps,
      gmeUsdPrice: input.gmeUsdPrice,
    });
  }

  snapshot(): PotBreakdown {
    return this.cached;
  }

  async refresh(now = Date.now()): Promise<PotBreakdown> {
    if (now - this.cachedAt < POT_CACHE_MS && this.cachedAt > 0) {
      return this.cached;
    }
    try {
      this.cached = await fetchLivePot(this.input);
      this.cachedAt = now;
    } catch (err) {
      if (!this.warned) {
        this.warned = true;
        console.error("Live pot refresh failed; keeping last snapshot:", err);
      }
    }
    return this.cached;
  }
}
