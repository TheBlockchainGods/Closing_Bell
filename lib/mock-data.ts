import type {
  AfterHoursSnapshot,
  HowStep,
  LockedRule,
  MarketSnapshot,
  PotSnapshot,
  TickerStanding,
  WalletLookup,
  WalletSnapshot,
  WinnerRecord,
} from "./types";
import { PONS_LAUNCH_URL } from "./launch";

/**
 * Copy, protocol constants, and After Hours targets.
 *
 * Do not use POT, MARKET, STANDINGS, WALLET, or WINNERS as the UI source of
 * truth. The live store reads pot, odds, ladder, and winners from the API
 * (fixture responses are fine until launch).
 */

export const PONS_URL = PONS_LAUNCH_URL;

export const POT: PotSnapshot = {
  inPotGme: 0,
  accruingGme: 0,
  gmePriceUsd: 23.18,
  /** Seeded all-time payouts across the winners feed below. */
  totalPaidOutGme: 0,
};

export const MARKET: MarketSnapshot = {
  bellPriceUsd: 0.0412,
  marketCapUsd: 4_120_000,
  windowVolumeGme: 18_940.5,
  holders: 6_412,
  totalTickets: 742_500,
  /** Per-wallet odds cap at launch. */
  oddsCap: 0.1,
};

/** The wallet the connect shortcut resolves to. Not on the seeded ladder. */
export const WALLET: WalletSnapshot = {
  address: "0x7Ad3F1c94E0b62Aa5D8e1fB0937C4e21bC5a9Df0",
  tickets: 26_480,
};

/** 1,000 Bell tickets per $1 USD spent (after GME→USD). Min buy $5. */
export const TICKETS_PER_USD = 1000;
/** @deprecated Use TICKETS_PER_USD. Kept so old imports do not break. */
export const TICKETS_PER_GME = TICKETS_PER_USD;

/**
 * The ticket ladder for the current window, quoted at the reference window size
 * in `MARKET.totalTickets`. Only the implied share is used, so the ladder still
 * makes sense after a ring resets the window to zero.
 *
 * The top two sit above the cap on raw share and the third lands just under it,
 * which is the point: the cap is visible doing its job without flattening the
 * whole board.
 */
export const STANDINGS: TickerStanding[] = [
  { address: "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137", tickets: 118_400 },
  { address: "0x91cE0a4F72Bd8e13aC6f5019D2b74e8A3cF10d55", tickets: 96_150 },
  { address: "0xD2f7B0a19cE485376aB1e0fC9d24358bE7a01c6E", tickets: 68_400 },
  { address: "0x38Ac91e0bF7d2154C6a8039E1bD57f204aC9e8B3", tickets: 61_275 },
  { address: "0xa07E4c1D93bF6820Ae5f1c704B29d63f85E0a1C7", tickets: 48_600 },
  { address: "0x6cB1470eA9f3D2185c07eB6941Da03f52e8C7b04", tickets: 39_180 },
  { address: "0xE51b30C7a48d09F26bC1740e35aB92f018D6c4A9", tickets: 31_040 },
  { address: "0x2fD84b0e91Ac7365dB1e04f8a5C93710eB6d2c8F", tickets: 24_910 },
];

/** Share of all tickets out, which is what the ladder actually renders from. */
export const STANDING_SHARES: { address: string; share: number }[] =
  STANDINGS.map((row) => ({
    address: row.address,
    share: row.tickets / MARKET.totalTickets,
  }));

/** Addresses that are handy to paste into the lookup while demoing. */
export const SAMPLE_LOOKUPS: string[] = [
  WALLET.address,
  STANDINGS[0].address,
  STANDINGS[4].address,
];

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function isAddressLike(value: string): boolean {
  return HEX_ADDRESS.test(value.trim());
}

/**
 * Mocked position for an arbitrary address.
 *
 * Seeded wallets return their ladder share. Anything else is derived from the
 * address bytes, so the same address always reports the same position. That
 * keeps the preview stable across reloads and identical between server and
 * client, which a random number would not be.
 */
