import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "../config.js";
import type { BellRuntime } from "../runtime/bell-runtime.js";
import {
  createTelegramSender,
  getTelegramUpdates,
  type TelegramSender,
} from "./client.js";
import {
  formatBotLive,
  formatBuyAnnounce,
  formatFairnessPin,
  formatHowCommand,
  formatJackpotCommand,
  formatLadderRedirect,
  formatNextCommand,
  formatOddsCommand,
  formatOddsUsage,
  formatPotCommand,
  formatPotShareText,
  formatRingResult,
  formatVerifyCommand,
  formatFairnessCommand,
  formatWinCelebration,
  isFairnessPinText,
  isWinCelebrationText,
  stripTelegramHtml,
} from "./format.js";
import { pinLatestWin, postWinCelebration } from "./celebration.js";
import { renderJackpotCard } from "./jackpot-card.js";
import {
  jackpotShareUrl,
  publicLinks,
  publicSiteOrigin,
} from "./links.js";
import { mintTickets, usdSpent } from "../tickets/engine.js";
import type { ChainTradeEvent } from "../indexer/types.js";
import { nextBell, remainingUntil } from "../clock/market-clock.js";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const here = dirname(fileURLToPath(import.meta.url));
const HOW_IMAGE_CANDIDATES = [
  resolve(here, "../../assets/how-the-bell-works.jpg"),
  resolve(here, "../../assets/how-the-bell-works.png"),
  resolve(here, "../../../public/brand/how-the-bell-works.jpg"),
  resolve(here, "../../../public/brand/how-the-bell-works.png"),
];

const BOT_COMMANDS = [
  { command: "pot", description: "Live jackpot in GME and USD" },
  { command: "jackpot", description: "Jackpot pool and next ring" },
  { command: "standings", description: "Jackpot pool (same as /jackpot)" },
  { command: "odds", description: "Odds for a wallet: /odds 0x..." },
  { command: "next", description: "Next jackpot ring" },
  { command: "how", description: "How the bell works" },
  { command: "verify", description: "Check a published ring" },
  { command: "fairness", description: "How the winner is picked (same as /random)" },
  { command: "random", description: "How the winner is picked (same as /fairness)" },
  { command: "draw", description: "How the winner is picked (same as /fairness)" },
];

function howImagePath(): string | null {
  return HOW_IMAGE_CANDIDATES.find((path) => existsSync(path)) ?? null;
}

export class TelegramBot {
  readonly sender: TelegramSender;
  private offset = 0;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(private readonly runtime: BellRuntime) {
    this.sender = createTelegramSender({
      botToken: config.telegramBotToken,
      chatId: config.telegramChatId,
    });
  }

