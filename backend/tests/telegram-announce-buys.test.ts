import { afterEach, describe, expect, it, vi } from "vitest";

describe("TELEGRAM_ANNOUNCE_BUYS", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("defaults false so per-buy channel posts are off", async () => {
    vi.resetModules();
    vi.stubEnv("TELEGRAM_ANNOUNCE_BUYS", "");
    const { config } = await import("../src/config.js");
    expect(config.telegramAnnounceBuys).toBe(false);
    expect(config.publicMeta().telegramAnnounceBuys).toBe(false);
  });

  it("can be turned back on", async () => {
    vi.resetModules();
    vi.stubEnv("TELEGRAM_ANNOUNCE_BUYS", "true");
    const { config } = await import("../src/config.js");
    expect(config.telegramAnnounceBuys).toBe(true);
  });
});

describe("announceBuy respects the flag", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("does not send when TELEGRAM_ANNOUNCE_BUYS is false", async () => {
    vi.resetModules();
    vi.stubEnv("TELEGRAM_ANNOUNCE_BUYS", "false");
    const { TelegramBot } = await import("../src/telegram/bot.js");
    const { BellRuntime } = await import("../src/runtime/bell-runtime.js");
    const { config } = await import("../src/config.js");
    const bot = new TelegramBot(new BellRuntime(config));
    const send = vi.fn(async () => ({ messageId: 1 }));
    (bot as unknown as { sender: { send: typeof send } }).sender = {
      ...bot.sender,
      send,
    };
    await bot.announceBuy({
      eventId: "test-1",
      adapter: "pons-curve",
      txHash: "0x" + "ab".repeat(32),
      logIndex: 0,
      blockNumber: 1n,
      kind: "buy",
      wallet: "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137",
      gmeAmount: 10,
      bellAmount: 1000,
      occurredAt: new Date(),
    });
    expect(send).not.toHaveBeenCalled();
  });
});
