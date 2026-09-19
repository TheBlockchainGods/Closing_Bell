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
  title: "Payouts",
  description: "How the Bell Pot pays the formula winner in GME.",
};

export default function DocsPayoutsPage() {
  return (
    <article>
      <p className="eyebrow">Payouts</p>
      <DocsH1>Payouts</DocsH1>
      <DocsLead>
        When a ring completes with a winner and enough pot, GME moves from the
        public jackpot wallet to the formula winner. A person does not pick that
        wallet. The public formula does.
      </DocsLead>

      <DocsH2 id="flow">Payout flow</DocsH2>
      <DocsUl>
        <li>
          Public formula <DocsCode>closing-bell-draw-v1</DocsCode> picks the
          winner and the receipt is published.
        </li>
        <li>
          Payout amount is the pot intended for that ring (jackpot wallet GME
          after operator sweep, subject to{" "}
          <DocsCode>MIN_POT_GME</DocsCode>).
        </li>
        <li>
          The payout transaction is sent to the formula winner. That send is
          keeper- or operator-assisted depending on deployment. Humans still do
          not choose the wallet.
        </li>
        <li>
          Tickets wipe. The next window opens on schedule.
        </li>
      </DocsUl>

      <DocsH2 id="operator">What operators still do</DocsH2>
      <DocsP>
        Fee claim and pot sweep remain operator-run in v1 so the jackpot wallet
        holds what should pay. See{" "}
        <Link href="/docs/fees" className="text-brass-200 hover:text-tape">
          Fees and the Bell Pot (v1)
        </Link>{" "}
        and{" "}
        <Link href="/docs/operations" className="text-brass-200 hover:text-tape">
          Automated vs operator-run
        </Link>
        .
      </DocsP>

      <DocsPager
        prev={{ href: "/docs/verify", label: "Verify a ring" }}
        next={{
          href: "/docs/architecture",
          label: "System architecture and tech",
        }}
      />
    </article>
  );
}