  async start(): Promise<void> {
    if (!config.telegramBotToken) {
      console.log(
        "Telegram bot: no TELEGRAM_BOT_TOKEN. Announces will log locally; commands disabled.",
      );
      return;
    }
    console.log("Telegram bot: polling for commands.");
    try {
      await this.sender.setMyCommands(BOT_COMMANDS);
    } catch (err) {
      console.error("Telegram setMyCommands failed:", err);
    }
    try {
      await this.ensureFairnessPin();
    } catch (err) {
      console.error(
        "Telegram pin failed (bot needs admin + pin permission):",
        err,
      );
    }
    try {
      await this.sender.send(
        formatBotLive({
          fixtureMode: config.fixtureMode,
          dryRun: config.dryRunPayouts,
        }),
      );
      console.log("Telegram bot: live check sent to configured chat.");
    } catch (err) {
      console.error("Telegram live check failed:", err);
    }
    void this.pollLoop();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  async announceBuy(event: ChainTradeEvent): Promise<void> {
    if (event.kind !== "buy") return;
    const usd = usdSpent(event.gmeAmount, config.gmeUsdPrice);
    const minted = mintTickets(usd, config);
    if (minted <= 0) return;

    const odds = this.runtime.oddsFor(event.wallet);
    const pool = this.runtime.ladder(50);
    const rank =
      pool.find((r) => r.address === event.wallet.toLowerCase())?.rank ??
      null;
    const upcoming = nextBell(new Date(), config.bells24_7);
    const text = formatBuyAnnounce({
      wallet: event.wallet,
      gmeSpent: event.gmeAmount,
      usdSpent: usd,
      minted,
      odds,
      pot: this.runtime.pot(),
      nextBellLabel: upcoming?.label ?? null,
      countdown: upcoming
        ? remainingUntil(upcoming.at, new Date())
        : null,
      ladderRank: rank,
    });
    await this.sender.send(text);
  }

  async send(text: string): Promise<void> {
    await this.sender.send(text);
  }

  async announceWin(input: {
    bellLabel: string;
    winner: string;
    amountGme: number;
    amountUsd: number;
    dryRun: boolean;
    odds: number;
    ticketsAtRing: number;
    txHash: string | null;
    windowId?: string;
    bellAt?: string;
    payoutFailed?: boolean;
  }): Promise<void> {
    const links = publicLinks(input.windowId);
    const caption = formatWinCelebration({
      bellLabel: input.bellLabel,
      winner: input.winner,
      amountGme: input.amountGme,
      amountUsd: input.amountUsd,
      dryRun: input.dryRun,
      payoutFailed: input.payoutFailed,
      txHash: input.txHash,
      verifyUrl: links.verifyUrl ?? `${publicSiteOrigin()}/verify`,
    });
    const posted = await postWinCelebration(this.sender, caption);
    if (posted?.messageId) {
      try {
        await pinLatestWin(this.sender, posted.messageId);
      } catch (err) {
        console.error(
          "Telegram win pin failed (bot needs admin + pin permission):",
          err,
        );
      }
      return;
    }
    await this.sender.send(
      formatRingResult({
        bellLabel: input.bellLabel,
        bellAt: input.bellAt,
        winner: input.winner,
        odds: input.odds,
        amountGme: input.amountGme,
        amountUsd: input.amountUsd,
        ticketsAtRing: input.ticketsAtRing,
        dryRun: input.dryRun,
        payoutFailed: input.payoutFailed,
        txHash: input.txHash,
        links,
      }),
    );
  }

  private async ensureFairnessPin(): Promise<void> {
    if (!config.telegramChatId) return;
    const desired = formatFairnessPin(
      publicLinks(),
      config.snapshotLeadSeconds,
    );
    const existing = await this.sender.getPinned();
    if (existing && isWinCelebrationText(existing.text)) {
      console.log("Telegram bot: leaving latest win pin in place.");
      return;
    }
    const desiredPlain = stripTelegramHtml(desired);
    if (existing && stripTelegramHtml(existing.text) === desiredPlain) {
      console.log("Telegram bot: fairness pin already current.");
      return;
    }
    if (existing && isFairnessPinText(existing.text)) {
      try {
        await this.sender.edit(existing.messageId, desired);
        console.log("Telegram bot: fairness pin updated.");
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/message is not modified/i.test(msg)) {
          console.log("Telegram bot: fairness pin already current.");
          return;
        }
        console.error("Telegram pin edit failed, posting a new pin:", err);
      }
    }
    const posted = await this.sender.send(desired);
    if (posted && posted.messageId) {
      await this.sender.pin(posted.messageId);
      console.log("Telegram bot: fairness pin posted.");
    }
  }

  private async pollLoop(): Promise<void> {
    while (!this.stopped) {
      try {
        const updates = await getTelegramUpdates(
          config.telegramBotToken,
          this.offset,
        );
        for (const update of updates) {
          this.offset = update.update_id + 1;
          const incoming = update.message ?? update.channel_post;
          const text = incoming?.text?.trim();
          const chatId = incoming?.chat.id;
          if (!text || chatId === undefined) continue;
          await this.handleCommand(text, String(chatId));
        }
      } catch (err) {
        console.error("Telegram poll error:", err);
        await sleep(3_000);
      }
    }
  }

