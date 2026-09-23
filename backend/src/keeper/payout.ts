import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { config } from "../config.js";

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
]);

const PAYOUT_TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export type PayoutPhase = "dry_run" | "paid" | "failed";

export type PayoutRuntimeConfig = {
  jackpotPrivateKey: string;
  jackpotWallet: string;
  gmeTokenAddress: string;
  rpcUrl: string;
  chainId: number;
  payoutGasLimit: number | null;
  gmeTokenDecimals: number | null;
};

export type PayoutPublicClient = {
  readContract: (args: {
    address: `0x${string}`;
    abi: typeof erc20Abi;
    functionName: "decimals";
  }) => Promise<number>;
  waitForTransactionReceipt: (args: {
    hash: Hex;
  }) => Promise<{ status: "success" | "reverted" }>;
};

export type PayoutWalletClient = {
  writeContract: (args: {
    address: `0x${string}`;
    abi: typeof erc20Abi;
    functionName: "transfer";
    args: [`0x${string}`, bigint];
    gas?: bigint;
  }) => Promise<Hex>;
};

export type SendJackpotPayout = (input: {
  winner: `0x${string}`;
  amountGme: number;
}) => Promise<{ txHash: string }>;

function payoutConfig(override?: Partial<PayoutRuntimeConfig>): PayoutRuntimeConfig {
  return {
    jackpotPrivateKey: override?.jackpotPrivateKey ?? config.jackpotPrivateKey,
    jackpotWallet: override?.jackpotWallet ?? config.jackpotWallet,
    gmeTokenAddress: override?.gmeTokenAddress ?? config.gmeTokenAddress,
    rpcUrl: override?.rpcUrl ?? config.rpcUrl,
    chainId: override?.chainId ?? config.chainId,
    payoutGasLimit:
      override?.payoutGasLimit !== undefined
        ? override.payoutGasLimit
        : config.payoutGasLimit,
    gmeTokenDecimals:
      override?.gmeTokenDecimals !== undefined
        ? override.gmeTokenDecimals
        : config.gmeTokenDecimals,
  };
}

export function isSuccessfulPayoutTxHash(
  hash: string | null | undefined,
): boolean {
  if (!hash) return false;
  return PAYOUT_TX_HASH_RE.test(hash.trim());
}

/** Convert a GME display amount to token units without float `* 10 ** decimals`. */
export function gmeToTokenAmount(amountGme: number, decimals: number): bigint {
  if (!Number.isFinite(amountGme) || amountGme <= 0) {
    throw new Error("Payout amount rounds to zero");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error(`Invalid token decimals: ${decimals}`);
  }
  let raw = String(amountGme);
  if (/e/i.test(raw)) {
    raw = amountGme.toFixed(decimals);
  }
  const [whole, frac = ""] = raw.split(".");
  const trimmedFrac = frac.slice(0, decimals);
  const normalized = trimmedFrac.length > 0 ? `${whole}.${trimmedFrac}` : whole;
  const amount = parseUnits(normalized, decimals);
  if (amount <= 0n) {
    throw new Error("Payout amount rounds to zero");
  }
  return amount;
}

/**
 * Fail loud at boot when live payouts are misconfigured, or when a key is
 * present but does not match the public jackpot wallet.
 */
export function assertJackpotPayoutConfig(
  cfg: Partial<PayoutRuntimeConfig> & { dryRunPayouts?: boolean } = config,
): void {
  const key = cfg.jackpotPrivateKey ?? "";
  const wallet = (cfg.jackpotWallet ?? "").toLowerCase();
  if (key) {
    const account = privateKeyToAccount(key as Hex);
    if (account.address.toLowerCase() !== wallet) {
      throw new Error(
        "JACKPOT_PRIVATE_KEY does not match JACKPOT_WALLET (public jackpot only)",
      );
    }
  }
  const dryRun = cfg.dryRunPayouts ?? config.dryRunPayouts;
  if (dryRun) return;
  if (!key) {
    throw new Error("DRY_RUN_PAYOUTS=false but JACKPOT_PRIVATE_KEY is not set");
  }
  if (!(cfg.gmeTokenAddress ?? config.gmeTokenAddress)) {
    throw new Error("DRY_RUN_PAYOUTS=false but GME_TOKEN_ADDRESS is not set");
  }
  if (!(cfg.rpcUrl ?? config.rpcUrl)) {
    throw new Error("DRY_RUN_PAYOUTS=false but RPC_URL is not set");
  }
}

