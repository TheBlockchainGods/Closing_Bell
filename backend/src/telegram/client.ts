/**
 * Telegram transport. Without TELEGRAM_BOT_TOKEN, messages are logged
 * (fixture / local dry path) instead of sent.
 */

export interface TelegramSender {
  enabled: boolean;
  send(text: string): Promise<void>;
}

export function createTelegramSender(opts: {
  botToken: string;
  chatId: string;
  log?: (line: string) => void;
}): TelegramSender {
  const log = opts.log ?? ((line: string) => console.log(line));
  const enabled = Boolean(opts.botToken && opts.chatId);

  return {
    enabled,
    async send(text: string) {
      if (!enabled) {
        log(`[tg:dry]\n${text}`);
        return;
      }
      const url = `https://api.telegram.org/bot${opts.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: opts.chatId,
          text,
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Telegram send failed: ${res.status} ${body}`);
      }
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
}

export async function getTelegramUpdates(
  botToken: string,
  offset: number,
): Promise<TelegramUpdate[]> {
  const url = new URL(`https://api.telegram.org/bot${botToken}/getUpdates`);
  url.searchParams.set("timeout", "25");
  url.searchParams.set("offset", String(offset));
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
