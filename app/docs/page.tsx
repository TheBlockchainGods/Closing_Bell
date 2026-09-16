import type { Metadata } from "next";
import Link from "next/link";

import {
  DocsCallout,
  DocsH1,
  DocsH2,
  DocsLead,
  DocsOl,
  DocsP,
  DocsPager,
  DocsUl,
} from "@/components/docs/DocsProse";
import { DOCS_NAV } from "@/lib/docs-nav";

export const metadata: Metadata = {
  title: "Introduction",
  description:
    "What Closing Bell is, who it is for, and how to read these docs.",
};

export default function DocsIntroPage() {
  return (
    <article>
      <p className="eyebrow">Introduction</p>
      <DocsH1>Closing Bell docs</DocsH1>
      <DocsLead>
        Closing Bell ($BELL) is a market ritual on the GME pair. Buy $BELL during
        an open window, earn Bell tickets, watch the Bell Pot climb, and when the
        bell rings one wallet takes the pot in GME. Tickets wipe. The next window
        starts fresh.
      </DocsLead>

      <DocsCallout title="Who picks the winner">
        <p>
          Nobody on the team picks a wallet. The draw keeper runs the published
          formula <code className="font-mono text-brass-200">closing-bell-draw-v1</code>.
          Operators claim fees, sweep the pot wallet, and (when live) send the
          payout transaction to the formula winner. They do not choose who wins.
        </p>
      </DocsCallout>

      <DocsH2 id="start-here">Start here</DocsH2>
      <DocsOl>
        {DOCS_NAV.filter((item) => item.href !== "/docs").map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-brass-200 hover:text-tape">
              {item.label}
            </Link>
          </li>
        ))}
      </DocsOl>

      <DocsH2 id="schedule">Bell schedule</DocsH2>
      <DocsP>
        Bells ring every calendar day at <strong>09:30</strong>,{" "}
        <strong>12:30</strong>, and <strong>16:00</strong> America/New_York
        (Open, Lunch, Close). Robinhood Chain never sleeps, so weekends use the
        same schedule.
      </DocsP>

      <DocsH2 id="how-to-read">How to read these docs</DocsH2>
      <DocsUl>
        <li>
          Product pages (tickets, odds, fees, draw) are written for traders
          first, then add precise formulas.
        </li>
        <li>
          Architecture and operations pages describe what software runs where,
          including AWS Lightsail for the API and Amplify for this site.
        </li>
        <li>
          After any ring, use{" "}
          <Link href="/verify" className="text-brass-200 hover:text-tape">
            /verify
          </Link>{" "}
          to recompute the published receipt with the same math as the keeper.
        </li>
      </DocsUl>

      <DocsCallout title="Payouts mode">
        <p>
          Live draw math always runs. Whether GME actually leaves the jackpot
          wallet depends on deployment flags such as{" "}
          <code className="font-mono text-brass-200">DRY_RUN_PAYOUTS</code>. When
          dry-run is on, the winner and receipt are still published; the transfer
          is skipped. See{" "}
          <Link href="/docs/payouts" className="text-brass-200 hover:text-tape">
            Payouts
          </Link>
          .
        </p>
      </DocsCallout>

      <DocsPager next={{ href: "/docs/tickets", label: "How tickets work" }} />
    </article>
  );
}
