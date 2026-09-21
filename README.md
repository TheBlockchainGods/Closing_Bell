# Closing Bell ($BELL)

Landing page for Closing Bell, a market-ritual jackpot on the GME pair. Buy inside a trading window to earn Bell tickets, the Bell Pot builds in GME, and at the bell one wallet takes it all.

The marketing site reads pot, ladder, odds, and winners from the public API when `NEXT_PUBLIC_API_BASE` is set (`lib/bell-store.tsx`). Mock data is the SSR snapshot and the fallback if the API is down. Backend Phase 1–2 (indexer, ticket engine, API, Telegram bot, draw keeper) lives in [`backend/`](./backend/) — see [`docs/BACKEND.md`](./docs/BACKEND.md).

## What changed in the ceremony visual pass

- **Palette:** GME charcoal, Robinhood `#00C805`, hat-band red, polished bell gold, marble sheen on panels. Focus rings and nav hover go green. Primary CTAs stay gold. Ring control is GME red.
- **Hero video:** muted YouTube embed behind the hero only, dark scrim, iframe `pointer-events: none`. Ring briefly unmutes; Sound off/on under the ring label. Reduced motion: no iframe.
- **Mascot:** podium logo (gavel strike), not rope-pull. Nav glyph unchanged.

## What changed in the launch chrome pass

- **Launch bar** under the trust tape: full live CA + Copy, PONS, Defined, DexScreener, Docs, Verify. Mirrored in the footer.
- **Docs** at `/docs`: product documentation (tickets, odds, fees, draw, verify, payouts, architecture, ops, FAQ) with sidebar nav.
- **Verify** at `/verify`: one-tap ring check (latest or example); Advanced still has full receipt paste (`packages/fairness`).
- **Roadmap:** brass cards with a Next badge (After Hours first), bullish blurbs, no neon empty grid.
- **After Hours:** one Coming soon badge + weekly GME pot one-liner. Stake UI still disabled. Long "no vault / inert" copy removed.
- **Mock diet:** "Simulated draw…" stays on the Ring control only. Footer mock wall shortened. Stage stays brass; `#00C805` for LIVE pips and social hover only.

## What changed in the polish pass

- **Community links:** Telegram and X icon buttons in the nav (before Check odds) and footer. Opens in a new tab; brass idle, `#00C805` hover.
- **Trust strip:** Static strip under the nav with Jackpot (GME + USD), Next bell countdown + label, and Total paid out. Full Bell Pot and Countdown sections stay where they are.
- **BELLS_24_7 default true:** Market clock rings every calendar day at 09:30 / 12:30 / 16:00 ET. Weekend-dark / Monday-carry copy is gone from Countdown, footer rules, locked rules, and winners.
- **Bell Pot:** Wired all-time Total paid out. Removed the invented 3% pot fee readout; copy now says fees fund the pot. Odds cap stays at 10%.
- **Ring demo:** Continuous Framer Motion on one SVG brass stage + alpha Bellwether cutout (not a flipbook). Simulated draw label on the Ring control. 4s cooldown.
- **Signal green:** `--color-tape` is `#00C805` for LIVE accents only. No Robinhood marks. No neon halo on the mascot.

## What changed in the adjustment pass

Six product decisions landed, in rough order of how much of the UI they moved.

**Odds is now a lookup, not a swap.** Tickets are minted by the on-chain buy itself, so a bot or a terminal earns exactly the same weight as a swap started here. The section leads with an address field that needs no wallet and no signature, the ticket ladder for the window is visible by default, and connect is demoted to a shortcut that just fills the field. The site swap moved into an "Advanced" disclosure that says outright it is not required to earn tickets. Hero CTAs are now **Check odds** and **Trade on PONS**.

**The odds cap is 10%, and the UI says why.** Previously 5%. `MARKET.oddsCap` is the single source, and everything reads from it: the tape, the pot metrics, the dial, the ladder, and the winners feed. The reason is stated in plain English wherever the cap appears: the cap exists so one wallet cannot own the bell. The seeded ladder is deliberately arranged so the top two wallets sit above the cap and the third lands just under it, which puts the cap on screen doing its job.

**Weekends (superseded by polish pass):** The adjustment pass added exchange-calendar weekend carry. The polish pass flips the default to `BELLS_24_7=true` to match the backend, so bells ring every calendar day and that weekend copy is removed.

**After Hours is a roadmap preview.** The section keeps its shape but every figure is labelled an illustrative target rather than a balance, a band across the panel states that no vault exists and no snapshot has been taken, the section carries a **Coming soon** badge, and the stake controls are disabled rather than pretending to take a deposit. The fake staker counts and vault balances are gone from the mock data entirely.

