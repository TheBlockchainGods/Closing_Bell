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
  title: "Odds and the 10% cap",
  description:
    "How win odds move until bag lock, and what the 10% draw-weight cap does.",
};

export default function DocsOddsPage() {
  return (
    <article>
      <p className="eyebrow">Odds</p>
      <DocsH1>Odds and the 10% cap</DocsH1>
      <DocsLead>
        Your chance of winning moves until the bag locks. The public formula
        then picks one wallet at random from that locked list (see{" "}
        <Link href="/docs/draw" className="text-brass-200 hover:text-tape">
          Bag lock and the draw
        </Link>
        ). The 10% rule caps how much draw weight one wallet can hold versus the
        live ticket bag. It does not freeze your win percent at the moment you
        buy.
      </DocsLead>

      <DocsH2 id="live-odds">Odds move with the bag</DocsH2>
      <DocsP>
        Display odds for a wallet are roughly your tickets divided by tickets
        out in the current window, then capped. As other wallets buy or sell,
        the bag changes, so your percent changes even if you do nothing.
      </DocsP>
      <DocsPre>{`share = tickets / ticketsOut
odds  = min(ODDS_CAP, share)   # ODDS_CAP defaults to 10%`}</DocsPre>

      <DocsH2 id="cap">What the 10% cap actually does</DocsH2>
      <DocsUl>
        <li>
          Default <DocsCode>ODDS_CAP_BPS=1000</DocsCode> means a 10% ceiling on
          draw weight share of the bag.
        </li>
        <li>
          At draw time, each wallet&apos;s weight is{" "}
          <DocsCode>min(tickets, floor(ticketsOut * ODDS_CAP_BPS / 10000))</DocsCode>
          . Excess tickets above that weight are simply not counted.
        </li>
        <li>
          Hitting ~10% early is not a locked win chance for the rest of the
          window. If the bag grows, your capped share is still measured against
          the bag at lock.
        </li>
        <li>
          Spending past the cap still buys $BELL. It does not buy more draw
          weight for that window.
        </li>
      </DocsUl>

      <DocsCallout title="Why the cap exists" tone="note">
        <p>
          The cap exists so one wallet cannot own the bell. It is a draw-weight
          rule against the frozen bag, not a promise that your buy-time percent
          stays fixed.
        </p>
      </DocsCallout>

      <DocsH2 id="ladder">Ladder and lookups</DocsH2>
      <DocsP>
        The site ladder and Telegram <DocsCode>/ladder</DocsCode> /{" "}
        <DocsCode>/odds</DocsCode> commands reuse the same odds math as the API.
        Paste an address on the site to read a position for the open window.
      </DocsP>
      <DocsP>
        Next: how fees fund the pot in{" "}
        <Link href="/docs/fees" className="text-brass-200 hover:text-tape">
          Fees and the Bell Pot (v1)
        </Link>
        .
      </DocsP>

      <DocsPager
        prev={{ href: "/docs/tickets", label: "How tickets work" }}
        next={{ href: "/docs/fees", label: "Fees and the Bell Pot (v1)" }}
      />
    </article>
  );
}
