import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { TelegramSender } from "./client.js";
import { isWinCelebrationText } from "./format.js";

const here = dirname(fileURLToPath(import.meta.url));

const VIDEO_CANDIDATES = [
  resolve(here, "../../assets/closing-bell-celebrate.mp4"),
  resolve(here, "../../../backend/assets/closing-bell-celebrate.mp4"),
];

const STILL_CANDIDATES = [
  resolve(here, "../../assets/closing-bell-celebrate.jpg"),
  resolve(here, "../../assets/closing-bell-celebrate.png"),
  resolve(here, "../../../backend/assets/closing-bell-celebrate.jpg"),
];

function firstExisting(paths: string[]): string | null {
  return paths.find((path) => existsSync(path)) ?? null;
}

export function celebrationVideoPath(): string | null {
  return firstExisting(VIDEO_CANDIDATES);
}

export function celebrationStillPath(): string | null {
  return firstExisting(STILL_CANDIDATES);
}

export type WinPostKind = "video" | "photo" | "text";

export async function postWinCelebration(
  sender: TelegramSender,
  caption: string,
): Promise<{ messageId: number; kind: WinPostKind } | null> {
  const videoPath = celebrationVideoPath();
  if (videoPath) {
    try {
      const posted = await sender.sendVideo({
        video: readFileSync(videoPath),
        filename: "closing-bell-celebrate.mp4",
        caption,
      });
      if (posted?.messageId) return { messageId: posted.messageId, kind: "video" };
      if (!sender.enabled) return null;
    } catch (err) {
      console.error("Telegram win video failed, falling back to still:", err);
    }
  }

  const stillPath = celebrationStillPath();
  if (stillPath) {
    try {
      const posted = await sender.sendPhoto({
        photo: readFileSync(stillPath),
        filename: stillPath.endsWith(".png")
          ? "closing-bell-celebrate.png"
          : "closing-bell-celebrate.jpg",
        caption,
      });
      if (posted?.messageId) return { messageId: posted.messageId, kind: "photo" };
    } catch (err) {
      console.error("Telegram win still failed, falling back to text:", err);
    }
  }

  const posted = await sender.send(caption);
  if (posted?.messageId) return { messageId: posted.messageId, kind: "text" };
  return null;
}

export async function pinLatestWin(
  sender: TelegramSender,
  messageId: number,
): Promise<void> {
  const existing = await sender.getPinned();
  if (
    existing &&
    existing.messageId !== messageId &&
    isWinCelebrationText(existing.text)
  ) {
    try {
      await sender.unpin(existing.messageId);
    } catch (err) {
      console.error("Telegram unpin previous win failed:", err);
    }
  }
  await sender.pin(messageId);
}
