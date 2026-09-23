import { describe, expect, it, vi } from "vitest";
import { parseUnits, type Hex } from "viem";

import { formatWinCelebration, checksumWallet, whoPicksTheWinner } from "../src/telegram/format.js";
import {
  assertJackpotPayoutConfig,
  gmeToTokenAmount,
  resolveJackpotPayout,
  sendJackpotPayout,
  type PayoutPublicClient,
  type PayoutWalletClient,
} from "../src/keeper/payout.js";

const ANVIL_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ANVIL_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const GME_TOKEN = "0x2222222222222222222222222222222222222222";
const WINNER = "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137" as `0x${string}`;
const TX_HASH =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;

const payoutCfg = {
  jackpotPrivateKey: ANVIL_KEY,
  jackpotWallet: ANVIL_WALLET,
  gmeTokenAddress: GME_TOKEN,
  rpcUrl: "http://127.0.0.1:8545",
  chainId: 4663,
  payoutGasLimit: null as number | null,
  gmeTokenDecimals: null as number | null,
};

function mockClients(opts?: {
  decimals?: number;
  status?: "success" | "reverted";
  waitError?: Error;
}) {
  const writeContract = vi.fn(async () => TX_HASH);
  const waitForTransactionReceipt = vi.fn(async () => {
    if (opts?.waitError) throw opts.waitError;
    return { status: opts?.status ?? "success" as const };
  });
  const readContract = vi.fn(async () => opts?.decimals ?? 18);
  const publicClient: PayoutPublicClient = {
    readContract,
    waitForTransactionReceipt,
  };
  const walletClient: PayoutWalletClient = { writeContract };
  return { publicClient, walletClient, writeContract, waitForTransactionReceipt };
}

describe("gmeToTokenAmount", () => {
  it("converts 1284.62 at 18 decimals without float rounding", () => {
    expect(gmeToTokenAmount(1284.62, 18)).toBe(parseUnits("1284.62", 18));
  });
});

describe("assertJackpotPayoutConfig", () => {
  it("allows dry-run with no key", () => {
    expect(() =>
      assertJackpotPayoutConfig({
        dryRunPayouts: true,
        jackpotPrivateKey: "",
        jackpotWallet: ANVIL_WALLET,
      }),
    ).not.toThrow();
  });

  it("fails live payouts when the key is missing", () => {
    expect(() =>
      assertJackpotPayoutConfig({
        dryRunPayouts: false,
        jackpotPrivateKey: "",
        jackpotWallet: ANVIL_WALLET,
        gmeTokenAddress: GME_TOKEN,
        rpcUrl: "http://127.0.0.1:8545",
      }),
    ).toThrow(/JACKPOT_PRIVATE_KEY is not set/);
  });

  it("fails when the key does not match the public jackpot wallet", () => {
    expect(() =>
      assertJackpotPayoutConfig({
        dryRunPayouts: true,
        jackpotPrivateKey: ANVIL_KEY,
        jackpotWallet: "0x1111111111111111111111111111111111111111",
      }),
    ).toThrow(/does not match JACKPOT_WALLET/);
  });
});

