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
  TELEGRAM_SLASH_COMMANDS,
} from "./format.js";
import { pinLatestWin, postWinCelebration } from "./celebration.js";
import { getPool } from "../db/client.js";
import { attachPaidOut, sumPaidOutGme } from "../pot/paid-out.js";
import { renderJackpotCard } from "./jackpot-card.js";
import {
  jackpotShareUrl,
  publicLinks,
  publicSiteOrigin,
} from "./links.js";
import { mintTickets, totalTickets, usdSpent } from "../tickets/engine.js";
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
      await this.sender.setMyCommands(TELEGRAM_SLASH_COMMANDS);
    } catch (err) {
      console.error("Telegram setMyCommands failed:", err);
    }
    if (config.telegramStartupAnnounce) {
      try {
        await this.sender.send(
          formatBotLive({
            fixtureMode: config.fixtureMode,
            dryRun: config.dryRunPayouts,
          }),
        );
        console.log("Telegram bot: startup announce sent.");
      } catch (err) {
        console.error("Telegram startup announce failed:", err);
      }
    } else {
      console.log(
        "Telegram bot: startup announce off. /how on demand only. No boot pin.",
      );
    }
    void this.pollLoop();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  async announceBuy(event: ChainTradeEvent): Promise<void> {
    if (!config.telegramAnnounceBuys) return;
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
    await this.runtime.refreshPot();
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
      bells24_7: config.bells24_7,
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
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("409")) {
          console.error(
            "Telegram poll 409: another getUpdates client is still running. Retrying. This process stays up.",
          );
          await sleep(15_000);
        } else {
          console.error(`Telegram poll error: ${message}`);
          await sleep(3_000);
        }
      }
    }
  }

  private publicPoolRows() {
    if (!config.tokenAddress) return [];
    const book =
      this.runtime.phase === "locked" && this.runtime.snapshot
        ? this.runtime.snapshot
        : this.runtime.live;
    if (totalTickets(book) <= 0) return [];
    return this.runtime.ladder(10);
  }

  private async jackpotReply(): Promise<string> {
    const window = this.runtime.currentWindow(new Date());
    await this.runtime.refreshPot();
    return formatJackpotCommand({
      rows: this.publicPoolRows(),
      pot: this.runtime.pot(),
      phase: window.phase,
      nextLabel: window.nextBell?.label ?? null,
      countdown: window.countdown,
      snapshotLeadSeconds: config.snapshotLeadSeconds,
      oddsCapBps: config.oddsCapBps,
      links: publicLinks(),
      bells24_7: config.bells24_7,
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
        bells24_7: config.bells24_7,
      }),
      chatId,
    );
  }

  private async sendPot(chatId: string): Promise<void> {
    const pot = attachPaidOut(
      await this.runtime.refreshPot(),
      await sumPaidOutGme(getPool()),
    );
    const links = publicLinks();
    const caption = formatPotCommand(
      pot,
      config.jackpotWallet,
      links,
      config.tokenAddress,
    );
    const sharePage = links.potUrl ?? `${publicSiteOrigin()}/#bell-pot`;
    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "Share jackpot",
            url: jackpotShareUrl(
              sharePage,
              formatPotShareText(pot, config.tokenAddress, publicSiteOrigin()),
            ),
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
      await this.sender.send(await this.jackpotReply(), chatId);
      return;
    }
    if (cmd === "/ladder") {
      await this.sender.send(formatLadderRedirect(), chatId);
      await this.sender.send(await this.jackpotReply(), chatId);
      return;
    }
    if (cmd === "/next") {
      const window = this.runtime.currentWindow(new Date());
      await this.runtime.refreshPot();
      await this.sender.send(
        formatNextCommand({
          label: window.nextBell?.label ?? null,
          at: window.nextBell?.at ?? null,
          countdown: window.countdown,
          phase: window.phase,
          pot: this.runtime.pot(),
          links: publicLinks(),
          bells24_7: config.bells24_7,
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
