import { config } from "../config.js";
import type { BellRuntime } from "../runtime/bell-runtime.js";
import {
  createTelegramSender,
  getTelegramUpdates,
  type TelegramSender,
} from "./client.js";
import {
  formatBuyAnnounce,
  formatLadderCommand,
  formatNextCommand,
  formatOddsCommand,
  formatPotCommand,
} from "./format.js";
import { mintTickets, usdSpent } from "../tickets/engine.js";
import type { ChainTradeEvent } from "../indexer/types.js";
import { nextBell, remainingUntil } from "../clock/market-clock.js";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

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
        "Telegram bot: no TELEGRAM_BOT_TOKEN — announces will log locally; commands disabled.",
      );
      return;
    }
    console.log("Telegram bot: polling for commands.");
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
    const ladder = this.runtime.ladder(50);
    const rank =
      ladder.find((r) => r.address === event.wallet.toLowerCase())?.rank ??
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

  private async pollLoop(): Promise<void> {
    while (!this.stopped) {
      try {
        const updates = await getTelegramUpdates(
          config.telegramBotToken,
          this.offset,
        );
        for (const update of updates) {
          this.offset = update.update_id + 1;
          const text = update.message?.text?.trim();
          const chatId = update.message?.chat.id;
          if (!text || chatId === undefined) continue;
          if (
            config.telegramChatId &&
            String(chatId) !== String(config.telegramChatId)
          ) {
            continue;
          }
          await this.handleCommand(text);
        }
      } catch (err) {
        console.error("Telegram poll error:", err);
        await sleep(3_000);
      }
    }
  }

  private async handleCommand(text: string): Promise<void> {
    const [rawCmd, ...args] = text.split(/\s+/);
    const cmd = rawCmd.replace(/@\w+$/, "").toLowerCase();

    if (cmd === "/pot") {
      await this.sender.send(
        formatPotCommand(this.runtime.pot(), config.jackpotWallet),
      );
      return;
    }
    if (cmd === "/odds") {
      const address = args[0] ?? "";
      if (!ADDRESS_RE.test(address)) {
        await this.sender.send("Usage: /odds 0x…");
        return;
      }
      await this.sender.send(formatOddsCommand(this.runtime.oddsFor(address)));
      return;
    }
    if (cmd === "/ladder") {
      await this.sender.send(formatLadderCommand(this.runtime.ladder(10)));
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
        }),
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
