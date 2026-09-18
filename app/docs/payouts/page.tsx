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

export const metadata: Metadata = {
  title: "Payouts",
  description:
    "How the Bell Pot pays the formula winner, and what dry-run mode means.",
};

export default function DocsPayoutsPage() {
  return (
    <article>
      <p className="eyebrow">Payouts</p>
      <DocsH1>Payouts</DocsH1>
      <DocsLead>
        When a ring completes with a winner and enough pot, GME moves from the
        public jackpot wallet to the formula winner. A person does not pick that
        wallet. The public formula does. The draw always runs. The transfer may
        be skipped when dry-run is configured.
      </DocsLead>

      <DocsH2 id="flow">Live payout flow</DocsH2>
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
          When live, the payout transaction is sent to the formula winner. That
          send is operator- or keeper-assisted depending on deployment. Humans
          still do not choose the wallet.
        </li>
        <li>
          Tickets wipe. The next window opens on schedule.
        </li>
      </DocsUl>

      <DocsH2 id="dry-run">Dry-run payouts</DocsH2>
      <DocsCallout title="Optional env note">
        <p>
          If <DocsCode>DRY_RUN_PAYOUTS</DocsCode> is enabled, the keeper still
          runs the formula and publishes the winner and receipt. The GME
          transfer is skipped. Use this for staging or soft launch. It is not
          the default story for the live product.
        </p>
      </DocsCallout>

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
