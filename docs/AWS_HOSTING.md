# Host Closing Bell on AWS Amplify

Site: **closingbellonrh.com**  
API (already live, leave it alone): `https://closing-bell-api.qdwgj1kmyrm0a.us-west-2.cs.amazonlightsail.com`

This guide is the frontend only. Do not change the Lightsail API container, Telegram secrets, or `docs/AWS_LIGHTSAIL.md`.

## Why Amplify (not a second Lightsail)

**Pick Amplify Hosting.**

| | Amplify Hosting | Lightsail (static or another container) |
| --- | --- | --- |
| This Next.js 16 App Router app | SSR + `next start` via Amplify compute, GitHub auto-build, ACM cert, custom domain UI | Static hosting cannot run this app (needs Node, `/cb-api` proxy, no `output: 'export'`). A second container would work but you operate image push, TLS, and deploys yourself. |
| Domain | Console attaches `closingbellonrh.com` + www, issues the cert, tells you the DNS records | You glue Lightsail cert validation + CNAMEs by hand |
| Fit with current AWS | Site on Amplify, API stays on the existing Lightsail service | Two Lightsail services to reason about |

Lightsail stays the API host. Amplify is the AWS equivalent of a Git-connected Next host. Classic Amplify docs list Next.js through 15; this repo is 16.3.5. Amplify still detects `next` and runs `amplify.yml`. If a build rejects Next 16, the fallback is a Node 22 container with `npm run start` (same image style as the API), not Lightsail static files.

## 1. Buy closingbellonrh.com

Buy it wherever you prefer (Route 53, Namecheap, Google Domains, etc.). You do **not** have to transfer it to Route 53.

After checkout, open the registrar DNS panel. You will add records in step 5. Do not point the domain at Vercel.

## 2. IAM (required before the CLI can create the app)

The current CLI user `closing-bell-deploy` can manage Lightsail. It **cannot** call Amplify (`amplify:ListApps` is AccessDenied).

Signed in as root (or an admin):

1. Open [IAM Users](https://console.aws.amazon.com/iam/home#/users)
2. User `closing-bell-deploy` → **Add permissions** → **Attach policies directly**
3. Attach **`AdministratorAccess-Amplify`**
4. Save

Keep the existing Lightsail / ECR policies. Do not remove them.

Pass check (PowerShell, region `us-west-2`):

```powershell
aws amplify list-apps --region us-west-2
```

Expect `{}` or an apps list, not `AccessDenied`.

## 3. Create the Amplify app from GitHub (next click)

Repo already on GitHub: [TheBlockchainGods/Closing_Bell](https://github.com/TheBlockchainGods/Closing_Bell).

**Console (recommended):**

1. Open [Amplify Hosting](https://us-west-2.console.aws.amazon.com/amplify/apps) in **Oregon (us-west-2)**
2. **Create new app** → **Host web app** → **GitHub** → authorize `TheBlockchainGods`
3. Repository: `Closing_Bell`
4. Branch: merge this hosting work to `main`, then select `main`. For a first preview you can select the current working branch instead.
5. App name: `closing-bell-site`
6. Framework: Amplify should detect Next.js. Leave the build spec as the repo `amplify.yml` (Node 22, `npm ci`, `npm run build`).
7. **Environment variables** (before the first build):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE` | `https://closing-bell-api.qdwgj1kmyrm0a.us-west-2.cs.amazonlightsail.com` |
| `NEXT_PUBLIC_TOKEN_ADDRESS` | `0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7` |
| `NEXT_PUBLIC_CHART_URL` | `https://www.defined.fi/token/robinhood/0x72C185D3BdDFDCEa818079482350C36bF48Fb1C7` |
| `NODE_VERSION` | `22` |

8. Save and deploy.

When the job is green you get an Amplify preview URL like `https://main.xxxxx.amplifyapp.com`. That is the site until DNS is attached.

**CLI (after step 2 IAM):** GitHub source still needs a console OAuth click the first time. After the app exists:

```powershell
aws amplify list-apps --region us-west-2
aws amplify list-jobs --app-id <APP_ID> --branch-name main --region us-west-2
```

## 4. Confirm the site talks to the fixture API

On the Amplify URL (and on `http://localhost:3000` with `.env.local`):

- Trust strip / Bell Pot should show the API pot (fixture `displayPot` is about **1,303.90 GME**, not the mock 1,381 figure).
- Tickets out should match `GET /window/current` (fixture was **1,360,665** when this was wired).
- Odds lookup against a ladder wallet (for example `0x4b19Ce77a0E2d61f5c8B3aD9017f4E62c0aB8137`) should return **10% / at cap**.
- `/verify` loads the latest ring when winners exist, otherwise the sample receipt.

Browser calls `/cb-api/pot`, `/cb-api/ladder`, `/cb-api/odds`, `/cb-api/winners`. The Next server proxies those to Lightsail. Do not call the Lightsail host from the browser; it has no CORS.

## 5. DNS checklist: closingbellonrh.com → Amplify

Do this after the Amplify app has at least one successful deploy.

1. Amplify app → **Hosting** → **Custom domains** → **Add domain**
2. Enter `closingbellonrh.com`. Include `www.closingbellonrh.com`.
3. Amplify creates an ACM certificate and shows **exact records**. Copy them. Typical set:

| Host | Type | Value | Why |
| --- | --- | --- | --- |
| `_xxx.closingbellonrh.com` (Amplify/ACM name) | CNAME | Amplify/ACM target | Certificate validation. Wait until the cert is Issued. |
| `www` | CNAME | the Amplify branch domain (`main.xxxxx.amplifyapp.com` or the CloudFront domain Amplify prints) | www |
| apex `@` / `closingbellonrh.com` | ALIAS / ANAME, or the A / AAAA records Amplify prints | Amplify / CloudFront | Root domain. Registrars without ALIAS: use Amplify’s A/AAAA pair, not a CNAME on `@`. |

4. At your registrar, add those records. TTL 300 is fine.
5. Wait for Amplify domain status **Available**. Then `https://closingbellonrh.com` should serve the site with a valid cert.

Do **not** point the domain at the Lightsail API URL. That host is the API only.

If you later move DNS to Route 53, create a hosted zone for `closingbellonrh.com`, copy the NS records to the registrar, then paste the same Amplify records into Route 53.

## Local

```powershell
cd "c:\Users\ameth\ai projects\Closing_Bell"
copy .env.example .env.local   # already points at the live Lightsail API
npm run dev
```

Open http://localhost:3000. To hit a local API instead, set `NEXT_PUBLIC_API_BASE=http://localhost:8787` and restart Next.

## What this repo already contains

- `.env.example` / local `.env.local`: `NEXT_PUBLIC_API_BASE` = live Lightsail API
- `amplify.yml`: Node 22, `npm ci`, `npm run build`
- `.nvmrc`: `22`
- `app/cb-api/[...path]/route.ts`: same-origin proxy
- `lib/bell-store.tsx`: pot / ladder / odds / winners from that API after mount
