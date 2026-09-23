/**
 * Telegram transport. Without TELEGRAM_BOT_TOKEN, messages are logged
 * (fixture / local dry path) instead of sent.
 */

export interface PinnedTelegramMessage {
  messageId: number;
  text: string;
}

export type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
};

export interface SendOptions {
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  disablePreview?: boolean;
  replyMarkup?: InlineKeyboard;
}

export interface TelegramSender {
  enabled: boolean;
  send(
    text: string,
    chatId?: string,
    options?: SendOptions,
  ): Promise<{ messageId: number } | null>;
  sendPhoto(input: {
    photo: Buffer;
    filename: string;
    caption?: string;
    chatId?: string;
    replyMarkup?: InlineKeyboard;
  }): Promise<{ messageId: number } | null>;
  sendVideo(input: {
    video: Buffer;
    filename: string;
    caption?: string;
    chatId?: string;
    replyMarkup?: InlineKeyboard;
  }): Promise<{ messageId: number } | null>;
  pin(messageId: number, chatId?: string): Promise<void>;
  unpin(messageId?: number, chatId?: string): Promise<void>;
  edit(
    messageId: number,
    text: string,
    chatId?: string,
    options?: SendOptions,
  ): Promise<void>;
  getPinned(chatId?: string): Promise<PinnedTelegramMessage | null>;
  setMyCommands(
    commands: Array<{ command: string; description: string }>,
  ): Promise<void>;
}

interface TelegramApiResult {
  ok: boolean;
  description?: string;
  result?: unknown;
}

/**
 * Telegram message bodies must be a single UTF-8 HTML string.
 * Rejects arrays, file objects, and PowerShell/JSON dumps that previously
 * spammed the live channel (PSPath, \\u003c-escaped tags, JSON arrays).
 */
export function assertTelegramMessageText(text: unknown): string {
  if (typeof text !== "string") {
    throw new Error(
      `Telegram text must be a plain string, got ${Array.isArray(text) ? "array" : typeof text}`,
    );
  }
  if (text.includes("PSPath") || text.includes("VersionInfo")) {
    throw new Error("Telegram text looks like a PowerShell file dump; refusing to send");
  }
  if (text.includes("\\u003c") || text.includes("\\u003e")) {
    throw new Error("Telegram text looks Unicode-escaped HTML; refusing to send");
  }
  const trimmed = text.trimStart();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    throw new Error("Telegram text looks like a JSON dump; refusing to send");
  }
  return text;
}

