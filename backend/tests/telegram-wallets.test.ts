import { describe, expect, it } from "vitest";
import { getAddress } from "viem";

import { computePotDisplay } from "../src/pot/display.js";
import { formatBellClockLine } from "../src/clock/market-clock.js";
import {
  assertTelegramWalletsCopyable,
  checksumWallet,
  formatBotLive,
  formatBuyAnnounce,
  formatCommandList,
  formatFairnessPin,
  formatHowCommand,
  formatJackpotCommand,
  formatNextCommand,
  formatOddsCommand,
  formatPayoutFailedAlert,
  formatPotCommand,
  formatPotShareText,
  formatRingResult,
  formatWinCelebration,
  TELEGRAM_SLASH_COMMANDS,
} from "../src/telegram/format.js";

const WINNER = "0x4b19ce77a0e2d61f5c8b3ad9017f4e62c0ab8137";
const WINNER_CS = getAddress(WINNER);
const JACKPOT = "0xd0AF634d5EDa0d947d31D80fb113b8AF28CfA53E";

const pot = computePotDisplay({
  jackpotWalletBalance: 0.2,
  ponsClaimable: 0,
  jackpotShareBps: 5000,
  gmeUsdPrice: 23.18,
});

const links = {
  siteUrl: "https://closingbellonrh.com",
  potUrl: "https://closingbellonrh.com/#bell-pot",
  oddsUrl: "https://closingbellonrh.com/#odds",
  countdownUrl: "https://closingbellonrh.com/#countdown",
  verifyUrl: "https://closingbellonrh.com/verify",
  docsUrl: "https://closingbellonrh.com/docs",
  xUrl: "https://x.com/ClosingBellOnRH",
};

function expectCopyable(html: string, wallet: string) {
  assertTelegramWalletsCopyable(html);
  const cs = checksumWallet(wallet);
  expect(html).toContain(`<code>${cs}</code>`);
}

describe("telegram wallets must be full copyable code", () => {
  it("fails truncated-only wallet strings", () => {
    expect(() =>
      assertTelegramWalletsCopyable("Wallet 0x4b19…8137"),
    ).toThrow(/truncated wallet without a full copyable/);
    expect(() =>
      assertTelegramWalletsCopyable("<code>0x4b19…8137</code>"),
    ).toThrow(/truncated wallet inside <code>/);
  });

  it("checksums 0x addresses", () => {
    expect(checksumWallet(WINNER)).toBe(WINNER_CS);
    expect(checksumWallet(JACKPOT)).toBe(JACKPOT);
  });

  it("puts the full jackpot wallet in /pot", () => {
    const text = formatPotCommand(pot, JACKPOT, links);
    expectCopyable(text, JACKPOT);
    expect(text).not.toMatch(/<code>0x[0-9a-fA-F]{4}…/);
  });

  it("puts paid out and the full CA on /pot and the share caption", () => {
    const ca = "0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7";
    const withPaid = {
      ...pot,
      totalPaidOutGme: 8.8582515,
      totalPaidOutUsd: 8.8582515 * pot.gmeUsdPrice,
    };
    const text = formatPotCommand(withPaid, JACKPOT, links, ca);
    expect(text).toContain("Paid out");
    expect(text).toContain("8.8583");
    expect(text).toContain(`<code>${ca}</code>`);
    const share = formatPotShareText(withPaid, ca);
    expect(share).toContain("Paid out: 8.8583 GME");
    expect(share).toContain(ca);
    expect(share.indexOf("Jackpot:")).toBeLessThan(share.indexOf("Paid out:"));
  });

  it("puts the full wallet in /odds, buy, ring, win pin, and payout fail", () => {
    const odds = formatOddsCommand(
      {
        address: WINNER,
        tickets: 0,
        totalTickets: 0,
        share: 0,
        odds: 0,
        capped: false,
        oddsCap: 0.1,
      },
      links,
    );
    expectCopyable(odds, WINNER);

    const buy = formatBuyAnnounce({
      wallet: WINNER,
      gmeSpent: 5,
      usdSpent: 100,
      minted: 100_000,
      odds: {
        tickets: 100_000,
        totalTickets: 200_000,
        share: 0.5,
        odds: 0.1,
        capped: true,
        oddsCap: 0.1,
      },
      pot,
      nextBellLabel: "Close Bell",
      countdown: { days: 0, hours: 1, minutes: 2, seconds: 3, totalMs: 0 },
      ladderRank: 1,
    });
    expectCopyable(buy, WINNER);

    const ring = formatRingResult({
      bellLabel: "Close Bell",
      winner: WINNER,
      odds: 0.1,
      amountGme: 0.2,
      ticketsAtRing: 1000,
      dryRun: true,
      txHash: null,
    });
    expectCopyable(ring, WINNER);

    const win = formatWinCelebration({
      bellLabel: "Close Bell",
      winner: WINNER,
      amountGme: 0.2,
      amountUsd: 4.64,
      dryRun: true,
      txHash: null,
      verifyUrl: links.verifyUrl!,
    });
    expectCopyable(win, WINNER);

    const fail = formatPayoutFailedAlert({
      windowId: "bell-close-test",
      winner: WINNER,
      amountGme: 0.2,
      error: "rpc timeout",
    });
    expectCopyable(fail, WINNER);
  });

  it("allows short form on pool rows only beside the full address", () => {
    const text = formatJackpotCommand({
      rows: [
        {
          rank: 1,
          address: WINNER,
          tickets: 10_000,
          spentInWindowGme: 1,
          spentInWindowUsd: 23.18,
          share: 1,
          odds: 0.1,
          capped: true,
        },
      ],
      pot,
      phase: "open",
      nextLabel: "Open Bell",
      countdown: { days: 0, hours: 1, minutes: 0, seconds: 0, totalMs: 0 },
      snapshotLeadSeconds: 120,
      oddsCapBps: 1000,
      links,
    });
    expect(text).toContain(`${WINNER_CS.slice(0, 6)}…${WINNER_CS.slice(-4)}`);
    expectCopyable(text, WINNER);
  });

  it("shows empty pre-launch pool with no fixture wallets", () => {
    const text = formatJackpotCommand({
      rows: [],
      pot,
      phase: "open",
      nextLabel: "Open Bell",
      countdown: { days: 0, hours: 1, minutes: 0, seconds: 0, totalMs: 0 },
      snapshotLeadSeconds: 120,
      oddsCapBps: 1000,
      links,
    });
    expect(text).toContain("No tickets yet");
    expect(text).toContain(formatCommandList());
    expect(text).not.toMatch(/0x[a-fA-F0-9]{40}/);
    expect(text).not.toMatch(/CAP · /);
    assertTelegramWalletsCopyable(text);
  });
});