  private jackpotReply(): string {
    const window = this.runtime.currentWindow(new Date());
    return formatJackpotCommand({
      rows: this.runtime.ladder(10),
      pot: this.runtime.pot(),
      phase: window.phase,
      nextLabel: window.nextBell?.label ?? null,
      countdown: window.countdown,
      snapshotLeadSeconds: config.snapshotLeadSeconds,
      oddsCapBps: config.oddsCapBps,
      links: publicLinks(),
    });
  }

  private async sendHow(chatId: string): Promise<void> {
    const imagePath = howImagePath();
    if (imagePath) {
      try {
        await this.sender.sendPhoto({
          photo: readFileSync(imagePath),
          filename: imagePath.endsWith(".png")
            ? "how-the-bell-works.png"
            : "how-the-bell-works.jpg",
          chatId,
        });
      } catch (err) {
        console.error("Telegram /how image failed:", err);
      }
    } else {
      console.error("Telegram /how image missing (assets/how-the-bell-works.jpg)");
    }
    await this.sender.send(
      formatHowCommand({
        minBuyUsd: config.minBuyUsd,
        ticketsPerUsd: config.ticketsPerUsd,
        oddsCapBps: config.oddsCapBps,
        snapshotLeadSeconds: config.snapshotLeadSeconds,
        links: publicLinks(),
      }),
      chatId,
    );
  }

  private async sendPot(chatId: string): Promise<void> {
    const pot = this.runtime.pot();
    const links = publicLinks();
    const caption = formatPotCommand(pot, config.jackpotWallet, links);
    const sharePage = links.potUrl ?? `${publicSiteOrigin()}/#bell-pot`;
    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "Share jackpot",
            url: jackpotShareUrl(sharePage, formatPotShareText(pot)),
          },
        ],
      ],
    };
    try {
      const png = await renderJackpotCard(pot, publicSiteOrigin());
      await this.sender.sendPhoto({
        photo: png,
        filename: "closing-bell-jackpot.png",
        caption,
        chatId,
        replyMarkup,
      });
    } catch (err) {
      console.error("Telegram /pot image failed, sending text:", err);
      await this.sender.send(caption, chatId, { replyMarkup });
    }
  }

  private async handleCommand(text: string, chatId: string): Promise<void> {
    const [rawCmd, ...args] = text.split(/\s+/);
    const cmd = rawCmd.replace(/@\w+$/, "").toLowerCase();

    if (cmd === "/pot") {
      await this.sendPot(chatId);
      return;
    }
    if (cmd === "/odds") {
      const address = args[0] ?? "";
      if (!ADDRESS_RE.test(address)) {
        await this.sender.send(formatOddsUsage(publicLinks()), chatId);
        return;
      }
      await this.sender.send(
        formatOddsCommand(this.runtime.oddsFor(address), publicLinks()),
        chatId,
      );
      return;
    }
    if (cmd === "/jackpot" || cmd === "/standings") {
      await this.sender.send(this.jackpotReply(), chatId);
      return;
    }
    if (cmd === "/ladder") {
      await this.sender.send(formatLadderRedirect(), chatId);
      await this.sender.send(this.jackpotReply(), chatId);
      return;
    }
    if (cmd === "/next") {
      const window = this.runtime.currentWindow(new Date());
      await this.sender.send(
        formatNextCommand({
          label: window.nextBell?.label ?? null,
          at: window.nextBell?.at ?? null,
          countdown: window.countdown,
          phase: window.phase,
          pot: this.runtime.pot(),
          links: publicLinks(),
        }),
        chatId,
      );
      return;
    }
    if (cmd === "/how") {
      await this.sendHow(chatId);
      return;
    }
    if (cmd === "/verify") {
      await this.sender.send(formatVerifyCommand(publicLinks()), chatId);
      return;
    }
    if (cmd === "/fairness" || cmd === "/random" || cmd === "/draw") {
      await this.sender.send(formatFairnessCommand(publicLinks()), chatId);
      return;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
