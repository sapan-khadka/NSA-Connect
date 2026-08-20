# Production deploy checklist (NSA chapter pilot)

Use this before pointing the board at a live URL. Pair with [BACKUPS.md](BACKUPS.md) and [BOARD_RUNBOOK.md](BOARD_RUNBOOK.md).

## Required environment

Set on the API (and Celery worker/beat) service:

| Variable | Production value |
|----------|------------------|
| `ENVIRONMENT` | `production` |
| `DEBUG` | `false` |
| `SECRET_KEY` | strong random (≥32 chars); never the `.env.example` default |
| `DATABASE_URL` | managed Postgres |
| `REDIS_URL` | managed Redis |
| `FRONTEND_URL` | `https://…` public app origin (email + check-in QR links + CORS) |
| `ORG_OWNER_EMAILS` | allowlisted chapter-owner Gmail (comma-separated) |
| `EMAIL_ENABLED` | `true` |
| `RESEND_API_KEY` | required — all outbound email |
| `SKIP_EMAIL_VERIFICATION` | `false` |
| `EMAIL_TEST_OVERRIDE_RECIPIENT` | **empty** |
| `CLOUDINARY_*` | real cloud name + keys (no `dev_uploads` in prod) |
| `RATE_LIMIT_TRUST_PROXY_HEADERS` | `true` behind Railway/CDN reverse proxy |

The API **refuses to boot** in production when fatal checks fail (`backend/app/core/production_checks.py`).

OpenAPI / `/docs` / `/redoc` are disabled when `ENVIRONMENT=production`. CORS allows `FRONTEND_URL` only. The API adds `X-Content-Type-Options`, `X-Frame-Options: DENY`, and a restrictive `Content-Security-Policy` on JSON responses. The nginx frontend image applies a document CSP (scripts `'self'`, Cloudinary/Giphy/Tenor images, Google Fonts, same-origin WebSockets).

## Frontend image

`frontend/Dockerfile` builds the Vite app and serves it with nginx.

| Setting | Production value |
|---------|------------------|
| Build arg `VITE_API_URL` | `/api` (same origin; nginx proxies to the API) |
| Runtime `API_UPSTREAM` | API origin nginx should proxy, e.g. `http://backend:8000` or the Railway private URL |
| Public app URL | Set API `FRONTEND_URL` to this origin (email links + CORS) |

The image proxies `/api/`, `/ws/`, and `/health` to `API_UPSTREAM` so REST and WebSockets stay on one origin. Do not point `VITE_API_URL` at a different host unless `/ws` is also served there.

Container liveness: `GET /nginx-health`. Local smoke: `docker compose --profile frontend up -d --build`.

## Deploy steps

1. Copy `backend/.env.example` → host secrets; fill production values above.
2. Deploy API + Celery worker/beat + Postgres + Redis + frontend (`frontend/Dockerfile`). The API image must not run uvicorn `--reload`.
3. Run migrations: `alembic upgrade head` against the production database.
4. Confirm `GET /health` returns `{"status":"ok"}` and `GET /health/ready` returns 200.
5. Register the allowlisted owner (or `python -m scripts.seed_chapter_owner`), then 1–2 SEMO board accounts. Do **not** run wipe/demo seed scripts against production — they refuse to start.
6. Send a test password-reset, a verification email, and a welcome email to a real inbox.
7. Upload one receipt / avatar / event photo and confirm Cloudinary URLs (not localhost).
8. Run one backup and one restore drill per [BACKUPS.md](BACKUPS.md).

## Explicitly removed for production

- `/health/frontend-url-debug` (board-only FRONTEND_URL dump) — removed from the API.
- Fake guest “Continue with Google” and dead Explore/About links.
- Boot-time org-owner promotion (`ensure_nsa_org_owner` is script/test only).

## Monitoring (minimum)

- Uptime check on `/health`; optionally `/health/ready` for Postgres + Redis.
- Retain API + Celery logs; alert on worker crash / email send failures when available.
- Keep Discord/email backup failure alerts enabled if using the Docker backup service.
