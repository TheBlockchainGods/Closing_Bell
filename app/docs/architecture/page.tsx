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
  DocsTable,
  DocsUl,
} from "@/components/docs/DocsProse";

export const metadata: Metadata = {
  title: "System architecture and tech",
  description:
    "Frontend, backend, AWS Lightsail, Telegram, shared fairness package, fixture vs cloud.",
};

export default function DocsArchitecturePage() {
  return (
    <article>
      <p className="eyebrow">Architecture</p>
      <DocsH1>System architecture and tech</DocsH1>
      <DocsLead>
        Closing Bell is a Next.js site plus a Node/TypeScript backend (API,
        indexer, draw keeper, Telegram) on Postgres. Shared draw math lives in{" "}
        <DocsCode>@closing-bell/fairness</DocsCode>. Cloud backend deploy target
        in this repo is Amazon Lightsail in us-west-2.
      </DocsLead>

      <DocsH2 id="frontend">Frontend</DocsH2>
      <DocsUl>
        <li>
          Next.js App Router marketing and docs site (this repo root).
        </li>
        <li>
          Public pages include the ritual home,{" "}
          <Link href="/docs" className="text-brass-200 hover:text-tape">
            /docs
          </Link>
          , and{" "}
          <Link href="/verify" className="text-brass-200 hover:text-tape">
            /verify
          </Link>
          .
        </li>
        <li>
          Hosting: AWS Amplify Hosting (GitHub → <DocsCode>next build</DocsCode>
          , custom domain <DocsCode>closingbellonrh.com</DocsCode>). Point{" "}
          <DocsCode>NEXT_PUBLIC_API_BASE</DocsCode> at the public Lightsail API
          URL. The site proxies that origin at <DocsCode>/cb-api</DocsCode>. See{" "}
          <DocsCode>docs/AWS_HOSTING.md</DocsCode>.
        </li>
        <li>
          Launch knobs: <DocsCode>NEXT_PUBLIC_TOKEN_ADDRESS</DocsCode>,{" "}
          <DocsCode>NEXT_PUBLIC_CHART_URL</DocsCode>,{" "}
          <DocsCode>NEXT_PUBLIC_DRY_RUN_PAYOUTS</DocsCode>.
        </li>
      </DocsUl>

      <DocsH2 id="backend">Backend</DocsH2>
      <DocsUl>
        <li>Node / TypeScript service under <DocsCode>backend/</DocsCode>.</li>
        <li>
          Read API (examples): <DocsCode>GET /health</DocsCode>,{" "}
          <DocsCode>/pot</DocsCode>, <DocsCode>/window/current</DocsCode>,{" "}
          <DocsCode>/odds</DocsCode>, <DocsCode>/ladder</DocsCode>,{" "}
          <DocsCode>/winners</DocsCode>.
        </li>
        <li>Indexer: on-chain buys/sells mint and burn tickets.</li>
        <li>
          Draw keeper: bag lock,{" "}
          <DocsCode>closing-bell-draw-v1</DocsCode>, receipt, wipe, optional
          payout send.
        </li>
        <li>Postgres for durable draws, winners, and ticket state.</li>
      </DocsUl>

      <DocsH2 id="aws">Amazon Web Services</DocsH2>
      <DocsP>
        Deploy docs in the repo describe <strong>Lightsail</strong> in region{" "}
        <DocsCode>us-west-2</DocsCode> (Oregon):
      </DocsP>
      <DocsUl>
        <li>
          Lightsail Container Service named{" "}
          <DocsCode>closing-bell-api</DocsCode> (Nano scale in the guide).
        </li>
        <li>
          Lightsail managed Postgres (example name{" "}
          <DocsCode>closing-bell-db</DocsCode>) wired via{" "}
          <DocsCode>DATABASE_URL</DocsCode>.
        </li>
        <li>
          Public HTTP endpoint on port <DocsCode>8787</DocsCode> with health
          check on <DocsCode>/health</DocsCode>. That URL is the public API the
          site and Telegram bot talk to.
        </li>
        <li>
          Image push via Lightsail container registry (or ECR as noted in ops
          docs). Env and secrets stay in the Lightsail deployment config, not in
          git.
        </li>
      </DocsUl>
      <DocsCallout title="Do not invent more AWS" tone="note">
        <p>
          Documented cloud path: Lightsail containers + Lightsail Postgres in
          us-west-2 for the API, AWS Amplify Hosting for this Next.js site. Do
          not assume ECS, extra Lambdas, or a second API host unless you deploy
          them yourself. Railway appears in older backend notes as an alternate
          path.
        </p>
      </DocsCallout>

      <DocsH2 id="telegram">Telegram bot</DocsH2>
      <DocsP>
        Same backend process can announce rings and answer commands when{" "}
        <DocsCode>TELEGRAM_BOT_TOKEN</DocsCode> and{" "}
        <DocsCode>TELEGRAM_CHAT_ID</DocsCode> are set. Without a token, announces
        log as <DocsCode>[tg:dry]</DocsCode>.
      </DocsP>
      <DocsUl>
        <li>
          Commands: <DocsCode>/pot</DocsCode>, <DocsCode>/odds</DocsCode>,{" "}
          <DocsCode>/ladder</DocsCode>, <DocsCode>/next</DocsCode>.
        </li>
        <li>
          All commands reuse runtime / API math (no second odds formula).
        </li>
      </DocsUl>

      <DocsH2 id="fairness">Shared fairness package</DocsH2>
      <DocsP>
        <DocsCode>packages/fairness</DocsCode> exports{" "}
        <DocsCode>closing-bell-draw-v1</DocsCode>: odds helpers, capped weights,
        seed, weighted pick, snapshot hash. Backend keeper and{" "}
        <Link href="/verify" className="text-brass-200 hover:text-tape">
          /verify
        </Link>{" "}
        import the same package so receipt MATCH cannot drift from keeper math.
      </DocsP>

      <DocsH2 id="fixture-vs-cloud">Local fixture mode vs cloud</DocsH2>
      <DocsTable
        headers={["Mode", "What runs", "Typical flags"]}
        rows={[
          [
            "Local fixture",
            "Docker Compose API + Postgres. Fixture swaps drive tickets. Telegram optional.",
            <>
              <DocsCode>FIXTURE_MODE=true</DocsCode>,{" "}
              <DocsCode>DRY_RUN_PAYOUTS=true</DocsCode>
            </>,
          ],
          [
            "Cloud (Lightsail)",
            "Same container image on Lightsail with managed Postgres. Public /health API.",
            <>
              Same knobs until go-live. Set live{" "}
              <DocsCode>RPC_URL</DocsCode> / token addresses when indexing for
              real.
            </>,
          ],
          [
            "Go-live payouts",
            "Keeper still picks via formula. GME transfer enabled only when dry-run is off and jackpot keying is configured.",
            <>
              <DocsCode>FIXTURE_MODE=false</DocsCode>,{" "}
              <DocsCode>DRY_RUN_PAYOUTS=false</DocsCode>
            </>,
          ],
        ]}
      />

      <DocsH2 id="seed">Seed material (reference)</DocsH2>
      <DocsPre>{`material = lowercase(blockhashAtSnapshot) + "|" + windowId + "|" + potBalance
seed     = keccak256(UTF-8 bytes of material)
cursor   = seed mod totalCappedWeight
# then walk entrants sorted by weight DESC, address ASC`}</DocsPre>

      <DocsPager
        prev={{ href: "/docs/payouts", label: "Payouts" }}
        next={{
          href: "/docs/operations",
          label: "Automated vs operator-run",
        }}
      />
    </article>
  );
}
