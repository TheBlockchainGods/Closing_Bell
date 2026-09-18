import { describe, expect, it } from "vitest";

import {
  applyBuy,
  totalTickets,
  wipeTickets,
  type TicketBook,
} from "../src/tickets/engine.js";
import {
  buildDrawEntrants,
  drawSeedHex,
  pickWeightedWinner,
  syntheticBlockhash,
  totalDrawWeight,
} from "../src/draw/select.js";
import { BellRuntime } from "../src/runtime/bell-runtime.js";
import { config } from "../src/config.js";
import { formatBuyAnnounce, formatFairnessCommand, formatFairnessPin, formatHowCommand, formatJackpotCommand, formatLadderRedirect, formatNextCommand, formatPotCommand, formatRingResult, formatTicketCutoff, formatVerifyCommand, formatWinCelebration, whoPicksTheWinner } from "../src/telegram/format.js";
import { computePotDisplay } from "../src/pot/display.js";

const cfg = {
  minBuyUsd: 5,
  ticketsPerUsd: 1000,
  oddsCapBps: 1000,
};

describe("draw selection", () => {
  it("is deterministic for the same seed material", () => {
    const book: TicketBook = new Map();
    applyBuy(book, "0x1111111111111111111111111111111111111111", 10, 100, 10, cfg);
    applyBuy(book, "0x2222222222222222222222222222222222222222", 5, 50, 10, cfg);
    applyBuy(book, "0x3333333333333333333333333333333333333333", 2, 20, 10, cfg);

    const entrants = buildDrawEntrants(book, cfg.oddsCapBps);
    const seed = drawSeedHex({
      blockhashAtSnapshot: syntheticBlockhash("window-1", new Date("2026-09-14T20:00:00Z")),
      windowId: "window-1",
      potBalance: 1284.62,
    });
    const a = pickWeightedWinner(entrants, seed);
    const b = pickWeightedWinner(entrants, seed);
    expect(a?.winner.address).toBe(b?.winner.address);
    expect(a?.cursor).toBe(b?.cursor);
  });

  it("caps draw weight at ODDS_CAP_BPS of the bag", () => {
    const book: TicketBook = new Map();
    applyBuy(book, "0x1111111111111111111111111111111111111111", 50, 500, 10, cfg);
    applyBuy(book, "0x2222222222222222222222222222222222222222", 5, 50, 10, cfg);
    const entrants = buildDrawEntrants(book, cfg.oddsCapBps);
    const totalRaw = totalTickets(book);
    const maxWeight = Math.floor((totalRaw * cfg.oddsCapBps) / 10_000);
    expect(entrants[0].weight).toBe(maxWeight);
    expect(entrants[0].capped).toBe(true);
    expect(totalDrawWeight(entrants)).toBeLessThan(totalRaw);
  });
});

describe("dry-run window flow (in-memory)", () => {
  it("locks, picks a winner, wipes tickets", () => {
    const runtime = new BellRuntime(config);
    runtime.applyEvent({
      eventId: "t:0",
      adapter: "fixture",
      txHash: "0xabc",
      logIndex: 0,
      blockNumber: 1n,
      kind: "buy",
      wallet: "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137",
      gmeAmount: 10,
      bellAmount: 1000,
      occurredAt: new Date(),
    });
    runtime.applyEvent({
      eventId: "t:1",
      adapter: "fixture",
      txHash: "0xabd",
      logIndex: 0,
      blockNumber: 2n,
      kind: "buy",
      wallet: "0x91cE0a4F72Bd8e13aC6f5019D2b74e8A3cF10d55",
      gmeAmount: 8,
      bellAmount: 800,
      occurredAt: new Date(),
    });

    expect(totalTickets(runtime.live)).toBeGreaterThan(0);

    const windowId = "test-window";
    const blockhash = syntheticBlockhash(windowId, new Date());
    runtime.lockBag({ windowId, bellAt: new Date(), blockhash });
    expect(runtime.phase).toBe("locked");
    expect(runtime.snapshot).not.toBeNull();

    const entrants = buildDrawEntrants(runtime.snapshot!, config.oddsCapBps);
    const pot = runtime.pot();
    const seed = drawSeedHex({
      blockhashAtSnapshot: blockhash,
      windowId,
      potBalance: pot.displayPot,
    });
    const picked = pickWeightedWinner(entrants, seed);
    expect(picked).not.toBeNull();

    const announce = formatRingResult({
      bellLabel: "Close Bell",
      winner: picked!.winner.address,
      odds: picked!.winner.odds,
      amountGme: pot.displayPot,
      ticketsAtRing: picked!.winner.tickets,
      dryRun: true,
      txHash: null,
    });
    expect(announce).toContain("DRY RUN");
    expect(announce).toContain("Dry run. No GME sent.");
    expect(announce).toContain("Winning wallet");
    expect(announce).toContain(picked!.winner.address);
    expect(announce).not.toMatch(/0x[0-9a-fA-F]{4}…/);
    expect(announce).toContain("Payout tx");
    expect(announce).toContain("none (dry-run, no GME sent)");
    expect(announce).toContain(whoPicksTheWinner());
    expect(announce).toContain("public Closing Bell formula");
    expect(announce).toContain("/verify");
    expect(announce).not.toMatch(/—/);
    expect(announce.toLowerCase()).not.toMatch(/keeper|vrf|bag lock|frozen ticket|aws/);

    runtime.wipeAndSettle(new Date());
    expect(runtime.phase).toBe("settled");
    expect(totalTickets(runtime.live)).toBe(0);
  });
});

