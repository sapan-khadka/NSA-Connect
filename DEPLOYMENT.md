# Deployment: staging vs production

This is the branch + environment model for NSA Connect.

## Mental model

| Layer | Production | Staging (test) |
|-------|------------|----------------|
| **Git branch** | `main` | `staging` |
| **Railway environment** | `production` | `staging` |
| **Who uses it** | Chapter members / board | You + trusted testers only |
| **API `ENVIRONMENT`** | `production` | `staging` |
| **Database** | Real data | Separate DB (never share prod DB) |

Feature work never goes straight onto `main`. Flow:

```text
feature/my-change  →  PR into staging  →  test on staging URL
                   →  PR staging → main  →  production deploy
```

Short feature branches (what you already use, e.g. `harden-production-pass`) are fine. Prefer merging them into **`staging` first**, then promoting `staging` → `main`.

## One-time Railway setup

Run these in your own terminal (Railway login cannot run from the agent shell).

```bash
cd /Users/sapan/Desktop/NSA-Connect
railway login
railway link          # pick the NSA Connect project
railway environment list
```

Create staging by cloning production config (services + variable *names*; you will still change secrets/URLs):

```bash
railway environment new staging --duplicate production
railway environment link staging
```

In the Railway dashboard for **staging**:

1. Confirm Postgres and Redis are **separate** from production (duplicating an environment usually provisions isolated data — verify before writing anything).
2. Set API (and Celery) variables:

| Variable | Staging value |
|----------|----------------|
| `ENVIRONMENT` | `staging` |
| `DEBUG` | `false` |
| `SECRET_KEY` | different from production |
| `FRONTEND_URL` | `https://…` staging frontend domain |
| `EMAIL_ENABLED` | `true` (or `false` while wiring) |
| `EMAIL_TEST_OVERRIDE_RECIPIENT` | **your email** so real members are not emailed |
| `SKIP_EMAIL_VERIFICATION` | `false` (or `true` only while bootstrapping) |
| `ORG_OWNER_EMAILS` | your allowlisted owner email |
| `RATE_LIMIT_TRUST_PROXY_HEADERS` | `true` |

3. Generate public domains for staging frontend + API (or one frontend that proxies `/api`).
4. Under each service → **Settings → Source**:  
   - **production** services → branch `main`  
   - **staging** services → branch `staging`

## One-time Git branches

```bash
git fetch origin
git checkout main
git pull
git checkout -b staging
git push -u origin staging
```

After that, day-to-day:

```bash
git checkout staging
git pull
git checkout -b feat/short-name
# … commit work …
git push -u origin HEAD
gh pr create --base staging --title "…" --body "…"
# after review + CI green: merge into staging → Railway deploys staging
# after smoke test: open PR staging → main → merge → production deploys
```

## Smoke test on staging (before promoting)

1. Open the staging frontend URL.
2. `GET /health` and `GET /health/ready` on the staging API.
3. Log in, create one event / send one email (should hit `EMAIL_TEST_OVERRIDE_RECIPIENT`).
4. Run migrations against **staging** DB only: `alembic upgrade head`.

Then merge `staging` → `main`.

## Production checklist

Still use [PRODUCTION.md](PRODUCTION.md) before pointing the board at the live URL. Production must keep `EMAIL_TEST_OVERRIDE_RECIPIENT` **empty**.

## Optional later

- GitHub **ruleset** on `main`: require PR + `CI — all checks passed`.
- Railway **PR environments** for ephemeral previews (extra cost; optional).
