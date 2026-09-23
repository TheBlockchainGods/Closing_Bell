# Go live (pump.fun-style: no pause after CA)

PONS trading starts in the same transaction that creates the token. Dev and sniper wallets can buy in block 0 / 1. There is **no** pause to paste addresses, then buy.

Correct model:

- Pre-wire indexer + backend **before** launch
- Prefer CREATE2 / salt so token + curve are known **before** the launch tx (`predictLaunchAddresses` / launch salt)
- Launch + first-block buys are **one motion**
- Safety net = **backfill from START_BLOCK** (deploy block or a few blocks before), not a market pause
- Amplify CA/chart links can lag. Indexing cannot
- Live GME payouts only after tickets are confirmed for those first-block buys

Production is `FIXTURE_MODE=false` (idle indexer, live on-chain `/pot`) and `DRY_RUN_PAYOUTS=true` until founder approval to send GME. Do not invent a CA. Do not point Lightsail at a random PONS token.

The pot is the on-chain GME balance of the jackpot wallet plus accruing unclaimed PONS creator share. Rings still skip below `MIN_POT_GME`. Gas to send GME is ETH on Robinhood Chain (~0.004 ETH in that wallet). Indexer reads chain logs over RPC. It does not depend on DexScreener or GeckoTerminal.

## Who does what

### Cursor-done (this repo)

- PONS CurveBuy / CurveSell decode + Uniswap v4 Swap after PoolCreated
- Backfill: cursor seeds `START_BLOCK - 1` so the deploy block is included even if the process starts minutes late
- Empty bag or pot below `MIN_POT_GME` skips the ring (no fake win pin). Dry-run pin says no GME sent
- Lightsail image on live `/pot`, `FIXTURE_MODE=false`, `DRY_RUN_PAYOUTS=true`
- This file is the launch checklist

### FOUNDER ONLY (do not paste secrets in chat)

- Create / fund jackpot wallet: **0 GME** + about **0.004 ETH** for gas
- Set `JACKPOT_PRIVATE_KEY`, Telegram token / chat id on Lightsail (console or local gitignored deploy file). Never commit
- BotFather `/setcommands` if the slash menu is stale after boot
- Choose salt, call `predictLaunchAddresses`, launch on PONS (ideally `launchAndBuy`)
- First-block sniper / team wallets
- Paste CA + curve + start block into Lightsail env (or confirm Cursor to set them after you have them). Do not paste the private key in chat

## Ordered steps

### 1. Backend ready (Cursor)

Latest Lightsail image. Indexer tests green. `FIXTURE_MODE=false`, `DRY_RUN_PAYOUTS=true`. `/health` ok. `/pot` is on-chain GME (not fixture tape). `/jackpot` is empty until CA + real tickets.

### 2. Founder: wallet + secrets on Lightsail

Jackpot wallet: 0 GME, ~0.004 ETH. Set signing key and Telegram on the container. Confirm a dry-run skip or dry-run pin later: never a fake paid hash. BotFather commands if needed: `/pot /jackpot /standings /odds /next /how /verify /fairness /random /draw`.

### 3. Pre-stage (recommended)

On PONS, pick salt and predict token + curve **before** the launch tx.

Set on Lightsail (still no pause after launch):

- `TOKEN_ADDRESS` = predicted token
- `CURVE_OR_POOL` = predicted curve
- `GME_TOKEN_ADDRESS` = GME on Robinhood Chain
- `RPC_URL` = RH Chain RPC
- `START_BLOCK` = current tip, or a few blocks before you expect to launch (not far in the future)
- `FIXTURE_MODE=false`
- Keep `DRY_RUN_PAYOUTS=true`
- Restart. Confirm `/health`. Logs: indexer watching the predicted curve. Factory `getLaunchedToken` may be empty until the launch tx. That is OK. CREATE2 curve logs still decode.

### 4. One motion: launch + first-block buys

Launch on PONS (prefer `launchAndBuy`). Team / sniper wallets buy in the first blocks. Do not wait for Amplify. Do not wait for a chat paste after the tx if you pre-staged.

### 5. Fallback if you did not pre-stage

Set `TOKEN_ADDRESS`, `CURVE_OR_POOL`, `START_BLOCK` = **launch block or earlier**, restart. Backfill catches first-block buys, including `launchAndBuy`. Minutes late is OK if `START_BLOCK` is not after those buys. Missed buys happen only if `START_BLOCK` is too late or decode is wrong, not because someone bought "before paste."

If tickets stay 0: rollback (below).

### 6. Confirm tickets ASAP

`GET /odds?address=<founder or sniper>` and Telegram `/odds 0x...`. Founder buys above `MIN_BUY_USD` ($5 default) mint tickets.

### 7. Amplify (can lag)

`NEXT_PUBLIC_TOKEN_ADDRESS`, `NEXT_PUBLIC_CHART_URL` (real links only). Site has no public dry-run banner.

### 8. Live GME payouts (FOUNDER APPROVAL ONLY, do not flip yet)

