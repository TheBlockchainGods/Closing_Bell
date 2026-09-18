/**
 * Posts one dry-run win celebration (video + pin) without settling a draw.
 * Uses TELEGRAM_* from env / telegram.secrets.env.
 *
 *   npx tsx scripts/demo-win-celebration.ts
 */
import { config } from "../src/config.js";
import { pinLatestWin, postWinCelebration } from "../src/telegram/celebration.js";
import { createTelegramSender } from "../src/telegram/client.js";
import { formatWinCelebration } from "../src/telegram/format.js";
import { publicSiteOrigin } from "../src/telegram/links.js";

async function main() {
  const sender = createTelegramSender({
    botToken: config.telegramBotToken,
    chatId: config.telegramChatId,
  });
  const caption = formatWinCelebration({
    bellLabel: "Close Bell",
    winner: "0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137",
    amountGme: 1303.902,
    amountUsd: 30224.45,
    dryRun: true,
    txHash: null,
    verifyUrl: `${publicSiteOrigin()}/verify`,
  });
  const posted = await postWinCelebration(sender, caption);
  if (!posted) {
    console.log("Celebration posted locally (no Telegram token/chat).");
    return;
  }
  await pinLatestWin(sender, posted.messageId);
  console.log(`Win celebration ${posted.kind} posted and pinned (message ${posted.messageId}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
