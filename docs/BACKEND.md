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

**`DRY_RUN_PAYOUTS=false`:** ERC-20 transfer of GME from `JACKPOT_WALLET` (requires `JACKPOT_PRIVATE_KEY` + `GME_TOKEN_ADDRESS` + `RPC_URL`). One settle per `windowId`; failed sends leave the draw locked for retry (no double-pay after a successful mark).

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
    telegram/           Announce bot + /pot /odds /ladder /next
    keeper/             Snapshot + ring worker (+ optional GME send)
    api/server.ts
    db/
  scripts/demo-dry-ring.ts
  fixtures/swaps.json
  docker-compose.yml
  railway.json
docs/BACKEND.md
```

## Ticket formulas

```
usdSpent = GME_amount * GME_USD_price
tickets  = usdSpent < MIN_BUY_USD ? 0 : floor(usdSpent * TICKETS_PER_USD)
```

Sell burn: `floor(tickets * bellSold / bellBalanceBefore)`. Ring wipe: all tickets → 0.

Odds / draw weight cap: each wallet’s draw weight is `min(tickets, floor(ticketsOut * ODDS_CAP_BPS / 10000))`. Excess is not counted.

## Pot display math

```
inPot             = jackpotWalletBalance
accruingUnclaimed = ponsClaimable * JACKPOT_SHARE_BPS / 10000
displayPot        = inPot + accruingUnclaimed
```

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
| `GET /odds?address=0x…` | Position this window |
| `GET /ladder?limit=20` | Current-window ladder |
| `GET /winners?limit=20` | Settled rings (incl. dry_run) |

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `ODDS_CAP_BPS` | `1000` | 10% cap |
| `JACKPOT_SHARE_BPS` | `2000` | Display pot share of claimable |
| `MIN_BUY_USD` | `5` | Ticket floor |
| `TICKETS_PER_USD` | `1000` | Mint rate |
| `MIN_POT_GME` | `1` | Skip ring below this display pot |
| `BELLS_24_7` | `true` | Daily vs weekday bells |
| `SNAPSHOT_LEAD_SECONDS` | `120` | Bag lock lead |
| `CHAIN_ID` | `4663` | Robinhood Chain |
| `RPC_URL` | empty | Indexing + live payouts |
| `TOKEN_ADDRESS` | empty | Launch paste |
| `CURVE_OR_POOL` | empty | Launch paste |
| `JACKPOT_WALLET` | fixture | Public jackpot |
| `GME_TOKEN_ADDRESS` | empty | Required if paying live |
| `JACKPOT_PRIVATE_KEY` | empty | Required if paying live; never log |
| `GME_USD_PRICE` | `23.18` | Stub price |
| `DATABASE_URL` | local compose | Postgres |
| `FIXTURE_MODE` | `true` | Mock swaps |
| `DRY_RUN_PAYOUTS` | `true` | No GME send |
| `TELEGRAM_BOT_TOKEN` | empty | Optional |
| `TELEGRAM_CHAT_ID` | empty | Optional |
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

## Flip `DRY_RUN_PAYOUTS=false` safely

1. Confirm `FIXTURE_MODE=false` and live `TOKEN_ADDRESS` / RPC are correct.
2. Fund **public** `JACKPOT_WALLET` with GME.
3. Set `GME_TOKEN_ADDRESS`, `JACKPOT_PRIVATE_KEY` (must match jackpot wallet).
4. Keep Telegram configured so rings are announced with tx hashes.
5. Restart. Watch one ring end-to-end on a small pot first.
6. Never commit the private key; never put fee/marketing wallets in env that the API echoes.

## Deploy (Railway)

Preferred boring path: one always-on Railway service + Railway Postgres.

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
