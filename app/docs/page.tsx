import type { Metadata } from "next";
import Link from "next/link";

import {
  DocsCallout,
  DocsCode,
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
        bell rings the public formula picks one wallet for the pot in GME.
        Tickets wipe. The next window starts fresh.
      </DocsLead>

      <DocsCallout title="Who picks the winner">
        <p>
          A person does not pick the winner. The public Closing Bell formula{" "}
          <code className="font-mono text-brass-200">closing-bell-draw-v1</code>{" "}
          picks one wallet at random from the locked ticket list. Same list +
          same formula → same wallet. Check any ring on{" "}
          <Link href="/verify" className="text-brass-200 hover:text-tape">
            /verify
          </Link>
          . Operators claim fees, sweep the pot wallet, and (when live) send the
          payout to that formula winner. They do not choose who wins.
        </p>
      </DocsCallout>

      <DocsH2 id="technical">Technical</DocsH2>
      <DocsP>
        The draw service is a Node.js + TypeScript keeper on AWS Lightsail. Shared
        math lives in <DocsCode>packages/fairness</DocsCode>, formula id{" "}
        <DocsCode>closing-bell-draw-v1</DocsCode>. Seed is keccak256 over public
        inputs (snapshot blockhash material, window id, pot balance). The pick is
        a weighted walk over the locked ticket snapshot. The 10% odds cap applies
        to draw weight only. Site{" "}
        <Link href="/verify" className="text-brass-200 hover:text-tape">
          /verify
        </Link>{" "}
        runs the same function. MATCH means the receipt matches the formula. We
        do not claim on-chain VRF. We claim a public formula you can recompute.
      </DocsP>

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
          to recompute the published receipt with the same public formula.
        </li>
      </DocsUl>

      <DocsH2 id="live-vs-next">What&apos;s live vs what&apos;s next</DocsH2>
      <DocsP>
        Live at launch: Core Bell Pot (Open / Lunch / Close), this site,{" "}
        <Link href="/verify" className="text-brass-200 hover:text-tape">
          /verify
        </Link>
        , docs,{" "}
        <Link href="/docs/telegram" className="text-brass-200 hover:text-tape">
          Telegram + Bellwether bot
        </Link>
        , Bell Alerts, and router tape. Those
        are not roadmap items.
      </DocsP>
      <DocsP>
        What&apos;s next only: After Hours (Friday Close stake, weekly GME pot)
        and on-chain proof (live CA, chart, settlement receipts when the
        contract is live). No fake CA or chart links before that.
      </DocsP>

      <DocsPager next={{ href: "/docs/tickets", label: "How tickets work" }} />
    </article>
  );
}