describe("telegram buy format", () => {
  it("formats a qualifying buy announce", () => {
    const pot = computePotDisplay({
      jackpotWalletBalance: 1000,
      ponsClaimable: 100,
      jackpotShareBps: 2000,
      gmeUsdPrice: 20,
    });
    const text = formatBuyAnnounce({
      wallet: "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137",
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
    expect(text).toContain("BUY");
    expect(text).toContain("CAP");
    expect(text).toContain("#1");
    expect(text).not.toMatch(/Ladder:/);
  });
});

describe("telegram how + pin copy", () => {
  const links = {
    siteUrl: "https://closingbellonrh.com",
    potUrl: "https://closingbellonrh.com/#bell-pot",
    verifyUrl: "https://closingbellonrh.com/verify",
    docsUrl: "https://closingbellonrh.com/docs",
    xUrl: "https://x.com/ClosingBellOnRH",
  };

  it("explains tickets, cutoff, and verify without hype", () => {
    const how = formatHowCommand({
      minBuyUsd: 5,
      ticketsPerUsd: 1000,
      oddsCapBps: 1000,
      snapshotLeadSeconds: 120,
      links,
    });
    expect(how).toContain("HOW THE BELL WORKS");
    expect(how).toContain("however you buy");
    expect(how).toContain("3 jackpots a day");
    expect(how).toContain("/verify");
    expect(how).toContain("closingbellonrh.com");
    expect(how).toContain(formatTicketCutoff(120));
    expect(how).toContain(whoPicksTheWinner());
    expect(how).toContain("public Closing Bell formula");
    expect(how).not.toMatch(/any venue|tickets wipe|bag lock|simulated demo/i);
    expect(how).not.toMatch(/—/);
    expect(how.toLowerCase()).not.toMatch(/keeper|vrf|frozen ticket|aws/);

    const pin = formatFairnessPin(links, 120);
    expect(pin).toContain("How the jackpot is chosen");
    expect(pin).toContain("One winning wallet per ring");
    expect(pin).toContain(whoPicksTheWinner());
    expect(pin).toContain("public Closing Bell formula");
    expect(pin).toContain(formatTicketCutoff(120));
    expect(pin).toContain("closingbellonrh.com");
    expect(pin).not.toMatch(/—/);
    expect(pin.toLowerCase()).not.toMatch(/keeper|vrf|bag lock|frozen ticket|aws/);
  });

  it("formats /fairness and /random as the same summary plus technical reply", () => {
    const fairness = formatFairnessCommand(links);
    const random = formatFairnessCommand(links);
    expect(fairness).toBe(random);
    expect(fairness).toContain("FAIRNESS");
    expect(fairness).toContain("<b>Summary</b>");
    expect(fairness).toContain(whoPicksTheWinner());
    expect(fairness).toContain("Same list + same formula → same wallet.");
    expect(fairness).toContain("closing-bell-draw-v1");
    expect(fairness).toContain("/verify");
    expect(fairness).toContain("https://closingbellonrh.com/verify");
    expect(fairness).toContain("https://closingbellonrh.com/docs");
    expect(fairness).toContain("<b>Technical</b>");
    expect(fairness).toContain("Node.js + TypeScript keeper");
    expect(fairness).toContain("Lightsail");
    expect(fairness).toContain("packages/fairness");
    expect(fairness).toContain("keccak256");
    expect(fairness).toContain("Weighted walk");
    expect(fairness).toContain("10% odds cap");
    expect(fairness).toContain("MATCH");
    expect(fairness).toContain("We do not claim on-chain VRF");
    expect(fairness).toContain("public formula you can recompute");
    expect(fairness).not.toMatch(/—/);
  });
});

describe("telegram jackpot + next copy", () => {
  const pot = computePotDisplay({
    jackpotWalletBalance: 1284.62,
    ponsClaimable: 96.41,
    jackpotShareBps: 2000,
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

  it("formats /jackpot with pool, pot, countdown, and cap", () => {
    const text = formatJackpotCommand({
      rows: [
        {
          rank: 1,
          address: "0x4b19ce77a0e2d61f5c8b3ad9017f4e62c0ab8137",
          tickets: 475190,
          spentInWindowGme: 20.5,
          spentInWindowUsd: 475.19,
          share: 0.35,
          odds: 0.1,
          capped: true,
        },
      ],
      pot,
      phase: "open",
      nextLabel: "Open Bell",
      countdown: { days: 0, hours: 16, minutes: 0, seconds: 4, totalMs: 0 },
      snapshotLeadSeconds: 120,
      oddsCapBps: 1000,
      links,
    });
    expect(text).toContain("JACKPOT POOL");
    expect(text).toContain("open (accruing)");
    expect(text).toContain("GME");
    expect(text).toContain("$");
    expect(text).toContain("Open Bell");
    expect(text).toContain("16h 00m 04s");
    expect(text).toContain("CAP");
    expect(text).toContain("475,190 tickets");
    expect(text).toContain(formatTicketCutoff(120));
    expect(text).toContain(whoPicksTheWinner());
    expect(text).toContain("closingbellonrh.com/#bell-pot");
    expect(text).not.toContain("Showing jackpot pool.");
    expect(text.toLowerCase()).not.toMatch(/\bladder\b|standings|bag lock/);
    expect(text).not.toMatch(/—/);
  });

  it("redirects /ladder to /jackpot", () => {
    const text = formatLadderRedirect();
    expect(text).toContain("Use /jackpot for the jackpot pool.");
    expect(text).not.toMatch(/—/);
  });

  it("formats /next with jackpot GME and USD", () => {
    const text = formatNextCommand({
      label: "Close Bell",
      at: "2026-09-16T20:00:00.000Z",
      countdown: { days: 0, hours: 1, minutes: 2, seconds: 3, totalMs: 0 },
      phase: "open",
      pot,
      links,
    });
    expect(text).toContain("NEXT JACKPOT RING");
    expect(text).toContain("Close Bell");
    expect(text).toContain("01h 02m 03s");
    expect(text).toContain("GME");
    expect(text).toContain("$");
    expect(text).toContain("closingbellonrh.com");
    expect(text).not.toMatch(/—/);
  });

  it("formats /pot and /verify with main-domain links", () => {
    const potText = formatPotCommand(pot, "0x1111111111111111111111111111111111", links);
    expect(potText).toContain("BELL POT");
    expect(potText).toContain(whoPicksTheWinner());
    expect(potText).toContain("closingbellonrh.com/#bell-pot");
    expect(potText).not.toMatch(/—/);

    const verify = formatVerifyCommand(links);
    expect(verify).toContain("VERIFY");
    expect(verify).toContain("closing-bell-draw-v1");
    expect(verify).toContain("Match");
    expect(verify).toContain(whoPicksTheWinner());
    expect(verify).toContain("closingbellonrh.com/verify");
    expect(verify).not.toMatch(/keeper|vrf|—/i);
    expect(verify).toContain("No JSON paste");
  });

  it("formats the win celebration caption", () => {
    const winner = "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137";
    const caption = formatWinCelebration({
      bellLabel: "Close Bell",
      winner,
      amountGme: 1303.9,
      amountUsd: 30224,
      dryRun: true,
      txHash: null,
      verifyUrl: "https://closingbellonrh.com/verify",
    });
    expect(caption).toContain("WIN CELEBRATION");
    expect(caption).toContain("Close Bell");
    expect(caption).toContain(winner);
    expect(caption).not.toContain("0x4b19…8137");
    expect(caption).not.toMatch(/0x4b19…/);
    expect(caption).toContain("GME");
    expect(caption).toContain("$");
    expect(caption).toContain("<b>Payout tx</b>");
    expect(caption).toContain("none (dry-run, no GME sent)");
    expect(caption).toContain("Dry run. No GME sent.");
    expect(caption).toContain(whoPicksTheWinner());
    expect(caption).toContain("https://closingbellonrh.com/verify");
    expect(caption).not.toMatch(/keeper|vrf|—/i);
  });

  it("shows full payout tx and explorer link when a chain hash exists", () => {
    const winner = "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137";
    const txHash =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const caption = formatWinCelebration({
      bellLabel: "Close Bell",
      winner,
      amountGme: 1303.9,
      amountUsd: 30224,
      dryRun: false,
      txHash,
      verifyUrl: "https://closingbellonrh.com/verify",
    });
    expect(caption).toContain(winner);
    expect(caption).toContain(txHash);
    expect(caption).toContain("robinhoodchain.blockscout.com/tx/");
    expect(caption).toContain("View on explorer");
    expect(caption).not.toContain("Dry run");
    expect(caption).toContain(whoPicksTheWinner());
  });

  it("labels a stored dry-run payout id without inventing a chain hash", () => {
    const winner = "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137";
    const caption = formatWinCelebration({
      bellLabel: "Close Bell",
      winner,
      amountGme: 1303.9,
      amountUsd: 30224,
      dryRun: true,
      txHash: "dry-run-receipt-window-1",
      verifyUrl: "https://closingbellonrh.com/verify",
    });
    expect(caption).toContain(winner);
    expect(caption).toContain("Payout tx (dry-run)");
    expect(caption).toContain("dry-run-receipt-window-1");
    expect(caption).not.toContain("robinhoodchain.blockscout.com");
    expect(caption).toContain("Dry run. No GME sent.");
  });

  it("uses honest failed-payout wording without faking a paid tx", () => {
    const winner = "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137";
    const caption = formatWinCelebration({
      bellLabel: "Close Bell",
      winner,
      amountGme: 1303.9,
      amountUsd: 30224,
      dryRun: false,
      payoutFailed: true,
      txHash: null,
      verifyUrl: "https://closingbellonrh.com/verify",
    });
    expect(caption).toContain(winner);
    expect(caption).toContain("none (payout send failed, pay manually)");
    expect(caption).toContain("Payout send failed. No GME sent by the bot.");
    expect(caption).not.toContain("View on explorer");
    expect(caption).not.toContain("Dry run");
    expect(caption).not.toMatch(/—/);
  });
});

describe("wipeTickets still works", () => {
  it("clears the book", () => {
    const book: TicketBook = new Map();
    applyBuy(book, "0x1111111111111111111111111111111111111111", 1, 10, 25, cfg);
    wipeTickets(book);
    expect(totalTickets(book)).toBe(0);
  });
});

describe("jackpot share card", () => {
  const pot = computePotDisplay({
    jackpotWalletBalance: 1284.62,
    ponsClaimable: 96.41,
    jackpotShareBps: 2000,
    gmeUsdPrice: 23.18,
  });
  const links = {
    siteUrl: "https://closingbellonrh.com",
    potUrl: "https://closingbellonrh.com/#bell-pot",
    verifyUrl: "https://closingbellonrh.com/verify",
    docsUrl: "https://closingbellonrh.com/docs",
    xUrl: "https://x.com/ClosingBellOnRH",
  };

  it("builds branded SVG copy matching the /pot caption", async () => {
    const { jackpotCardSvg, jackpotFontPaths } = await import(
      "../src/telegram/jackpot-card.js"
    );
    const fonts = jackpotFontPaths();
    expect(fonts.regular).toMatch(/Inter-Regular\.otf$/);
    expect(fonts.bold).toMatch(/Inter-Bold\.otf$/);
    const svg = jackpotCardSvg(pot, "https://closingbellonrh.com");
    expect(svg).toContain('font-family="Inter"');
    expect(svg).toContain("CLOSING BELL");
    expect(svg).toContain("JACKPOT");
    expect(svg).toContain("1,303.902");
    expect(svg).toContain("$30,224.45");
    expect(svg).toContain("In pot 1,284.62 GME");
    expect(svg).toContain("Accruing 19.282 GME");
    expect(svg).toContain("GME");
    expect(svg).toContain("closingbellonrh.com");
    expect(svg).not.toMatch(/Georgia|Times New Roman|—/);
    const caption = formatPotCommand(
      pot,
      "0x1111111111111111111111111111111111",
      links,
    );
    expect(caption).toContain("1,303.902");
    expect(caption).toContain("$30,224.45");
    expect(caption).toContain("1,284.62");
    expect(caption).toContain("19.282");
  });

  it("renders a PNG", async () => {
    const { renderJackpotCard } = await import("../src/telegram/jackpot-card.js");
    const png = await renderJackpotCard(pot, "https://closingbellonrh.com");
    expect(png.subarray(0, 8).toString("binary")).toBe(
      "\x89PNG\r\n\x1a\n",
    );
  }, 20_000);

  it("composites Bellwether onto a cat-forward card", async () => {
    const { jackpotMascotPath, renderJackpotCard } = await import(
      "../src/telegram/jackpot-card.js"
    );
    expect(jackpotMascotPath()).toMatch(/bellwether/i);
    const png = await renderJackpotCard(pot, "https://closingbellonrh.com");
    const sharp = (await import("sharp")).default;
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(720);
    expect(png.length).toBeGreaterThan(40_000);
  }, 20_000);

  it("paints gold glyphs for live GME (no missing-font tofu)", async () => {
    const { renderJackpotCard } = await import("../src/telegram/jackpot-card.js");
    const png = await renderJackpotCard(pot, "https://closingbellonrh.com");
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(png)
      .extract({ left: 620, top: 240, width: 520, height: 110 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let gold = 0;
    let whiteBoxes = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 170 && g > 100 && b < 160 && r > b + 40) gold += 1;
      if (r > 248 && g > 248 && b > 248) whiteBoxes += 1;
    }
    expect(gold).toBeGreaterThan(800);
    expect(whiteBoxes).toBeLessThan(80);
  }, 20_000);
});

describe("win celebration media", () => {
  it("ships the celebrate MP4 and still", async () => {
    const { celebrationStillPath, celebrationVideoPath } = await import(
      "../src/telegram/celebration.js"
    );
    expect(celebrationVideoPath()).toMatch(/closing-bell-celebrate\.mp4$/);
    expect(celebrationStillPath()).toMatch(/closing-bell-celebrate\.jpg$/);
  });

  it("prefers video and pins the latest win", async () => {
    const { pinLatestWin, postWinCelebration } = await import(
      "../src/telegram/celebration.js"
    );
    const calls: string[] = [];
    const sender = {
      enabled: true,
      send: async () => {
        calls.push("text");
        return { messageId: 9 };
      },
      sendPhoto: async () => {
        calls.push("photo");
        return { messageId: 8 };
      },
      sendVideo: async () => {
        calls.push("video");
        return { messageId: 42 };
      },
      pin: async (id: number) => {
        calls.push(`pin:${id}`);
      },
      unpin: async (id?: number) => {
        calls.push(`unpin:${id ?? "latest"}`);
      },
      edit: async () => undefined,
      getPinned: async () => ({
        messageId: 7,
        text: "WIN CELEBRATION previous",
      }),
      setMyCommands: async () => undefined,
    };
    const posted = await postWinCelebration(sender, "WIN CELEBRATION caption");
    expect(posted).toEqual({ messageId: 42, kind: "video" });
    await pinLatestWin(sender, 42);
    expect(calls).toEqual(["video", "unpin:7", "pin:42"]);
  });

  it("falls back to the still when video send fails", async () => {
    const { postWinCelebration } = await import("../src/telegram/celebration.js");
    const sender = {
      enabled: true,
      send: async () => ({ messageId: 9 }),
      sendPhoto: async () => ({ messageId: 8 }),
      sendVideo: async () => {
        throw new Error("VIDEO_INVALID");
      },
      pin: async () => undefined,
      unpin: async () => undefined,
      edit: async () => undefined,
      getPinned: async () => null,
      setMyCommands: async () => undefined,
    };
    const posted = await postWinCelebration(sender, "WIN CELEBRATION caption");
    expect(posted).toEqual({ messageId: 8, kind: "photo" });
  });
});
