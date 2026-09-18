# AWS Lightsail deploy — Closing Bell backend

Region default: **us-west-2** (Oregon). Change only if your startup-credit email names another region.

Estimated cost (credit-eligible): Lightsail Container Service **Nano** (~$7/mo) + managed Postgres **$15/mo** (or a small Lightsail DB), well under $1100 credits.

Keep `DRY_RUN_PAYOUTS=true`. Lightsail public is `FIXTURE_MODE=false` (idle indexer until CA, live on-chain `/pot`). Ticket math is proven with fixtures locally. Do not point this service at a random PONS CA. Launch flow (CREATE2 pre-stage + one-motion PONS launch): [GO_LIVE.md](./GO_LIVE.md).

## A) Create a deploy IAM user (not root, not Bedrock)

Do this once in the AWS Console while signed in as root.

1. Open [https://console.aws.amazon.com/iam/home](https://console.aws.amazon.com/iam/home)
2. Left nav: **Users** → **Create user**
3. User name: `closing-bell-deploy`
4. Check **Provide user access to the AWS Management Console**? → **No** (CLI only is fine)
5. **Next** → **Attach policies directly** → attach:
   - `AmazonLightsailFullAccess` (simple for novices; tighten later)
   - `AmazonEC2ContainerRegistryPowerUser` (needed to push images to ECR for Lightsail containers)
6. **Create user**
7. Open the user → **Security credentials** → **Create access key** → **Command Line Interface (CLI)** → create
8. Copy **Access key ID** and **Secret access key** into a password manager. You will not see the secret again.
9. Do **not** put these keys in git or chat.

### Configure CLI (on this PC)

In PowerShell:

```powershell
aws configure
```

Paste when prompted:

- AWS Access Key ID: *(from step 8)*
- AWS Secret Access Key: *(from step 8)*
- Default region name: `us-west-2`
- Default output format: `json`

Pass check:

```powershell
aws sts get-caller-identity
```

You should see your Account and Arn containing `closing-bell-deploy`. If you get `Unable to locate credentials`, re-run `aws configure`.

## B) Local compose (already scripted in repo)

```powershell
cd "c:\Users\ameth\ai projects\Closing_Bell\backend"
docker compose up --build -d
curl http://localhost:8787/health
```

Expect `"ok": true`, `"fixtureMode": false`, `"dryRunPayouts": true`.

Telegram without token: announces log as `[tg:dry]` in container logs.

```powershell
docker compose logs -f api
```

## C) Lightsail Container Service (preferred)

### 1. Create a Lightsail Postgres database

Console: [Lightsail](https://lightsail.aws.amazon.com/ls/webapp/home/databases) → **Create database**

- Region: **Oregon (us-west-2)**
- Database engine: **PostgreSQL 16** (or latest 15+)
- Plan: cheapest dual-AZ or single-AZ starter
- Name: `closing-bell-db`
- Master user / password: save securely

After create: note **endpoint**, **port**, **user**, **password**.  
`DATABASE_URL` shape:

```text
postgres://USER:PASSWORD@ENDPOINT:5432/closing_bell
```

You may need to create database `closing_bell` once via Lightsail browser/Query editor or `psql`.

### 2. Build and push the API image (ECR + Lightsail)

Lightsail Container Service can pull from Lightsail’s own registry **or** ECR. Simplest for this repo: push to **Lightsail container images** via CLI after service exists, or use ECR.

#### Option (recommended): Lightsail container service + push

```powershell
cd "c:\Users\ameth\ai projects\Closing_Bell\backend"

# Create container service (Nano, 1 node) — region us-west-2
aws lightsail create-container-service `
  --service-name closing-bell-api `
  --power nano `
  --scale 1 `
  --region us-west-2

# Wait until READY
aws lightsail get-container-services --service-name closing-bell-api --region us-west-2
```

Build local image and push:

```powershell
docker build -t closing-bell-api:latest .

aws lightsail push-container-image `
  --service-name closing-bell-api `
  --label api `
  --image closing-bell-api:latest `
  --region us-west-2
```

Note the returned image name (looks like `:closing-bell-api.api.N`).

### 3. Deploy container with env (no secrets in git)

Create `lightsail-deployment.json` locally (do not commit real passwords). Template:

```json
{
  "closing-bell-api": {
    "image": ":closing-bell-api.api.1",
    "ports": { "8787": "HTTP" },
    "environment": {
      "PORT": "8787",
      "FIXTURE_MODE": "false",
      "DRY_RUN_PAYOUTS": "true",
      "DATABASE_URL": "postgres://USER:PASSWORD@ENDPOINT:5432/closing_bell",
      "CHAIN_ID": "4663",
      "ODDS_CAP_BPS": "1000",
      "JACKPOT_SHARE_BPS": "5000",
      "MIN_BUY_USD": "5",
      "TICKETS_PER_USD": "1000",
      "MIN_POT_GME": "1",
      "BELLS_24_7": "true",
      "SNAPSHOT_LEAD_SECONDS": "120",
      "GME_USD_PRICE": "23.18",
      "JACKPOT_WALLET": "0x1111111111111111111111111111111111111111",
      "START_BLOCK": "0",
      "INDEXER_POLL_MS": "2000",
      "KEEPER_POLL_MS": "1000"
    }
  }
}
```

Public endpoint mapping:

```powershell
aws lightsail create-container-service-deployment `
  --service-name closing-bell-api `
  --containers file://lightsail-deployment.json `
  --public-endpoint file://lightsail-endpoint.json `
  --region us-west-2
```

`lightsail-endpoint.json`:

```json
{
  "containerName": "closing-bell-api",
  "containerPort": 8787,
  "healthCheck": {
    "path": "/health",
    "intervalSeconds": 30,
    "timeoutSeconds": 5,
    "healthyThreshold": 2,
    "unhealthyThreshold": 2,
    "successCodes": "200-299"
  }
}
```

### 4. Get the public URL

```powershell
aws lightsail get-container-services --service-name closing-bell-api --region us-west-2
```

Open `https://<url>/health` — expect `"ok": true`.

Optional Telegram later (Lightsail env only):

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

## D) What is live vs blocked

| Item | Status |
| --- | --- |
| Docker Desktop | Required locally (you have it) |
| AWS CLI | Installed on this PC |
| IAM access keys | **You must create** (section A) then `aws configure` |
| Local compose `/health` | Run section B |
| Lightsail service | After `aws sts get-caller-identity` works |
| Telegram announces to chat | Blocked until bot token + chat id |
| Real chain indexing / GME payouts | Follow [GO_LIVE.md](./GO_LIVE.md). One-motion PONS launch; RPC logs indexer. |

## E) Stop conditions

If `aws sts get-caller-identity` fails → stop and finish section A.  
If Lightsail create fails with billing/credits → open AWS Billing / Activate Lightsail in us-west-2, then resume from section C.
