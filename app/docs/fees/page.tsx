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
  title: "Fees and the Bell Pot (v1)",
  description:
    "How ~4% PONS creator fees split 50/50 into jackpot and treasury, and what the Bell Pot display shows.",
};

export default function DocsFeesPage() {
  return (
    <article>
      <p className="eyebrow">Fees</p>
      <DocsH1>Fees and the Bell Pot (v1)</DocsH1>
      <DocsLead>
        PONS charges about a 4% creator tax on the pair. Half of claimed fees go
        to the jackpot, half to treasury. The site shows the public jackpot
        wallet GME balance plus 50% of still-unclaimed creator fees. Who gets
        paid: the public formula picks one wallet at random from the locked
        ticket list (see{" "}
        <Link href="/docs/draw" className="text-brass-200 hover:text-tape">
          Bag lock and the draw
        </Link>
        ).
      </DocsLead>

      <DocsH2 id="display">What the UI shows</DocsH2>
      <DocsPre>{`inPot             = GME.balanceOf(JACKPOT_WALLET)
accruingUnclaimed = ponsClaimable * JACKPOT_SHARE_BPS / 10000
displayPot        = inPot + accruingUnclaimed`}</DocsPre>
      <DocsUl>
        <li>
          Live <DocsCode>JACKPOT_SHARE_BPS=5000</DocsCode> means 50% of unclaimed
          creator fees count toward the accruing pot.
        </li>
        <li>
          <DocsCode>inPot</DocsCode> is on-chain GME already in the public jackpot
          wallet.
        </li>
        <li>
          After a claim, half of those fees are swept toward the jackpot wallet
          and half toward treasury. Until claim, the UI still counts 50% of the
          unclaimed balance as accruing.
        </li>
      </DocsUl>

      <DocsH2 id="operator">What humans do in v1</DocsH2>
      <DocsUl>
        <li>Claim accrued trading fees (team / ops).</li>
        <li>
          Sweep the jackpot half into the public{" "}
          <DocsCode>JACKPOT_WALLET</DocsCode> so <DocsCode>inPot</DocsCode> matches
          what should pay out.
        </li>
        <li>
          Fee wallet addresses used for ops are never exposed in the public API
          or client-bound logs.
        </li>
      </DocsUl>

      <DocsCallout title="Honest scope">
        <p>
          Live <DocsCode>/pot</DocsCode> reads the jackpot wallet GME{" "}
          <DocsCode>balanceOf</DocsCode> and the 50% share of unclaimed PONS
          creator fees.{" "}
          <DocsCode>JACKPOT_WALLET_BALANCE_GME</DocsCode> and{" "}
          <DocsCode>PONS_CLAIMABLE_GME</DocsCode> are optional local overrides
          only (tests / dry local). Production leaves them unset and reads
          chain + PONS. Amounts from 0.01 GME show on the site and Telegram.
          Rings still skip below <DocsCode>MIN_POT_GME</DocsCode> (default 1 GME).
          Gas to send GME later is ETH on Robinhood Chain (about 0.004 ETH in
          the jackpot wallet).
        </p>
      </DocsCallout>

      <DocsH2 id="min-pot">Minimum pot to ring</DocsH2>
      <DocsP>
        If the display pot is below <DocsCode>MIN_POT_GME</DocsCode> (default 1
        GME) or there is no draw weight, the keeper skips the ring and
        announces. See{" "}
        <Link href="/docs/operations" className="text-brass-200 hover:text-tape">
          Automated vs operator-run
        </Link>
        .
      </DocsP>

      <DocsPager
        prev={{ href: "/docs/odds", label: "Odds and the 10% cap" }}
        next={{ href: "/docs/draw", label: "Bag lock and the draw" }}
      />
    </article>
  );
}
