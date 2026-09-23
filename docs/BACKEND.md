# Closing Bell — backend architecture

Indexer + ticket engine + read API + Telegram bot + draw keeper for **Closing Bell ($BELL)** on Robinhood Chain (`CHAIN_ID=4663`). The marketing site stays separate.

## Trust model

Tickets are **indexed off-chain from on-chain buy/sell events**. Any venue that trades `$BELL` against GME counts the same. The website swap does **not** mint tickets.

Draws are **keeper-operated**. The operator publishes the seed inputs and frozen bag; anyone can recompute the winner:

```
seed = keccak256(blockhashAtSnapshot | windowId | potBalance)
r    = seed mod totalWeight   # totalWeight uses odds-capped ticket weights
winner = weighted walk over the frozen snapshot bag
```

Public observables: jackpot wallet, pot balances, draw receipts (`GET /winners/:windowId`), payout txs (when live). The marketing site `/verify` page runs the same math from `@closing-bell/fairness`.

**`DRY_RUN_PAYOUTS=true` (default):** compute winner, persist receipt, wipe, announce — **do not** send GME. Verification covers the draw result only.

**`DRY_RUN_PAYOUTS=false`:** ERC-20 transfer of the **announced** jackpot GME from `JACKPOT_WALLET` (requires `JACKPOT_PRIVATE_KEY` + `GME_TOKEN_ADDRESS` + `RPC_URL`). One settle per `windowId`. A successful `tx_hash` is never sent twice. Failed sends still persist the winner, pin an honest WIN CELEBRATION (`payout send failed, pay manually`), and log plus Telegram-alert. They do not fake a paid hash.

**Never** expose marketing / ops / dev fee wallet addresses in API responses or client-bound logs.

## Layout

```
backend/
  src/
    config.ts
    clock/              ET market clock
    tickets/engine.ts   Pure ticket math (shared by API + bot + keeper)
    pot/display.ts
    draw/               Winner selection + durable draws/winners store
    runtime/            Live ticket book; lock/wipe hooks
    indexer/            Venue adapters + idempotent ingest
    telegram/           Announce bot + /pot /jackpot /how /verify /fairness /random
    keeper/             Snapshot + ring worker (+ optional GME send)
    api/server.ts
    db/
  scripts/demo-dry-ring.ts
  fixtures/swaps.json          Production fixture bag (FIXTURE_MODE)
  fixtures/ticket-tape.json    Hand-checked buy/sell story for tests
  docker-compose.yml
  railway.json
docs/BACKEND.md
```

## Ticket formulas

```
usdSpent = GME_amount * GME_USD_price
tickets  = usdSpent < MIN_BUY_USD ? 0 : floor(usdSpent * TICKETS_PER_USD)
```

Exact below-min behavior (`usdSpent < MIN_BUY_USD`, default `$5`):

- Tickets minted for that buy: **0**. Equal to the floor still mints (`$5.00` → `5000` tickets).
- `$BELL` balance still increases by `bellReceived`. Later sells need that inventory so pro-rata burn is correct.
- `spentGme` / `spentUsd` do **not** increase. Only qualifying buys count as spent this window.
- The wallet is omitted from `/ladder` while it has 0 tickets.

Sell burn: `floor(tickets * bellSold / bellBalanceBefore)`. Ring wipe: tickets and spent fields → 0; `$BELL` balances stay.

Odds / draw weight cap: each wallet’s **draw weight** is `min(tickets, floor(ticketsOut * ODDS_CAP_BPS / 10000))`. Excess is not counted. **Ticket inventory is unchanged** (a capped whale still shows full tickets on `/odds` and `/ladder`).

Duplicate trades: ingest key is `event_id = txHash:logIndex`. `INSERT … ON CONFLICT (event_id) DO NOTHING` so a replayed tx does not double-mint.

## Ticket tape (how ticket math was proven)

Checked-in story at `gmeUsdPrice = 10` (hand-checkable dollars). This file is **not** loaded by production `FixtureAdapter` (`fixtures/swaps.json` stays the live fixture bag).

```bash
cd backend
npm test -- ticket-tape ticket-engine
```

`backend/fixtures/ticket-tape.json` is replayed through the ticket engine + a mock ingest pool. The suite asserts Alice’s two buys then half-sell, Bob’s 10% cap (weight only), Carol’s below-min buy (0 tickets, balance kept), Dave on the ladder, window wipe, duplicate-tx no double-mint, and an optional dry-run ring receipt that `verifyRing` reports **MATCH**.

Production Lightsail is `FIXTURE_MODE=false` / `DRY_RUN_PAYOUTS=true` until the go-live checklist in [GO_LIVE.md](./GO_LIVE.md). PONS is pump.fun-style: CA live means trading live. Prefer CREATE2 pre-stage of token + curve, then one-motion launch; fallback is set addresses + `START_BLOCK` and backfill. Indexer uses RPC logs, not DexScreener.

