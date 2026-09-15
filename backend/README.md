# Closing Bell — backend

Phase 1–2: indexer, ticket engine, read API, Telegram bot, draw keeper.

Marketing site in the repo root is separate and frozen.

## Quick start

```bash
cd backend
cp .env.example .env
docker compose up --build
```

- API: http://localhost:8787/health
- Without `TELEGRAM_BOT_TOKEN`, announces log as `[tg:dry]`

```bash
npm install
npm test
npm run demo:dry-ring   # needs Postgres up
```

## Workers

One process runs:

1. **API** — Fastify read routes
2. **Indexer** — fixture or chain adapters; buy announces on new qualifying trades
3. **Telegram bot** — announces + `/pot` `/odds` `/ladder` `/next`
4. **Draw keeper** — snapshot → dry-run/live payout → wipe

## Fixture vs launch

| Mode | Env |
| --- | --- |
| Local / pre-token | `FIXTURE_MODE=true`, `DRY_RUN_PAYOUTS=true` |
| Launch indexing | `FIXTURE_MODE=false` + `TOKEN_ADDRESS` + `RPC_URL` + `CURVE_OR_POOL` |
| Live GME payouts | `DRY_RUN_PAYOUTS=false` + `GME_TOKEN_ADDRESS` + `JACKPOT_PRIVATE_KEY` |

See [docs/BACKEND.md](../docs/BACKEND.md) for formulas, trust model, and safe payout flip.
See [docs/AWS_LIGHTSAIL.md](../docs/AWS_LIGHTSAIL.md) for IAM + Lightsail deploy (us-west-2, ~$1100 credits).

## Deploy on Railway

This machine has the Railway CLI available. Deploy is **not** completed until a project is linked and `/health` returns OK.

### CLI (preferred)

```bash
cd backend
railway login          # if needed
railway init           # create / link project
railway add            # provision Postgres
railway variables set FIXTURE_MODE=true DRY_RUN_PAYOUTS=true PORT=8787
# Also set DATABASE_URL from the Postgres plugin, TELEGRAM_*, knobs…
railway up
railway domain
curl https://<your-domain>/health
```

### Dashboard click-path (if CLI link fails)

1. Open [https://railway.app/new](https://railway.app/new)
2. **Deploy from GitHub** (push this repo) or **Empty project** + empty service
3. Add **Postgres** plugin; copy `DATABASE_URL` into the API service variables
4. Set root directory to `backend` (or connect the `backend/` Dockerfile)
5. Variables: copy from `.env.example` (`FIXTURE_MODE`, `DRY_RUN_PAYOUTS`, Telegram, knobs)
6. Health check path: `/health`
7. Generate a domain → confirm `GET /health` returns `"ok": true`

### Blockers on this workstation (last check)

- Docker Desktop: **not installed** (local `docker compose` blocked)
- Railway: CLI logged in as `TBG_JUST_G`, but **trial expired** — `railway init` refused new projects until a plan is selected at [railway.app/account](https://railway.app/account)
- After plan is active: `cd backend && railway init --name closing-bell-api && railway add && railway up`

## Secrets hygiene

- Never commit `.env` or `JACKPOT_PRIVATE_KEY`
- Never put marketing/ops/dev fee wallets in API responses or Telegram text
- Public jackpot wallet is OK to show