describe("resolveJackpotPayout", () => {
  it("dry-run does not send and keeps hash none", async () => {
    const send = vi.fn(async () => ({ txHash: TX_HASH }));
    const result = await resolveJackpotPayout({
      dryRun: true,
      winner: WINNER,
      amountGme: 1303.902,
      send,
    });
    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({
      phase: "dry_run",
      txHash: null,
      sendCalled: false,
    });
    const caption = formatWinCelebration({
      bellLabel: "Close Bell",
      winner: WINNER,
      amountGme: 1303.902,
      amountUsd: 30224,
      dryRun: true,
      txHash: result.txHash,
      verifyUrl: "https://closingbellonrh.com/verify",
    });
    expect(caption).toContain("none (dry-run, no GME sent)");
    expect(caption).toContain("Dry run. No GME sent.");
    expect(caption).toContain(whoPicksTheWinner());
  });

  it("live send is called once and the hash feeds celebration", async () => {
    const send = vi.fn(async () => ({ txHash: TX_HASH }));
    const result = await resolveJackpotPayout({
      dryRun: false,
      winner: WINNER,
      amountGme: 1303.902,
      send,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      winner: WINNER,
      amountGme: 1303.902,
    });
    expect(send.mock.calls[0][0].winner).toBe(WINNER);
    expect(Object.keys(send.mock.calls[0][0])).toEqual(["winner", "amountGme"]);
    expect(result.phase).toBe("paid");
    expect(result.txHash).toBe(TX_HASH);
    const caption = formatWinCelebration({
      bellLabel: "Close Bell",
      winner: WINNER,
      amountGme: 1303.902,
      amountUsd: 30224,
      dryRun: false,
      txHash: result.txHash,
      verifyUrl: "https://closingbellonrh.com/verify",
    });
    expect(caption).toContain(TX_HASH);
    expect(caption).toContain("robinhoodchain.blockscout.com/tx/");
    expect(caption).toContain("View on explorer");
    expect(caption).not.toContain("Dry run");
  });

  it("skips a second send when the ring is already paid", async () => {
    const send = vi.fn(async () => ({ txHash: TX_HASH }));
    const first = await resolveJackpotPayout({
      dryRun: false,
      winner: WINNER,
      amountGme: 1303.902,
      send,
    });
    const second = await resolveJackpotPayout({
      dryRun: false,
      existingTxHash: first.txHash,
      existingPhase: "paid",
      winner: WINNER,
      amountGme: 1303.902,
      send,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(second.sendCalled).toBe(false);
    expect(second.phase).toBe("paid");
    expect(second.txHash).toBe(TX_HASH);
  });

  it("failed send marks failed with no hash and honest celebration copy", async () => {
    const send = vi.fn(async () => {
      throw new Error("insufficient funds");
    });
    const result = await resolveJackpotPayout({
      dryRun: false,
      winner: WINNER,
      amountGme: 1303.902,
      send,
    });
    expect(result.phase).toBe("failed");
    expect(result.txHash).toBeNull();
    expect(result.sendCalled).toBe(true);
    const caption = formatWinCelebration({
      bellLabel: "Close Bell",
      winner: WINNER,
      amountGme: 1303.902,
      amountUsd: 30224,
      dryRun: false,
      payoutFailed: true,
      txHash: result.txHash,
      verifyUrl: "https://closingbellonrh.com/verify",
    });
    expect(caption).toContain("none (payout send failed, pay manually)");
    expect(caption).toContain("Payout send failed. No GME sent by the bot.");
    expect(caption).not.toContain("RING · PAID");
    expect(caption).not.toContain("robinhoodchain.blockscout.com");
    expect(caption).toContain(checksumWallet(WINNER));
    expect(caption).toContain(whoPicksTheWinner());
  });
});

describe("sendJackpotPayout", () => {
  it("transfers the announced amount once and waits for a successful receipt", async () => {
    const mocks = mockClients({ decimals: 18 });
    const paid = await sendJackpotPayout(
      { winner: WINNER, amountGme: 1284.62 },
      { ...mocks, config: payoutCfg },
    );
    expect(paid.txHash).toBe(TX_HASH);
    expect(mocks.writeContract).toHaveBeenCalledTimes(1);
    expect(mocks.waitForTransactionReceipt).toHaveBeenCalledTimes(1);
    expect(mocks.waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: TX_HASH,
    });
    const args = mocks.writeContract.mock.calls[0][0];
    expect(args.functionName).toBe("transfer");
    expect(args.args[0]).toBe(WINNER);
    expect(args.args[1]).toBe(parseUnits("1284.62", 18));
  });

  it("does not send when the private key does not match the jackpot wallet", async () => {
    const mocks = mockClients();
    await expect(
      sendJackpotPayout(
        { winner: WINNER, amountGme: 10 },
        {
          ...mocks,
          config: {
            ...payoutCfg,
            jackpotWallet: "0x1111111111111111111111111111111111111111",
          },
        },
      ),
    ).rejects.toThrow(/does not match JACKPOT_WALLET/);
    expect(mocks.writeContract).not.toHaveBeenCalled();
  });

  it("throws when the receipt reverts", async () => {
    const mocks = mockClients({ status: "reverted" });
    await expect(
      sendJackpotPayout(
        { winner: WINNER, amountGme: 10 },
        { ...mocks, config: payoutCfg },
      ),
    ).rejects.toThrow(/reverted/);
  });

  it("persists the hash without retry when receipt wait times out", async () => {
    const mocks = mockClients({
      waitError: new Error("Timed out while waiting for transaction"),
    });
    const paid = await sendJackpotPayout(
      { winner: WINNER, amountGme: 10 },
      { ...mocks, config: payoutCfg },
    );
    expect(paid.txHash).toBe(TX_HASH);
    expect(mocks.writeContract).toHaveBeenCalledTimes(1);
  });
});