Bag-lock seed: fixture mode uses `syntheticBlockhash(windowId, snapshotAt)`. Live mode (`FIXTURE_MODE=false`) reads the latest chain block hash over RPC. RPC failure logs and falls back to synthetic. `/verify` MATCHES the published hash either way.

## Inspect a wallet / fixture trades (no /admin)

While the API is up (local or Lightsail fixture):

| What | Where |
| --- | --- |
| Tickets, odds, cap, `$BELL` balance, spent this window | `GET /odds?address=0x…` |
| Standings (tickets > 0 only) | `GET /ladder?limit=20` |
| Window tickets-out + phase | `GET /window/current` |
| Checked-in fixture swap tape (`swaps.json`) | `GET /fixture/trades` (404 unless `FIXTURE_MODE=true`) |

Example:

```bash
curl "http://localhost:8787/odds?address=0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137"
curl "http://localhost:8787/ladder?limit=20"
curl "http://localhost:8787/fixture/trades"
```

The accounting proof tape (`ticket-tape.json`) is inspectable by running the tests above, not via `/fixture/trades`.

## Pot display math

Live `/pot` (production):

```
jackpotWalletBalance = GME.balanceOf(JACKPOT_WALLET)
ponsClaimable        = FeeEscrow.balanceOfToken(creator, GME)
                       + unswept curve quoteFee/creatorTax
                       (or hook pendingFees/pendingCreatorTax after PoolCreated)
accruingUnclaimed    = ponsClaimable * JACKPOT_SHARE_BPS / 10000
displayPot           = jackpotWalletBalance + accruingUnclaimed
```

`JACKPOT_WALLET_BALANCE_GME` and `PONS_CLAIMABLE_GME` are optional local overrides only (tests). Production leaves them unset and reads chain `balanceOf` plus PONS claimable. Display may show 0.01–0.99 GME; rings still skip below `MIN_POT_GME` (default 1). Live share is `JACKPOT_SHARE_BPS=5000` (50%).

## Bell schedule (America/New_York)

Open 09:30 · Lunch 12:30 · Close 16:00.

`BELLS_24_7=true` (default): every calendar day. `false`: Mon–Fri only; weekend carry on Monday Open.

## Window state machine (keeper-owned)

1. **open** — mint/burn on live book.
2. **locked** — at `bellAt - SNAPSHOT_LEAD_SECONDS`: freeze snapshot, TG “BAG LOCKED”, persist `draws` row (`phase=locked`).
3. **ring** — at bell:
   - `totalWeight==0` or `displayPot < MIN_POT_GME` → skip + announce
   - else pick winner; dry-run or pay; insert `winners`; wipe; announce
4. **settled** → brief pause → new **open** window

Guards: unique `window_id` on `draws`; settle update only from `phase=locked`.

The ring is driven off `previousBell(now)`, which includes a bell landing
exactly on `now`. `nextBell` only ever returns bells strictly after `now`, so it
can lock a bag but can never fire the ring. A bell older than
`SETTLE_GRACE_SECONDS` is left at `phase=locked` rather than rung late.

## Telegram bot

Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Without a token, announces print as `[tg:dry]` (local fixture path).

Announces: qualifying buys (`usdSpent >= MIN_BUY_USD`), bag locked, ring result / skip, tickets wiped.

Commands (polled): `/pot` `/odds <address>` `/ladder` `/next` — all reuse runtime/API math (no duplicated formulas).

## Read API

