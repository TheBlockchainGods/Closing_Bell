import type { Metadata } from "next";
import Link from "next/link";

import {
  DocsCode,
  DocsH1,
  DocsH2,
  DocsLead,
  DocsP,
  DocsPager,
  DocsUl,
} from "@/components/docs/DocsProse";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Common questions about tickets, odds, the draw, verify, fees, and hosting.",
};

export default function DocsFaqPage() {
  return (
    <article>
      <p className="eyebrow">FAQ</p>
      <DocsH1>FAQ</DocsH1>
      <DocsLead>
        Short answers. Each links deeper when you want the full page.
      </DocsLead>

      <DocsH2 id="who-picks">Who picks the winner?</DocsH2>
      <DocsP>
        The draw keeper runs{" "}
        <DocsCode>closing-bell-draw-v1</DocsCode>. Humans do not pick wallets.
        See{" "}
        <Link href="/docs/draw" className="text-brass-200 hover:text-tape">
          Bag lock and the draw
        </Link>
        .
      </DocsP>

      <DocsH2 id="verify">How do I verify a ring?</DocsH2>
      <DocsP>
        Open{" "}
        <Link href="/verify" className="text-brass-200 hover:text-tape">
          /verify
        </Link>
        , load the receipt, run the same formula. MATCH means the receipt equals
        the formula output. Docs:{" "}
        <Link href="/docs/verify" className="text-brass-200 hover:text-tape">
          Verify a ring
        </Link>
        .
      </DocsP>

      <DocsH2 id="buy">Do I have to buy on this website?</DocsH2>
      <DocsP>
        No. However you buy, you earn tickets. On-chain buys of $BELL on the GME
        pair during an open window mint tickets.{" "}
        <Link href="/docs/tickets" className="text-brass-200 hover:text-tape">
          How tickets work
        </Link>
        .
      </DocsP>

      <DocsH2 id="odds-freeze">Do my odds freeze when I buy?</DocsH2>
      <DocsP>
        No. Odds move until the bag locks. The 10% rule caps draw weight versus
        the live bag. It does not freeze win percent at buy time.{" "}
        <Link href="/docs/odds" className="text-brass-200 hover:text-tape">
          Odds and the 10% cap
        </Link>
        .
      </DocsP>

      <DocsH2 id="fees-pot">How do fees reach the pot in v1?</DocsH2>
      <DocsP>
        Trading fees accrue as claimable creator fees. The team claims them. A
        jackpot share is swept into the public pot wallet. The UI shows wallet
        balance plus accruing unclaimed share.{" "}
        <Link href="/docs/fees" className="text-brass-200 hover:text-tape">
          Fees and the Bell Pot (v1)
        </Link>
        .
      </DocsP>

      <DocsH2 id="aws">What runs on AWS?</DocsH2>
      <DocsP>
        API and Telegram: Lightsail Container Service (
        <DocsCode>closing-bell-api</DocsCode>) and Lightsail Postgres in{" "}
        <DocsCode>us-west-2</DocsCode>. Next.js site: AWS Amplify Hosting for{" "}
        <DocsCode>closingbellonrh.com</DocsCode>.{" "}
        <Link
          href="/docs/architecture"
          className="text-brass-200 hover:text-tape"
        >
          System architecture and tech
        </Link>
        .
      </DocsP>

      <DocsH2 id="schedule">When do bells ring?</DocsH2>
      <DocsP>
        09:30, 12:30, and 16:00 America/New_York every calendar day when{" "}
        <DocsCode>BELLS_24_7</DocsCode> is on (default).
      </DocsP>

      <DocsH2 id="telegram">Telegram commands?</DocsH2>
      <DocsUl>
        <li>
          <DocsCode>/pot</DocsCode> · <DocsCode>/odds</DocsCode> ·{" "}
          <DocsCode>/ladder</DocsCode> · <DocsCode>/next</DocsCode> ·{" "}
          <DocsCode>/how</DocsCode>
        </li>
      </DocsUl>

      <DocsPager
        prev={{
          href: "/docs/operations",
          label: "Automated vs operator-run",
        }}
      />
    </article>
  );
}
