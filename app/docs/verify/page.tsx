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

export const metadata: Metadata = {
  title: "Verify a ring",
  description:
    "How /verify recomputes closing-bell-draw-v1 and what MATCH means.",
};

export default function DocsVerifyPage() {
  return (
    <article>
      <p className="eyebrow">Verify</p>
      <DocsH1>Verify a ring</DocsH1>
      <DocsLead>
        After a ring, open{" "}
        <Link href="/verify" className="text-brass-200 hover:text-tape">
          /verify
        </Link>
        . Paste or load the published receipt. The page runs the same{" "}
        <DocsCode>closing-bell-draw-v1</DocsCode> math as the keeper.
      </DocsLead>

      <DocsH2 id="match">What MATCH means</DocsH2>
      <DocsP>
        MATCH means the receipt&apos;s winner, seed, and weights recomputed from
        the published inputs equal what the formula produces locally. If
        anything was altered after the fact, verification fails.
      </DocsP>

      <DocsH2 id="steps">How to verify</DocsH2>
      <DocsOl>
        <li>
          Go to{" "}
          <Link href="/verify" className="text-brass-200 hover:text-tape">
            /verify
          </Link>
          .
        </li>
        <li>Load the ring receipt (paste JSON or use a published link).</li>
        <li>
          Confirm formula id is <DocsCode>closing-bell-draw-v1</DocsCode>.
        </li>
        <li>
          Run verify. MATCH means receipt equals formula output. Mismatch means
          do not trust that receipt.
        </li>
      </DocsOl>

      <DocsUl>
        <li>
          Verification is client-side math against the shared fairness package
          (or the same algorithm mirrored for the verify UI).
        </li>
        <li>
          It does not prove that GME already left the jackpot wallet. For that,
          check the payout transaction on the explorer when live payouts are
          enabled. See{" "}
          <Link href="/docs/payouts" className="text-brass-200 hover:text-tape">
            Payouts
          </Link>
          .
        </li>
      </DocsUl>

      <DocsCallout title="Same math as the keeper" tone="note">
        <p>
          The draw keeper and /verify both use{" "}
          <DocsCode>closing-bell-draw-v1</DocsCode>. Winner selection is never
          manual. Verification is how anyone can check that the published
          receipt matches the formula.
        </p>
      </DocsCallout>

      <DocsPager
        prev={{ href: "/docs/draw", label: "Bag lock and the draw" }}
        next={{ href: "/docs/payouts", label: "Payouts" }}
      />
    </article>
  );
}