**The mascot is photoreal.** The flat silhouette cat is replaced by a rendered kitten composited over the bell rig, which stays SVG so it can still swing. He is named Bellwether, with one line of lore in the hero and no backstory dump. The nav wordmark keeps the simple brass bell glyph, since that is what reads at 20px.

**Copy no longer implies you must trade here.** The hero, How it works, the locked rules, and the footer all state that however you buy, you earn tickets.

One bug worth flagging, because it was a modelling error rather than a typo: the ladder originally held absolute ticket counts while the window total reset to zero on a ring, so for a few seconds after every ring each wallet's raw share was enormous and the entire ladder pinned to the cap. The ladder is now held as shares of the window, which stays correct at any window size.

## Run it

Requires Node 20 or newer.

```bash
npm install
npm run build -w @closing-bell/fairness
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Optional launch env (root `.env.local`, see `.env.example`):

```bash
NEXT_PUBLIC_TOKEN_ADDRESS=0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7
NEXT_PUBLIC_CHART_URL=https://www.defined.fi/token/robinhood/0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7
NEXT_PUBLIC_API_BASE=https://closing-bell-api.qdwgj1kmyrm0a.us-west-2.cs.amazonlightsail.com
# Local API instead: NEXT_PUBLIC_API_BASE=http://localhost:8787
```

The browser calls `/cb-api/*`, which the Next server proxies to that origin (the Lightsail API does not send CORS headers).

```bash
npm run build      # builds shared fairness package, then Next
npm run start      # serve the production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run test:fairness
```

## How to verify a ring

Anyone can check that a published winner matches the public formula and inputs.

1. Open [/verify](http://localhost:3000/verify).
2. The page loads the latest ring when the API is up, or a sample ring when it is not.
3. Click **Check this ring** (or **Check a sample ring**).
4. Green **MATCH** means this page got the same winner from the published bag and formula. **MISMATCH** means the receipt is wrong.

Advanced (collapsed) still supports paste/upload JSON and the full formula write-up. Draw math lives in [`packages/fairness`](./packages/fairness), shared with the backend keeper.

MATCH is about the draw math matching the receipt. Payout settlement is separate.

Short rules summary in the footer; full docs: [/docs](http://localhost:3000/docs).

## Deploy to AWS Amplify (not Vercel)

Host the Next.js site on **AWS Amplify Hosting**. Keep the API on the existing Lightsail container. Full steps (buy domain, IAM, GitHub connect, DNS): [`docs/AWS_HOSTING.md`](./docs/AWS_HOSTING.md).

Amplify env (must be set before the first build so they bake into the client):

```
NEXT_PUBLIC_API_BASE=https://closing-bell-api.qdwgj1kmyrm0a.us-west-2.cs.amazonlightsail.com
NEXT_PUBLIC_TOKEN_ADDRESS=0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7
NEXT_PUBLIC_CHART_URL=https://www.defined.fi/token/robinhood/0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7
```

`amplify.yml` at the repo root runs `npm ci` then `npm run build` on Node 22.

Notes:

- Fonts load through `next/font/google` at build time, so there are no runtime font requests and no CLS.
- `metadataBase` is `https://closingbellonrh.com`. Add an Open Graph image in `app/layout.tsx` before marketing launch.

## Architecture

```
app/
  layout.tsx          Fonts (Archivo + IBM Plex Mono), metadata, html shell
  page.tsx            Section composition, wrapped in MotionRoot + BellProvider
  docs/               Documentation site (sidebar + nested pages)
  verify/page.tsx     Public ring recomputation
  globals.css         Design tokens, base styles, utilities, component classes
packages/
  fairness/           Shared draw math (keeper + /verify), receipt verify, fixture
components/
  MotionRoot.tsx      MotionConfig reducedMotion="user" for the whole tree
  SiteHeader.tsx      Sticky header, nav, session status, Check odds CTA
  SiteFooter.tsx      Nav, short rules, disclaimers
  Tape.tsx            Scrolling exchange tape (decorative, aria-hidden)
  atmosphere/         Fixed bloom, vignette, and film grain layers
  brand/
    BellStage.tsx     The ritual stage. Animated bell in SVG, mascot as a
                      raster layer, structured for art swap
    Wordmark.tsx      Bell glyph + Closing Bell lockup + $BELL chip
  sections/           One file per numbered section of the page
  ui/                 Button, Section, Reveal, AnimatedNumber, BoardDigits,
                      AmountInput, AddressInput
lib/
  types.ts            Every domain shape the UI consumes
  mock-data.ts        All mocked values, deterministic
  bell-store.tsx      React context holding pot/ladder/ring state + actions
  market-clock.ts     ET bell schedule, weekend carry, countdown math
  use-clock.ts        Shared 1s clock via useSyncExternalStore
  format.ts           Intl number, currency, percent, address, ET timestamp
  motion.ts           Shared easing constant
  cn.ts               Class name join
art/                  Source renders for placeholder art, not shipped
public/mascot/        Web-ready mascot layer
scripts/              Playwright helpers used during development
```

### The mascot layer

`components/brand/BellStage.tsx` shows the static podium still by default and plays `public/brand/bellwether-ring.mp4` once on Ring the Bell (same box size, then back to still). Nav keeps the small brass glyph.

The art in `public/mascot/bellwether-podium.webp` is a white-keyed cutout from `art/bellwether-podium-source.jpg` (`scripts/prepare-podium.mjs`). Brand circular frames under `public/brand/` stay off the marketing stage.

### Swapping mocks for live data

`lib/types.ts` is the contract. Every component consumes those shapes and nothing else, so live data drops in at two seams:

1. **`lib/bell-store.tsx`** polls `/cb-api` (proxied to `NEXT_PUBLIC_API_BASE`) for pot, window, ladder, winners, and odds. Mock constants in `lib/mock-data.ts` are the SSR snapshot and the fallback if the API is down.

2. **`lib/bell-store.tsx` mutations.** `watch` queries `/odds`. The demo `ring` control is still a client ceremony. Live polls pause while it runs, then the next fetch restores API figures.

The countdown, formatters, and clock are real. `lib/market-clock.ts` computes actual Eastern Time bells including DST, weekend skips, and weekend-carry detection, so it stays as-is.

One modelling note worth keeping if you rewrite the store: the ladder is held as **shares** of the window, not absolute ticket counts. That is what keeps it coherent when a ring wipes every ticket to zero and the window rebuilds from nothing. Absolute counts produce a window where every wallet is pinned to the cap.

### Mocked vs real

Anything simulated is labeled in the UI. The address lookup says it is read-only mocked data, the connect button's tooltip states no wallet library is involved, the ring control reads "Simulated draw. No transaction, no funds move.", demo rings are badged in the winners feed, and the whole After Hours panel is banded as a roadmap preview with its controls disabled. No control on the page looks clickable without doing something.

## Locked rules

Surfaced in the page copy, and the numbers in the mock store obey them:

- Buys inside the window earn Bell tickets weighted by GME spent. However you buy, you earn tickets. Per-wallet odds are capped at **10%** at launch, so one wallet cannot own the bell.
- Selling burns tickets pro-rata, immediately, with no cooldown.
- The bell rings, the winner is paid the full Bell Pot in GME, and every Bell ticket wipes to zero.
- **Bells ring every day** at 09:30 / 12:30 / 16:00 ET (`BELLS_24_7=true`). The chain never sleeps.
- **After Hours is roadmap, not live.** Nothing is staked, no vault exists, and no snapshot has been taken.

## Development scripts

All of these need Playwright's Chromium and, apart from the mascot one, a dev server on port 3000.

| Script | What it does |
| --- | --- |
| `shoot.mjs` | Captures desktop, mobile, and reduced-motion, before and after a demo ring, into `shots/` |
| `overflow.mjs` | Walks the DOM at 390px and reports any element wider than the viewport, with its ancestor chain |
| `prepare-podium.mjs` | Keys the white studio ground off the podium logo for the hero stage |
| `prepare-mascot.mjs` | Legacy rope-cutout pipeline (unused on the marketing stage) |
| `odds.mjs` | Drives the address lookup through a capped wallet, an arbitrary address, junk input, and the connect shortcut |
| `weekend.mjs` | Pins the browser clock to a Saturday, a Friday night, and a Wednesday, and asserts the weekend copy appears only when it should |

```bash
npx playwright install chromium
npm run dev
node scripts/shoot.mjs
node scripts/overflow.mjs
node scripts/odds.mjs
node scripts/weekend.mjs
```

None of them are part of the build.

## Disclaimers

Closing Bell is not affiliated with, endorsed by, or connected to Robinhood Markets, Inc. or GameStop Corp. $BELL is a token. It is not GameStop equity and carries no shareholder rights, dividend, or claim on any company. Every value on this page is mocked for preview purposes.
