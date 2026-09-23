import { describe, expect, it } from "vitest";
import { parseEther, type Hex } from "viem";

import { LaunchPhase, PONS_V2_FEE_ESCROW } from "../src/indexer/abi.js";
import { skipRingReason } from "../src/keeper/skip.js";
import {
  fetchLivePot,
  type LivePotInput,
  type PotReadContract,
} from "../src/pot/chain.js";
import { formatPotCommand } from "../src/telegram/format.js";

const GME = "0x1b0e319c6a659f002271b69db8a7df2f911c153e" as Hex;
const WALLET = "0xd0af634d5eda0d947d31d80fb113b8af28cfa53e" as Hex;
const TOKEN = "0x2222222222222222222222222222222222222222" as Hex;
const CURVE = "0x3333333333333333333333333333333333333333" as Hex;
const FACTORY = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e" as Hex;
const HOOK = "0xe5e702641ea86f4ae6cc3cdaed2b886f976be044" as Hex;
const ESCROW = PONS_V2_FEE_ESCROW;

function baseInput(over: Partial<LivePotInput> = {}): LivePotInput {
  return {
    rpcUrl: "http://127.0.0.1:8545",
    gmeTokenAddress: GME,
    jackpotWallet: WALLET,
    jackpotShareBps: 5000,
    gmeUsdPrice: 20,
    gmeTokenDecimals: 18,
    walletOverride: null,
    claimableOverride: null,
    tokenAddress: TOKEN,
    curveOrPool: CURVE,
    factoryAddress: FACTORY,
    hookAddress: HOOK,
    feeEscrowAddress: ESCROW,
    creatorFeeRecipient: WALLET,
    ...over,
  };
}

function reader(state: {
  walletWei?: bigint;
  escrowWei?: bigint;
  quoteFeeWei?: bigint;
  creatorTaxWei?: bigint;
  pendingFeesWei?: bigint;
  pendingTaxWei?: bigint;
  phase?: LaunchPhase;
}): PotReadContract {
  return async ({ functionName }) => {
    switch (functionName) {
      case "decimals":
        return 18;
      case "balanceOf":
        return state.walletWei ?? 0n;
      case "balanceOfToken":
        return state.escrowWei ?? 0n;
      case "feeEscrow":
        return ESCROW;
      case "quoteFeeBalance":
        return state.quoteFeeWei ?? 0n;
      case "creatorTaxBalance":
        return state.creatorTaxWei ?? 0n;
      case "pendingFees":
        return state.pendingFeesWei ?? 0n;
      case "pendingCreatorTax":
        return state.pendingTaxWei ?? 0n;
      case "getLaunchedToken":
        return {
          token: TOKEN,
          curve: CURVE,
          pairToken: GME,
          creatorFeeRecipient: WALLET,
          phase: state.phase ?? LaunchPhase.NotGraduated,
          exists: true,
          poolFee: 0,
          tickSpacing: 60,
        };
      default:
        throw new Error(`unexpected read ${functionName}`);
    }
  };
}

describe("live pot chain reads", () => {
  it("maps GME.balanceOf to jackpotWalletBalance", async () => {
    const pot = await fetchLivePot({
      ...baseInput({ tokenAddress: "", curveOrPool: "" }),
      readContract: reader({ walletWei: parseEther("12.5") }),
    });
    expect(pot.jackpotWalletBalance).toBe(12.5);
    expect(pot.inPot).toBe(12.5);
    expect(pot.ponsClaimable).toBe(0);
    expect(pot.displayPot).toBe(12.5);
  });

  it("maps escrow + unswept curve fees to accruing share at 50%", async () => {
    const pot = await fetchLivePot({
      ...baseInput(),
      readContract: reader({
        walletWei: 0n,
        escrowWei: parseEther("80"),
        quoteFeeWei: parseEther("16"),
        creatorTaxWei: parseEther("4"),
      }),
    });
    expect(pot.ponsClaimable).toBe(100);
    expect(pot.accruingUnclaimed).toBe(50);
    expect(pot.jackpotShareBps).toBe(5000);
    expect(pot.displayPot).toBe(50);
  });

  it("combines wallet balance with accruing unclaimed", async () => {
    const pot = await fetchLivePot({
      ...baseInput(),
      readContract: reader({
        walletWei: parseEther("10"),
        escrowWei: parseEther("20"),
      }),
    });
    expect(pot.jackpotWalletBalance).toBe(10);
    expect(pot.ponsClaimable).toBe(20);
    expect(pot.accruingUnclaimed).toBe(10);
    expect(pot.displayPot).toBe(20);
  });

  it("shows 0.01 GME on Telegram and site formatters", async () => {
    const pot = await fetchLivePot({
      ...baseInput({ tokenAddress: "", curveOrPool: "" }),
      readContract: reader({ walletWei: parseEther("0.01") }),
    });
    expect(pot.displayPot).toBe(0.01);
    const telegram = formatPotCommand(pot, WALLET, {
      siteUrl: "https://closingbellonrh.com",
    });
    expect(telegram).toContain("0.01");
    const site = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(pot.displayPot);
    expect(site).toContain("0.01");
  });

  it("skips a ring below MIN_POT_GME=1 even when display is 0.5", () => {
    expect(
      skipRingReason({ potGme: 0.5, minPotGme: 1, totalWeight: 10 }),
    ).toContain("MIN_POT_GME");
    expect(
      skipRingReason({ potGme: 1, minPotGme: 1, totalWeight: 10 }),
    ).toBeNull();
  });

  it("uses stubs when set and skips chain reads", async () => {
    let reads = 0;
    const spy: PotReadContract = async (args) => {
      reads += 1;
      return reader({})(args);
    };
    const pot = await fetchLivePot({
      ...baseInput({
        walletOverride: 3,
        claimableOverride: 8,
        readContract: spy,
      }),
    });
    expect(reads).toBe(0);
    expect(pot.jackpotWalletBalance).toBe(3);
    expect(pot.ponsClaimable).toBe(8);
    expect(pot.accruingUnclaimed).toBe(4);
    expect(pot.displayPot).toBe(7);
  });

  it("does not double-count after a claim moves GME into the wallet", async () => {
    const before = await fetchLivePot({
      ...baseInput({ tokenAddress: "", curveOrPool: "" }),
      readContract: reader({
        walletWei: 0n,
        escrowWei: parseEther("100"),
      }),
    });
    expect(before.displayPot).toBe(50);

    const after = await fetchLivePot({
      ...baseInput({ tokenAddress: "", curveOrPool: "" }),
      readContract: reader({
        walletWei: parseEther("100"),
        escrowWei: 0n,
      }),
    });
    expect(after.jackpotWalletBalance).toBe(100);
    expect(after.ponsClaimable).toBe(0);
    expect(after.displayPot).toBe(100);
    expect(after.displayPot).not.toBe(150);
  });
});
