import type { Metadata } from "next";
import Link from "next/link";

import {
  DocsCallout,
  DocsCode,
  DocsH1,
  DocsH2,
  DocsLead,
  DocsP,
  DocsPager,
  DocsUl,
} from "@/components/docs/DocsProse";
import { COMMUNITY } from "@/lib/community";

export const metadata: Metadata = {
  title: "Bellwether Telegram bot",
  description:
    "How to use the Bellwether bot in the Closing Bell community: /pot, /how, /verify, /fairness, /random, and more.",
};

export default function DocsTelegramPage() {
  return (
    <article>
      <p className="eyebrow">Community</p>
      <DocsH1>Bellwether Telegram bot</DocsH1>
      <DocsLead>
        Bellwether is the Closing Bell bot in the community chat. It posts
        jackpot cards, win celebrations, and answers commands. Open the group, then
        type a slash command. You do not need to DM the bot.
      </DocsLead>
      <DocsP>
        Community Telegram:{" "}
        <a
          href={COMMUNITY.telegram.href}
          className="text-brass-200 hover:text-tape"
          target="_blank"
          rel="noreferrer noopener"
        >
          {COMMUNITY.telegram.href}
        </a>
      </DocsP>

      <DocsCallout title="First command to try">
        <p>
          Type <DocsCode>/fairness</DocsCode> or <DocsCode>/random</DocsCode>.
          They are the same reply: trader summary of who picks the winner, then
          the technical stack, plus Verify, Docs, and Site links.
        </p>
      </DocsCallout>

      <DocsH2 id="commands">Commands</DocsH2>
      <DocsUl>
        <li>
          <DocsCode>/fairness</DocsCode>, <DocsCode>/random</DocsCode>,{" "}
          <DocsCode>/draw</DocsCode>: same answer. Who picks the winner, formula{" "}
          <DocsCode>closing-bell-draw-v1</DocsCode>, and how to re-check on{" "}
          <Link href="/verify" className="text-brass-200 hover:text-tape">
            /verify
          </Link>
          .
        </li>
        <li>
          <DocsCode>/pot</DocsCode>: live jackpot card in GME and USD, with a
          share button.
        </li>
        <li>
          <DocsCode>/jackpot</DocsCode> (also <DocsCode>/standings</DocsCode>):
          jackpot pool, next ring, ticket cutoff.
        </li>
        <li>
          <DocsCode>/how</DocsCode>: how tickets, fees, and rings work, including
          Open 9:30 AM ET, Lunch 12:30 PM ET, Close 4:00 PM ET.
        </li>
        <li>
          <DocsCode>/verify</DocsCode>: how to check a published ring on the
          site. No JSON paste in Telegram.
        </li>
        <li>
          <DocsCode>/next</DocsCode>: next Open / Lunch / Close (Open 9:30 AM ET,
          Lunch 12:30 PM ET, Close 4:00 PM ET) and the live pot.
        </li>
        <li>
          <DocsCode>/odds 0x...</DocsCode>: tickets and odds for one wallet.
        </li>
      </DocsUl>
      <DocsP>
        <DocsCode>/ladder</DocsCode> redirects to <DocsCode>/jackpot</DocsCode>.
        Type the command in the group even if it is not yet in the slash menu.
      </DocsP>

      <DocsH2 id="fairness">What /fairness and /random say</DocsH2>
      <DocsP>
        Summary: a person does not pick the winner. The public Closing Bell
        formula <DocsCode>closing-bell-draw-v1</DocsCode> picks one wallet at
        random from the locked ticket list. Same list + same formula, same
        wallet. Check any ring on /verify.
      </DocsP>
      <DocsP>
        Technical: Node.js + TypeScript keeper on Amazon Lightsail. Shared math
        in <DocsCode>packages/fairness</DocsCode>. Seed is keccak256 over public
        inputs (snapshot blockhash material, window id, pot balance). Pick is a
        weighted walk over the locked ticket snapshot (10% odds cap on draw
        weight only). Site /verify runs the same function. MATCH means the
        receipt matches the formula. We do not claim on-chain VRF. We claim a
        public formula you can recompute.
      </DocsP>

      <DocsH2 id="pins">What the bot posts on its own</DocsH2>
      <DocsP>
        Qualifying buys, ticket-entry close, ring skip or win celebration
        (pinned), and a fairness pin when no win pin is up. Win celebration
        shows the full winner wallet and a payout tx line.
      </DocsP>

      <DocsPager
        prev={{
          href: "/docs/operations",
          label: "Automated vs operator-run",
        }}
        next={{ href: "/docs/faq", label: "FAQ" }}
      />
    </article>
  );
}
