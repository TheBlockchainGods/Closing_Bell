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
    "How trading fees accrue into the Bell Pot display in v1, and what the public jackpot wallet is.",
};

export default function DocsFeesPage() {
  return (
    <article>
      <p className="eyebrow">Fees</p>
      <DocsH1>Fees and the Bell Pot (v1)</DocsH1>
      <DocsLead>
        In v1, trading fees on the pair accrue as claimable creator fees. The
        team claims those fees. A configured jackpot share is treated as pot
        funding. The public jackpot wallet holds GME that the UI shows as the
        Bell Pot (plus unclaimed accruing share).
      </DocsLead>

      <DocsH2 id="display">What the UI shows</DocsH2>
      <DocsPre>{`inPot             = jackpotWalletBalance
accruingUnclaimed = ponsClaimable * JACKPOT_SHARE_BPS / 10000
displayPot        = inPot + accruingUnclaimed`}</DocsPre>
      <DocsUl>
        <li>
          Default <DocsCode>JACKPOT_SHARE_BPS=2000</DocsCode> means 20% of the
          claimable fee balance is counted toward the accruing pot display.
        </li>
        <li>
          <DocsCode>inPot</DocsCode> is GME already in the public jackpot wallet.
        </li>
        <li>
          Exact trading-tax rates are set at launch on the pair contracts. The
          backend does not hardcode a &quot;3% pot fee&quot; string for display.
        </li>
      </DocsUl>

      <DocsH2 id="operator">What humans do in v1</DocsH2>
      <DocsUl>
        <li>Claim accrued trading fees (team / ops).</li>
        <li>
          Sweep the jackpot share into the public{" "}
          <DocsCode>JACKPOT_WALLET</DocsCode> before rings when needed so{" "}
          <DocsCode>inPot</DocsCode> matches what should pay out.
        </li>
        <li>
          Fee wallet addresses used for ops are never exposed in the public API
          or client-bound logs.
        </li>
      </DocsUl>

      <DocsCallout title="Honest scope">
        <p>
          Fee claim and sweep are operator-run in v1. The draw keeper does not
          claim PONS fees for you. Until creator-fee adapters are fully wired,
          some environments still stub claimable and wallet balances with env
          knobs for display. The formulas above stay the contract for how the
          pot number is built.
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