async function telegramCall(
  botToken: string,
  method: string,
  body: Record<string, unknown> | FormData,
): Promise<TelegramApiResult> {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const init: RequestInit = { method: "POST" };
  if (body instanceof FormData) {
    init.body = body;
  } else {
    init.headers = {
      "content-type": "application/json; charset=utf-8",
    };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const json = (await res.json()) as TelegramApiResult;
  if (!res.ok || !json.ok) {
    throw new Error(
      `Telegram ${method} failed: ${res.status} ${json.description ?? JSON.stringify(json)}`,
    );
  }
  return json;
}

function messagePayload(
  target: string,
  text: string,
  options?: SendOptions,
): Record<string, unknown> {
  const safe = assertTelegramMessageText(text);
  const payload: Record<string, unknown> = {
    chat_id: target,
    text: safe,
    parse_mode: options?.parseMode ?? "HTML",
    disable_web_page_preview: options?.disablePreview ?? true,
  };
  if (options?.replyMarkup) payload.reply_markup = options.replyMarkup;
  return payload;
}

export function createTelegramSender(opts: {
  botToken: string;
  chatId: string;
  log?: (line: string) => void;
}): TelegramSender {
  const log = opts.log ?? ((line: string) => console.log(line));
  const enabled = Boolean(opts.botToken);

  return {
    enabled,
    async send(text, chatId, options) {
      const safe = assertTelegramMessageText(text);
      const target = chatId || opts.chatId;
      if (!opts.botToken || !target) {
        log(`[tg:dry]\n${safe}`);
        return null;
      }
      const json = await telegramCall(
        opts.botToken,
        "sendMessage",
        messagePayload(target, safe, options),
      );
      const result = json.result as { message_id?: number } | undefined;
      return { messageId: result?.message_id ?? 0 };
    },
    async sendPhoto(input) {
      const target = input.chatId || opts.chatId;
      if (!opts.botToken || !target) {
        log(`[tg:dry:photo ${input.filename}]\n${input.caption ?? ""}`);
        return null;
      }
      const form = new FormData();
      form.append("chat_id", target);
      form.append(
        "photo",
        new Blob([new Uint8Array(input.photo)], {
          type:
            input.filename.endsWith(".jpg") || input.filename.endsWith(".jpeg")
              ? "image/jpeg"
              : "image/png",
        }),
        input.filename,
      );
      form.append("parse_mode", "HTML");
      form.append("disable_web_page_preview", "true");
      if (input.caption) form.append("caption", input.caption);
      if (input.replyMarkup) {
        form.append("reply_markup", JSON.stringify(input.replyMarkup));
      }
      const json = await telegramCall(opts.botToken, "sendPhoto", form);
      const result = json.result as { message_id?: number } | undefined;
      return { messageId: result?.message_id ?? 0 };
    },
    async sendVideo(input) {
      const target = input.chatId || opts.chatId;
      if (!opts.botToken || !target) {
        log(`[tg:dry:video ${input.filename}]\n${input.caption ?? ""}`);
        return null;
      }
      const form = new FormData();
      form.append("chat_id", target);
      form.append(
        "video",
        new Blob([new Uint8Array(input.video)], { type: "video/mp4" }),
        input.filename,
      );
      form.append("parse_mode", "HTML");
      form.append("supports_streaming", "true");
      if (input.caption) form.append("caption", input.caption);
      if (input.replyMarkup) {
        form.append("reply_markup", JSON.stringify(input.replyMarkup));
      }
      const json = await telegramCall(opts.botToken, "sendVideo", form);
      const result = json.result as { message_id?: number } | undefined;
      return { messageId: result?.message_id ?? 0 };
    },
    async pin(messageId, chatId) {
      const target = chatId || opts.chatId;
      if (!opts.botToken || !target) return;
      await telegramCall(opts.botToken, "pinChatMessage", {
        chat_id: target,
        message_id: messageId,
        disable_notification: true,
      });
    },
    async unpin(messageId, chatId) {
      const target = chatId || opts.chatId;
      if (!opts.botToken || !target) return;
      const body: Record<string, unknown> = { chat_id: target };
      if (messageId !== undefined) body.message_id = messageId;
      await telegramCall(opts.botToken, "unpinChatMessage", body);
    },
    async edit(messageId, text, chatId, options) {
      const safe = assertTelegramMessageText(text);
      const target = chatId || opts.chatId;
      if (!opts.botToken || !target) return;
      await telegramCall(opts.botToken, "editMessageText", {
        chat_id: target,
        message_id: messageId,
        ...messagePayload(target, safe, options),
      });
    },
    async getPinned(chatId) {
      const target = chatId || opts.chatId;
      if (!opts.botToken || !target) return null;
      const json = await telegramCall(opts.botToken, "getChat", {
        chat_id: target,
      });
      const result = json.result as
        | {
            pinned_message?: {
              message_id?: number;
              text?: string;
              caption?: string;
            };
          }
        | undefined;
      const pinned = result?.pinned_message;
      if (!pinned?.message_id) return null;
      return {
        messageId: pinned.message_id,
        text: pinned.text || pinned.caption || "",
      };
    },
    async setMyCommands(commands) {
      if (!opts.botToken) return;
      await telegramCall(opts.botToken, "setMyCommands", { commands });
    },
  };
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
  };
  channel_post?: {
    message_id: number;
    text?: string;
    chat: { id: number };
  };
}

export async function getTelegramUpdates(
  botToken: string,
  offset: number,
): Promise<TelegramUpdate[]> {
  const url = new URL(`https://api.telegram.org/bot${botToken}/getUpdates`);
  url.searchParams.set("timeout", "25");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set(
    "allowed_updates",
    JSON.stringify(["message", "channel_post"]),
  );
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Telegram getUpdates failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    ok: boolean;
    result: TelegramUpdate[];
  };
  return json.result ?? [];
}