function robinhoodChain(rpcUrl: string, chainId: number) {
  return {
    id: chainId,
    name: "robinhood-chain",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as const;
}

/**
 * Send GME from the public jackpot wallet to the winner.
 * Never logs private keys or marketing/fee wallets.
 */
export async function sendJackpotPayout(
  input: {
    winner: `0x${string}`;
    amountGme: number;
  },
  deps?: {
    publicClient?: PayoutPublicClient;
    walletClient?: PayoutWalletClient;
    config?: Partial<PayoutRuntimeConfig>;
    assertEoaWinner?: (address: string) => Promise<void>;
  },
): Promise<{ txHash: Hex }> {
  if (deps?.assertEoaWinner) {
    await deps.assertEoaWinner(input.winner);
  }
  const cfg = payoutConfig(deps?.config);
  if (!cfg.jackpotPrivateKey) {
    throw new Error(
      "DRY_RUN_PAYOUTS=false but JACKPOT_PRIVATE_KEY is not set",
    );
  }
  if (!cfg.gmeTokenAddress) {
    throw new Error("DRY_RUN_PAYOUTS=false but GME_TOKEN_ADDRESS is not set");
  }

  const account = privateKeyToAccount(cfg.jackpotPrivateKey as Hex);
  if (account.address.toLowerCase() !== cfg.jackpotWallet.toLowerCase()) {
    throw new Error(
      "JACKPOT_PRIVATE_KEY does not match JACKPOT_WALLET (public jackpot only)",
    );
  }

  let publicClient = deps?.publicClient;
  let walletClient = deps?.walletClient;
  if (!publicClient || !walletClient) {
    if (!cfg.rpcUrl) {
      throw new Error("DRY_RUN_PAYOUTS=false but RPC_URL is not set");
    }
    const transport = http(cfg.rpcUrl);
    const chain = robinhoodChain(cfg.rpcUrl, cfg.chainId);
    const createdPublic = createPublicClient({
      chain,
      transport,
    });
    const createdWallet = createWalletClient({
      account,
      chain,
      transport,
    });
    publicClient ??= createdPublic as unknown as PayoutPublicClient;
    walletClient ??= createdWallet as unknown as PayoutWalletClient;
  }
  if (!publicClient || !walletClient) {
    throw new Error("Payout RPC clients are missing");
  }

  const token = cfg.gmeTokenAddress as `0x${string}`;
  let decimals = cfg.gmeTokenDecimals;
  if (decimals == null) {
    decimals = Number(
      await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    );
  }
  const amount = gmeToTokenAmount(input.amountGme, decimals);

  const txHash = await walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "transfer",
    args: [input.winner, amount],
    ...(cfg.payoutGasLimit != null
      ? { gas: BigInt(cfg.payoutGasLimit) }
      : {}),
  });

  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    if (receipt.status !== "success") {
      throw new Error(`Payout tx reverted: ${txHash}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/reverted/i.test(message)) {
      throw err instanceof Error ? err : new Error(message);
    }
    // Hash is on-chain (or at least accepted). Do not retry a second transfer.
    console.warn(
      "Payout receipt wait failed; persisting hash without retry:",
      txHash,
      err,
    );
  }

  return { txHash };
}

export async function resolveJackpotPayout(input: {
  dryRun: boolean;
  existingTxHash?: string | null;
  existingPhase?: string | null;
  winner: `0x${string}`;
  amountGme: number;
  send?: SendJackpotPayout;
}): Promise<{
  phase: PayoutPhase;
  txHash: string | null;
  sendCalled: boolean;
  error?: string;
}> {
  if (
    input.existingPhase === "paid" ||
    isSuccessfulPayoutTxHash(input.existingTxHash)
  ) {
    return {
      phase: "paid",
      txHash: (input.existingTxHash ?? "").trim() || null,
      sendCalled: false,
    };
  }
  if (input.dryRun) {
    return { phase: "dry_run", txHash: null, sendCalled: false };
  }
  const send = input.send ?? sendJackpotPayout;
  try {
    const paid = await send({
      winner: input.winner,
      amountGme: input.amountGme,
    });
    return {
      phase: "paid",
      txHash: paid.txHash,
      sendCalled: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      phase: "failed",
      txHash: null,
      sendCalled: true,
      error: message,
    };
  }
}