export function mockLookup(rawAddress: string): WalletLookup | null {
  const address = rawAddress.trim();
  if (!isAddressLike(address)) return null;

  const seeded = STANDING_SHARES.find(
    (row) => row.address.toLowerCase() === address.toLowerCase(),
  );
  if (seeded) {
    return { address: seeded.address, share: seeded.share, onLadder: true };
  }

  if (address.toLowerCase() === WALLET.address.toLowerCase()) {
    return {
      address: WALLET.address,
      share: WALLET.tickets / MARKET.totalTickets,
      onLadder: false,
    };
  }

  // FNV-1a over the address, so the derived position is stable and spread out.
  let hash = 0x811c9dc5;
  for (let i = 2; i < address.length; i += 1) {
    hash ^= address.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  // Roughly 0.05% to 6% of the window: on the board, but under the cap.
  const share = 0.0005 + ((hash % 10_000) / 10_000) * 0.0595;

  return { address, share: Number(share.toFixed(6)), onLadder: false };
}

export const WINNERS: WinnerRecord[] = [
  {
    id: "ring-2401",
    address: "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137",
    kind: "close",
    amountGme: 2_318.44,
    ticketsAtRing: 118_400,
    oddsAtRing: 0.1,
    ringedAt: "2026-09-11T20:00:00.000Z",
  },
  {
    id: "ring-2400",
    address: "0xD2f7B0a19cE485376aB1e0fC9d24358bE7a01c6E",
    kind: "lunch",
    amountGme: 604.19,
    ticketsAtRing: 41_820,
    oddsAtRing: 0.0562,
    ringedAt: "2026-09-11T16:30:00.000Z",
  },
  {
    id: "ring-2399",
    address: "0x91cE0a4F72Bd8e13aC6f5019D2b74e8A3cF10d55",
    kind: "open",
    amountGme: 1_142.07,
    ticketsAtRing: 88_600,
    oddsAtRing: 0.0937,
    ringedAt: "2026-09-11T13:30:00.000Z",
  },
  {
    id: "ring-2398",
    address: "0x38Ac91e0bF7d2154C6a8039E1bD57f204aC9e8B3",
    kind: "close",
    amountGme: 1_986.55,
    ticketsAtRing: 61_275,
    oddsAtRing: 0.0741,
    ringedAt: "2026-09-10T20:00:00.000Z",
  },
  {
    id: "ring-2397",
    address: "0xa07E4c1D93bF6820Ae5f1c704B29d63f85E0a1C7",
    kind: "open",
    amountGme: 3_412.88,
    ticketsAtRing: 22_410,
    oddsAtRing: 0.0374,
    ringedAt: "2026-09-08T13:30:00.000Z",
  },
  {
    id: "ring-2396",
    address: "0x6cB1470eA9f3D2185c07eB6941Da03f52e8C7b04",
    kind: "close",
    amountGme: 1_705.31,
    ticketsAtRing: 39_180,
    oddsAtRing: 0.0482,
    ringedAt: "2026-09-04T20:00:00.000Z",
  },
];

/**
 * After Hours is not shipped. These are the target figures the design is drawn
 * against, not balances, and the UI labels them that way.
 */
export const AFTER_HOURS: AfterHoursSnapshot = {
  status: "coming-soon",
  totalStakedBell: 800_000_000,
  weeklyPotGme: 500,
  targetStakedShare: 0.2,
};

export const HOW_STEPS: HowStep[] = [
  {
    index: 1,
    title: "Buy",
    kicker: "Anywhere you already trade",
    body: "Buy $BELL on the GME pair and you earn tickets. Buys of $5+ mint tickets (1,000 per $1 USD). Weight follows USD spent in the window, not the bag you already hold.",
    rule: "You never have to trade through this site. It reads your position, it does not gate it.",
  },
  {
    index: 2,
    title: "Accrue",
    kicker: "The pot builds while the session runs",
    body: "About a 4% PONS creator tax. Half of claimed fees go to the jackpot, half to treasury. The Bell Pot shows the wallet balance plus 50% of still-unclaimed fees until the next bell.",
    rule: "Selling burns your tickets pro-rata. Conviction is the entry fee.",
  },
  {
    index: 3,
    title: "Ring",
    kicker: "The public formula picks the wallet",
    body: "A person does not pick the winner. The public Closing Bell formula (closing-bell-draw-v1) picks one wallet at random from the locked ticket list. Same list + same formula → same wallet. Check any ring on /verify. Then tickets wipe and the next window opens flat.",
    rule: "No rollover, no carry. Each window starts from zero tickets.",
  },
];

export const LOCKED_RULES: LockedRule[] = [
  {
    id: "tickets",
    title: "Tickets are earned, not bought here",
    body: "However you buy, you earn tickets. Buys of $5+ mint tickets (1,000 per $1 USD). Bots, terminals, aggregators and this page all count the same.",
  },
  {
    id: "cap",
    title: "Odds move until bag lock; capped at 10%",
    body: "Your odds move until the bag locks. The odds cap (10%) is max draw weight share vs the live ticket bag, not a locked win chance for the rest of the window. Past the cap, more spending buys more $BELL but no more draw weight.",
  },
  {
    id: "burn",
    title: "Selling burns tickets pro-rata",
    body: "Sell 40% of your position and 40% of your Bell tickets burn immediately, in the same transaction. Partial exits cost partial odds.",
  },
  {
    id: "ring",
    title: "The bell settles everything",
    body: "When the bell rings, the public formula closing-bell-draw-v1 picks one wallet at random from the locked ticket list. A person does not pick. The formula winner is paid the Bell Pot in GME and every Bell ticket wipes to zero. Check any ring on /verify.",
  },
  {
    id: "schedule",
    title: "Bells ring every day",
    body: "Open, Lunch, and Close hit at 09:30 / 12:30 / 16:00 ET on every calendar day. Robinhood Chain never sleeps, so Saturday and Sunday ring the same as any weekday.",
  },
  {
    id: "after-hours",
    title: "After Hours is next",
    body: "Stake $BELL through the Friday Close snapshot for a weekly pot paid in GME. It ships after the daily Bell Pot has run clean.",
  },
];

