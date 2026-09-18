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
  DocsPre,
  DocsUl,
} from "@/components/docs/DocsProse";

export const metadata: Metadata = {
  title: "How tickets work",
  description:
    "How Bell tickets mint, burn, and wipe. Min buy, rate, and window rules.",
};

export default function DocsTicketsPage() {
  return (
    <article>
      <p className="eyebrow">Tickets</p>
      <DocsH1>How tickets work</DocsH1>
      <DocsLead>
        However you buy, you earn tickets. An on-chain buy of $BELL on the GME
        pair during an open window mints Bell tickets. You do not need to trade
        through this website. A person does not pick the winner. The public
        formula picks one wallet at random from the locked ticket list (see{" "}
        <Link href="/docs/draw" className="text-brass-200 hover:text-tape">
          Bag lock and the draw
        </Link>
        ).
      </DocsLead>

      <DocsH2 id="mint">Mint on buy</DocsH2>
      <DocsP>
        The indexer watches buys against the GME pair. Ticket weight is based on
        USD spent (GME amount times the USD price used by the backend), not on
        how long you have held the bag.
      </DocsP>
      <DocsPre>{`usdSpent = GME_amount * GME_USD_price
tickets  = usdSpent < MIN_BUY_USD ? 0 : floor(usdSpent * TICKETS_PER_USD)`}</DocsPre>
      <DocsUl>
        <li>
          Default <DocsCode>MIN_BUY_USD</DocsCode> is <strong>5</strong>. Buys
          under that mint zero tickets.
        </li>
        <li>
          Default <DocsCode>TICKETS_PER_USD</DocsCode> is <strong>1000</strong>.
        </li>
        <li>
          Buys from routers, aggregators, bots, and this site all count the same
          once they land on-chain.
        </li>
      </DocsUl>

      <DocsH2 id="burn">Sell burns tickets</DocsH2>
      <DocsP>
        Selling burns tickets pro-rata in the same flow. Roughly: if you sell
        40% of your $BELL balance, about 40% of your tickets for that window
        burn. Conviction is the entry fee.
      </DocsP>
      <DocsPre>{`burned = floor(tickets * bellSold / bellBalanceBefore)`}</DocsPre>

      <DocsH2 id="wipe">Wipe at the bell</DocsH2>
      <DocsP>
        When a ring settles, every Bell ticket in the window goes to zero. Your
        $BELL balance is separate. The next Open / Lunch / Close window rebuilds
        tickets from new buys only.
      </DocsP>

      <DocsH2 id="schedule">Windows</DocsH2>
      <DocsP>
        Tickets accrue only while the window is open. Two minutes before each
        bell, the bag locks (see{" "}
        <Link href="/docs/draw" className="text-brass-200 hover:text-tape">
          Bag lock and the draw
        </Link>
        ). After lock, new buys do not change that ring&apos;s frozen bag.
      </DocsP>

      <DocsCallout title="Site vs backend wording">
        <p>
          Some marketing UI mocks still show a simplified &quot;tickets per
          GME&quot; figure. The live ticket engine uses USD spent after price
          conversion, with the defaults above. Treat{" "}
          <DocsCode>MIN_BUY_USD</DocsCode> and{" "}
          <DocsCode>TICKETS_PER_USD</DocsCode> as the source of truth.
        </p>
      </DocsCallout>

      <DocsPager
        prev={{ href: "/docs", label: "Introduction" }}
        next={{ href: "/docs/odds", label: "Odds and the 10% cap" }}
      />
    </article>
  );
}
