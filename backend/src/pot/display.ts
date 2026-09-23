/**
 * Pot display math.
 * displayPot = jackpotBalance + (ponsClaimable * JACKPOT_SHARE_BPS / 10000)
 */

export interface PotBreakdown {
  jackpotWalletBalance: number;
  ponsClaimable: number;
  jackpotShareBps: number;
  inPot: number;
  accruingUnclaimed: number;
  displayPot: number;
  gmeUsdPrice: number;
  displayPotUsd: number;
  /** Lifetime GME actually sent. Omitted until the draws sum is attached. */
  totalPaidOutGme?: number;
  totalPaidOutUsd?: number;
}

export function computePotDisplay(input: {
  jackpotWalletBalance: number;
  ponsClaimable: number;
  jackpotShareBps: number;
  gmeUsdPrice: number;
}): PotBreakdown {
  const jackpotWalletBalance = Math.max(0, input.jackpotWalletBalance);
  const ponsClaimable = Math.max(0, input.ponsClaimable);
  const accruingUnclaimed =
    (ponsClaimable * input.jackpotShareBps) / 10_000;
  const inPot = jackpotWalletBalance;
  const displayPot = inPot + accruingUnclaimed;
  return {
    jackpotWalletBalance,
    ponsClaimable,
    jackpotShareBps: input.jackpotShareBps,
    inPot,
    accruingUnclaimed,
    displayPot,
    gmeUsdPrice: input.gmeUsdPrice,
    displayPotUsd: displayPot * input.gmeUsdPrice,
  };
}
