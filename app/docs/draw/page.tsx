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
  DocsPre,
  DocsUl,
} from "@/components/docs/DocsProse";

export const metadata: Metadata = {
  title: "Bag lock and the draw",
  description:
    "How the bag locks, how closing-bell-draw-v1 picks a winner, and what operators never do.",
};

export default function DocsDrawPage() {
  return (
    <article>
      <p className="eyebrow">Draw</p>
      <DocsH1>Bag lock and the draw</DocsH1>
      <DocsLead>
        Two minutes before each scheduled bell, the ticket bag freezes. The
        public formula <DocsCode>closing-bell-draw-v1</DocsCode> picks one wallet
        at random from that locked list. A person does not pick. Anyone can
        re-check on{" "}
        <Link href="/verify" className="text-brass-200 hover:text-tape">
          /verify
        </Link>
        .
      </DocsLead>

      <DocsH2 id="lock">Bag lock</DocsH2>
      <DocsP>
        Default <DocsCode>SNAPSHOT_LEAD_SECONDS=120</DocsCode>. At lock time the
        keeper freezes each wallet&apos;s ticket balance for that window. Buys
        and sells after lock do not change weights for the upcoming ring. Odds
        you saw earlier were live against a moving bag. The draw uses the frozen
        bag only.
      </DocsP>

      <DocsH2 id="plain">Plain English</DocsH2>
      <DocsOl>
        <li>Lock the bag (ticket balances per wallet).</li>
        <li>
          Cap each wallet&apos;s weight at 10% of tickets out (see{" "}
          <Link href="/docs/odds" className="text-brass-200 hover:text-tape">
            Odds and the 10% cap
          </Link>
          ).
        </li>
        <li>
          Build a seed from public inputs: block hash at snapshot, window id,
          and pot balance. Fixture mode uses a published synthetic hash. Live
          mode reads the latest chain block hash at bag lock.
        </li>
        <li>
          Walk the capped weights with that seed until one wallet is selected.
          The frozen bag is also hashed for the receipt so anyone can check it.
        </li>
        <li>
          Publish the receipt (winner, seed, weights, formula id). Anyone can
          recompute it on{" "}
          <Link href="/verify" className="text-brass-200 hover:text-tape">
            /verify
          </Link>
          .
        </li>
      </DocsOl>

      <DocsCallout title="No manual winner">
        <p>
          The public formula picks the wallet. Operators may claim fees, sweep
          the pot wallet, and send the payout transaction to the formula winner.
          They never choose or override the winning wallet.
        </p>
      </DocsCallout>

      <DocsH2 id="technical">Technical steps (closing-bell-draw-v1)</DocsH2>
      <DocsP>
        The draw service is a Node.js + TypeScript keeper hosted on Amazon
        Lightsail. Shared implementation lives in{" "}
        <DocsCode>packages/fairness</DocsCode> and is imported by that keeper.
        High level:
      </DocsP>
      <DocsPre>{`1. Cap each wallet:
     weight = min(tickets, floor(ticketsOut * ODDS_CAP_BPS / 10000))
2. Sort entrants: weight DESC, then address ASC.
3. Seed material (UTF-8), then keccak256:
     lowercase(blockhashAtSnapshot) | windowId | potBalance
     (potBalance uses toFixed(8) when passed as a number)
4. cursor = seed mod totalWeight; walk weights until the pick lands.
5. Emit receipt: formulaId closing-bell-draw-v1, seed, winner, weights.
   Snapshot hash (separate): sort address ASC, join "address:tickets"
   with newlines, keccak256 UTF-8.`}</DocsPre>
      <DocsUl>
        <li>
          Formula id string: <DocsCode>closing-bell-draw-v1</DocsCode>.
        </li>
        <li>
          Same package powers the keeper and the{" "}
          <Link href="/verify" className="text-brass-200 hover:text-tape">
            Verify a ring
          </Link>{" "}
          page. MATCH means the receipt recomputes identically.
        </li>
        <li>
          This is a published deterministic formula over public inputs. We do
          not claim on-chain VRF. We claim a public formula you can recompute.
        </li>
      </DocsUl>

      <DocsH2 id="skip">When a ring is skipped</DocsH2>
      <DocsP>
        If pot is below <DocsCode>MIN_POT_GME</DocsCode>, or total capped weight is
        zero, the keeper skips payout and announces. Tickets still wipe for that
        window per product rules when the window closes.
      </DocsP>

      <DocsPager
        prev={{ href: "/docs/fees", label: "Fees and the Bell Pot (v1)" }}
        next={{ href: "/docs/verify", label: "Verify a ring" }}
      />
    </article>
  );
}
