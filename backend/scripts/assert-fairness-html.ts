/**
 * Local dry assert for /fairness HTML. Does NOT hit Telegram unless
 * CLOSING_BELL_TG_LIVE=1 is set explicitly (founder-only opt-in).
 *
 * Usage:
 *   npx tsx scripts/assert-fairness-html.ts
 */
import { formatFairnessCommand } from "../src/telegram/format.js";
import { assertTelegramMessageText } from "../src/telegram/client.js";
import { publicLinks } from "../src/telegram/links.js";

const html = formatFairnessCommand(publicLinks());
assertTelegramMessageText(html);

const checks: Array<[string, boolean]> = [
  ["is string", typeof html === "string"],
  ["has <b>FAIRNESS</b>", /<b>[^<]*FAIRNESS<\/b>/.test(html)],
  ["has verify URL", html.includes("closingbellonrh.com/verify")],
  ["uses ASCII arrow", html.includes("Same list + same formula -> same wallet.")],
  ["no unicode arrow", !html.includes("→")],
  ["no PSPath", !html.includes("PSPath")],
  ["no \\u003c", !html.includes("\\u003c")],
  ["not JSON array body", !html.trimStart().startsWith("[")],
  ["not JSON object body", !html.trimStart().startsWith("{")],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "ok" : "FAIL"}  ${label}`);
  if (!ok) failed += 1;
}

if (failed > 0) {
  console.error(`fairness HTML assert failed (${failed})`);
  process.exit(1);
}

console.log(`fairness HTML ok (${html.length} chars)`);

if (process.env.CLOSING_BELL_TG_LIVE === "1") {
  console.error(
    "CLOSING_BELL_TG_LIVE=1 is set, but this script never posts. Use the live bot /fairness command instead.",
  );
  process.exit(2);
}
