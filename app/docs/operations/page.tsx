import type { Metadata } from "next";
import Link from "next/link";

import {
  DocsCode,
  DocsH1,
  DocsH2,
  DocsLead,
  DocsP,
  DocsPager,
  DocsTable,
} from "@/components/docs/DocsProse";

export const metadata: Metadata = {
  title: "Automated vs operator-run",
  description:
    "What the keeper runs automatically vs what operators claim, sweep, and pay.",
};

export default function DocsOperationsPage() {
  return (
    <article>
      <p className="eyebrow">Operations</p>
      <DocsH1>Automated vs operator-run</DocsH1>
      <DocsLead>
        A person does not pick the winner. The public formula picks one wallet
        at random from the locked ticket list. Operators handle fee claim, pot
        sweep, and (when live) making sure the payout transaction reaches that
        formula winner.
      </DocsLead>

      <DocsH2 id="table">Who does what</DocsH2>
      <DocsTable
        headers={["Job", "Who", "Notes"]}
        rows={[
          [
            "Index buys / sells, mint / burn tickets",
            "Automated",
            "Indexer against the GME pair.",
          ],
          [
            "Bag lock + draw (closing-bell-draw-v1)",
            "Automated",
            "Public formula picks the wallet. Humans do not.",
          ],
          [
            "Publish receipt + wipe tickets",
            "Automated",
            "Persisted for /verify and winners feed.",
          ],
          [
            "Telegram announces + /pot /odds /ladder /next",
            "Automated",
            "When bot token and chat id are set.",
          ],
          [
            "Claim trading fees",
            "Operator",
            "v1: team claims accrued creator fees.",
          ],
          [
            "Sweep jackpot share into public pot wallet",
            "Operator",
            <>
              Funds <DocsCode>JACKPOT_WALLET</DocsCode> before rings as needed.
            </>,
          ],
          [
            "Payout tx (GME to winner)",
            "Operator / keeper",
            <>
              Always to the formula winner. Keeper or ops send GME to that
              wallet. Never a hand-picked address.
            </>,
          ],
        ]}
      />

      <DocsH2 id="not-ops">What operators never do</DocsH2>
      <DocsP>
        Operators do not choose the winning address, re-roll a ring after a
        receipt is published, or change weights after bag lock. If a receipt
        exists,{" "}
        <Link href="/verify" className="text-brass-200 hover:text-tape">
          /verify
        </Link>{" "}
        is the check that math MATCHES.
      </DocsP>

      <DocsPager
        prev={{
          href: "/docs/architecture",
          label: "System architecture and tech",
        }}
        next={{
          href: "/docs/telegram",
          label: "Bellwether Telegram bot",
        }}
      />
    </article>
  );
}