describe("telegram bell clock times", () => {
  const clock = formatBellClockLine();

  it("prints Open / Lunch / Close with ET wall times", () => {
    expect(clock).toBe(
      "Open 9:30 AM ET · Lunch 12:30 PM ET · Close 4:00 PM ET",
    );
  });

  it("includes the clock line on /how, /next, /jackpot, and pins", () => {
    const how = formatHowCommand({
      minBuyUsd: 5,
      ticketsPerUsd: 1000,
      oddsCapBps: 1000,
      snapshotLeadSeconds: 120,
      links,
      bells24_7: true,
    });
    expect(how).toContain(clock);
    expect(how).toContain("Bells also ring on weekends (24/7).");
    expect(how).toContain("3 jackpots a day");

    const next = formatNextCommand({
      label: "Close Bell",
      at: "2026-09-16T20:00:00.000Z",
      countdown: { days: 0, hours: 1, minutes: 2, seconds: 3, totalMs: 0 },
      phase: "open",
      pot,
      links,
      bells24_7: true,
    });
    expect(next).toContain("Close Bell");
    expect(next).toContain(clock);

    const jackpot = formatJackpotCommand({
      rows: [],
      pot,
      phase: "open",
      nextLabel: "Open Bell",
      countdown: { days: 0, hours: 1, minutes: 0, seconds: 0, totalMs: 0 },
      snapshotLeadSeconds: 120,
      oddsCapBps: 1000,
      links,
      bells24_7: true,
    });
    expect(jackpot).toContain("Open Bell");
    expect(jackpot).toContain(clock);

    const pin = formatFairnessPin(links, 120, true);
    expect(pin).toContain(clock);
    expect(pin).toContain("Bells also ring on weekends (24/7).");

    const win = formatWinCelebration({
      bellLabel: "Lunch Bell",
      winner: WINNER,
      amountGme: 0.2,
      amountUsd: 4.64,
      dryRun: true,
      txHash: null,
      verifyUrl: links.verifyUrl!,
      bells24_7: true,
    });
    expect(win).toContain("Lunch Bell");
    expect(win).toContain(clock);
  });
});

describe("telegram command list is one helper", () => {
  it("includes the full public set and is reused everywhere commands are listed", () => {
    const list = formatCommandList();
    expect(list).toContain("/pot");
    expect(list).toContain("/jackpot");
    expect(list).toContain("/standings");
    expect(list).toContain("/ladder");
    expect(list).toContain("/odds 0x");
    expect(list).toContain("/next");
    expect(list).toContain("/how");
    expect(list).toContain("/verify");
    expect(list).toContain("/fairness");
    expect(list).toContain("/random");
    expect(list).toContain("/draw");
    expect(TELEGRAM_SLASH_COMMANDS.map((row) => row.command)).toEqual(
      expect.arrayContaining(["ladder", "draw", "standings", "random"]),
    );

    const how = formatHowCommand({
      minBuyUsd: 5,
      ticketsPerUsd: 1000,
      oddsCapBps: 1000,
      snapshotLeadSeconds: 120,
      links,
    });
    expect(how).toContain(list);

    const welcome = formatBotLive({ fixtureMode: false, dryRun: true });
    expect(welcome).toContain(list);
    expect(welcome).not.toContain("fixtureMode");
    expect(welcome).not.toContain("DRY_RUN");

    const pin = formatFairnessPin(links, 120, true);
    expect(pin).toContain(list);

    const win = formatWinCelebration({
      bellLabel: "Close Bell",
      winner: WINNER,
      amountGme: 0.2,
      amountUsd: 4.64,
      dryRun: true,
      txHash: null,
      verifyUrl: links.verifyUrl!,
    });
    expect(win).toContain(list);

    const emptyJackpot = formatJackpotCommand({
      rows: [],
      pot,
      phase: "open",
      nextLabel: "Open Bell",
      countdown: { days: 0, hours: 1, minutes: 0, seconds: 0, totalMs: 0 },
      snapshotLeadSeconds: 120,
      oddsCapBps: 1000,
      links,
    });
    expect(emptyJackpot).toContain(list);
  });
});