Keep `DRY_RUN_PAYOUTS=true` until the founder explicitly approves live sends.

Only after tickets are confirmed. After a clean dry ring **or** first live ring with a real pot:

1. Jackpot wallet holds enough **GME** for the announced display pot (fees swept in)
2. On Lightsail only: set `DRY_RUN_PAYOUTS=false`, rebuild/restart. Do not set this in chat.
3. Leave `JACKPOT_SHARE_BPS=5000`. Do not invent `TOKEN_ADDRESS` here if already set from launch.
4. Boot fails if key / GME token / RPC missing, or key ≠ `JACKPOT_WALLET`
5. Live path: one ERC-20 `transfer` of `displayPot` GME to the **drawn winner only** (`closing-bell-draw-v1` on the locked ticket list). Send-once per `windowId`; persist `tx_hash`. Skip if pot < `MIN_POT_GME`. No send to random addresses, no multi-pay of the pool, no send without a settled draw.
6. Win pin: full wallet, real `tx_hash`, View on explorer
7. Amplify CA/chart env only after the create tx (no public dry-run flag)

Rings with display pot below `MIN_POT_GME` (default 1) skip. No fake win pin.

## Rollback

Indexing wrong or empty bag after a real buy:

1. `FIXTURE_MODE=true`, restart (fixture tape returns)
2. Keep `DRY_RUN_PAYOUTS=true`
3. Fix `TOKEN_ADDRESS` / `CURVE_OR_POOL` / `START_BLOCK`
4. Flip fixture off again only when backfill mints the first-block wallets

## Lightsail env (launch)

| Var | Notes |
| --- | --- |
| `RPC_URL` | Alchemy RH Chain for pot / payout / draw seed. Alias `CHAIN_RPC_URL`. Indexer getLogs does **not** use this as primary |
| `RPC_FALLBACK_URL` | Default `https://rpc.mainnet.chain.robinhood.com`. **Indexer log primary.** Alchemy Free cannot serve wide `eth_getLogs` |
| `TOKEN_ADDRESS` | Predicted or live `$BELL` CA |
| `CURVE_OR_POOL` | Predicted or live curve |
| `START_BLOCK` | Deploy block or earlier. Cursor uses START_BLOCK-1. Live boot refuses a genesis scan if TOKEN is set and tip is multi-million |
| `FIXTURE_MODE` | `false` at pre-stage or immediately after launch |
| `GME_TOKEN_ADDRESS` | Quote asset. Required for UV4 after graduation |
| `PONS_FACTORY_ADDRESS` | Default PONS v2 factory |
| `PONS_HOOK_ADDRESS` | Default meme hook |
| `UNISWAP_V4_POOL_MANAGER` | Default v4 PoolManager |
| `JACKPOT_WALLET` | Public pot. Starts empty until GME is sent or claimed |
| `JACKPOT_WALLET_BALANCE_GME` | Local stub only. Unset in prod (live `balanceOf`) |
| `PONS_CLAIMABLE_GME` | Local stub only. Unset in prod (live PONS escrow/unswept) |
| `JACKPOT_PRIVATE_KEY` | FOUNDER ONLY. Never commit |
| `DRY_RUN_PAYOUTS` | `true` until tickets + pot proven |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | FOUNDER ONLY |
| `PUBLIC_SITE_URL` / `PUBLIC_API_URL` / `X_URL` | Bot links |
| `DATABASE_URL` | Lightsail Postgres |
| `CHAIN_ID` | `4663` |

## Amplify env

| Var | When |
| --- | --- |
| `NEXT_PUBLIC_API_BASE` | Already Lightsail |
| `NEXT_PUBLIC_TOKEN_ADDRESS` | Step 7, can lag |
| `NEXT_PUBLIC_CHART_URL` | Step 7, can lag |

## Backfill (first-block snipes)

PONS is one motion. The indexer may start seconds or minutes after the launch tx. That is OK.

1. Set `START_BLOCK` to the deploy block or a few blocks earlier.
2. Cursor seeds at `START_BLOCK - 1`, then `getLogs` from that block through the current tip.
3. `launchAndBuy` and other first-block buys are included if they are at or after `START_BLOCK`.
4. If the process first came up with a later `START_BLOCK`, lower it to the deploy block and restart. The cursor rewinds once so backfill still runs. Everyday restarts do not rescan the whole chain.

Missed buys happen only if `START_BLOCK` is after those txs, or decode is wrong. They do not happen because someone bought "before paste." There is no paste pause.

Prove it (no production CA):

```bash
cd backend
npm test -- tests/indexer-backfill.test.ts tests/pons-indexer.test.ts
```

Fixtures: `backend/fixtures/pons-curve-logs.json`, `backend/fixtures/uv4-swap-logs.json`. Optional read-only probe of some other public PONS GME pair is decode sanity only. Never set production `TOKEN_ADDRESS` to it.

## Still out of scope

- Fee-claim / tax sweep automation
- Founder key pasting in chat
- Invented chart URLs
- Draw-math changes