| Route | Purpose |
| --- | --- |
| `GET /health` | Liveness + public config |
| `GET /pot` | Display pot breakdown |
| `GET /window/current` | phase, next bell, countdown, tickets |
| `GET /odds?address=0x…` | Tickets, odds, cap, `$BELL` balance, spent this window |
| `GET /ladder?limit=20` | Current-window ladder |
| `GET /fixture/trades` | Fixture swap tape (only while `FIXTURE_MODE=true`) |
| `GET /winners?limit=20` | Settled rings (incl. dry_run) |

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `ODDS_CAP_BPS` | `1000` | 10% cap |
| `JACKPOT_SHARE_BPS` | `5000` | 50% of unclaimed creator GME toward display pot |
| `MIN_BUY_USD` | `5` | Ticket floor |
| `TICKETS_PER_USD` | `1000` | Mint rate |
| `MIN_POT_GME` | `1` | Skip ring below this display pot (display may still show 0.01+) |
| `BELLS_24_7` | `true` | Daily vs weekday bells |
| `SNAPSHOT_LEAD_SECONDS` | `120` | Bag lock lead |
| `SETTLE_GRACE_SECONDS` | `900` | How late a missed bell may still ring (restart catch-up) |
| `CHAIN_ID` | `4663` | Robinhood Chain |
| `RPC_URL` | empty | Pot / payouts / draw seed (alias `CHAIN_RPC_URL`) |
| `RPC_FALLBACK_URL` | public RH RPC | Indexer getLogs primary. Default `https://rpc.mainnet.chain.robinhood.com` |
| `TOKEN_ADDRESS` | empty | Launch paste |
| `CURVE_OR_POOL` | empty | Launch paste |
| `JACKPOT_WALLET` | fixture | Public jackpot (alias `JACKPOT_WALLET_ADDRESS`) |
| `GME_TOKEN_ADDRESS` | empty | Required if paying live |
| `JACKPOT_PRIVATE_KEY` | empty | Required if paying live; never log (alias `JACKPOT_WALLET_PRIVATE_KEY`) |
| `EXPLORER_TX_URL_PREFIX` | empty | Optional Blockscout tx prefix |
| `PAYOUT_GAS_LIMIT` | empty | Optional ERC-20 transfer gas |
| `GME_TOKEN_DECIMALS` | empty | Fallback if `decimals()` is unavailable |
| `GME_USD_PRICE` | `23.18` | Stub price |
| `DATABASE_URL` | local compose | Postgres |
| `START_BLOCK` | `0` | Deploy block or earlier. Backfill replays from here even if the indexer starts late |
| `FIXTURE_MODE` | `true` | Mock swaps |
| `DRY_RUN_PAYOUTS` | `true` | No GME send |
| `TELEGRAM_BOT_TOKEN` | empty | Optional |
| `TELEGRAM_CHAT_ID` | empty | Optional |
| `TELEGRAM_ANNOUNCE_BUYS` | `false` | Per-buy BUY + pot/odds channel posts. Default off. Tickets still mint. Slash commands and ring/win posts stay on |
| `TELEGRAM_STARTUP_ANNOUNCE` | `false` | "bot is live" on process start. Default off. No How pin on boot. `/how` is on demand |
| `PUBLIC_SITE_URL` | `https://closingbellonrh.com` | Telegram + verify links |
| `PUBLIC_API_URL` | Lightsail origin | Receipt links |
| `X_URL` | `https://x.com/ClosingBellOnRH` | Share / footer |
| `KEEPER_POLL_MS` | `1000` | Keeper loop |
| `INDEXER_POLL_MS` | `2000` | Indexer loop |
| `PORT` | `8787` | HTTP |

## Local run

```bash
cd backend
cp .env.example .env
docker compose up --build
# or: docker compose up db -d && npm i && npm run migrate && npm run dev
```

Dry-run a full lock → winner → wipe against fixtures (logs TG text if no bot token):

```bash
npm run demo:dry-ring
```

## Flip `DRY_RUN_PAYOUTS=false` (founder approval only)

Do not flip this now. When the founder approves live GME sends:

1. Confirm `/health` `fixtureMode: false`, tickets exist for a real `$BELL` CA, and jackpot wallet GME >= announced `displayPot`.
2. Lightsail env: `DRY_RUN_PAYOUTS=false` only. Keep `JACKPOT_SHARE_BPS=5000`. Restart the container.
3. Boot must succeed: `JACKPOT_PRIVATE_KEY` derives to `JACKPOT_WALLET`; `GME_TOKEN_ADDRESS` and `RPC_URL` set.
4. Each ring: `closing-bell-draw-v1` picks one wallet from the locked ticket list. Keeper ERC-20 `transfer`s `displayPot` to **that winner only**, once per `windowId`, persists `tx_hash`. Skip if pot < `MIN_POT_GME`. Dry-run remaining true means announce only.

Until that flip: keeper announces, records the winner, sends **no** GME.

## Deploy (Railway)

Historical notes. Production is Lightsail ([AWS_LIGHTSAIL.md](./AWS_LIGHTSAIL.md)). Preferred boring path if you still use Railway: one always-on Railway service + Railway Postgres.

**Blocked on this workstation (2026-09-14):** Railway CLI is logged in as `TBG_JUST_G`, but `railway init` failed with:

> Your trial has expired. Please select a plan to continue using Railway.

Next human step: open [https://railway.app/account](https://railway.app/account) → pick a paid plan → then continue below (or use the dashboard path in `backend/README.md`).

### CLI (after plan is active)

```bash
cd backend
railway init --name closing-bell-api
railway add   # Postgres
railway variables set FIXTURE_MODE=true DRY_RUN_PAYOUTS=true PORT=8787
# Also set DATABASE_URL (Postgres plugin), TELEGRAM_*, knobs…
railway up
railway domain
curl https://<domain>/health
```

Do not claim deploy succeeded until `/health` is green.

## Explicit non-goals

- Solidity / BellTreasury (Phase 3)
- After Hours staking
- Website rebuild / wallet connect UI

## Future

Multi-tenant / offer this jackpot+ticket stack to other PONS projects — later.
