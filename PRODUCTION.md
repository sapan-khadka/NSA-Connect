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
| `FRONTEND_URL` | `https://…` public app origin (email + check-in QR links) |
| `ORG_OWNER_EMAILS` | allowlisted chapter-owner Gmail (comma-separated) |
| `EMAIL_ENABLED` | `true` |
| `SENDGRID_API_KEY` and/or `RESEND_API_KEY` | real provider keys |
| `EMAIL_TEST_OVERRIDE_RECIPIENT` | **empty** |
| `CLOUDINARY_*` | real cloud name + keys (no `dev_uploads` in prod) |
| `RATE_LIMIT_TRUST_PROXY_HEADERS` | `true` behind Railway/CDN reverse proxy |

Startup logs warn when these look wrong (`backend/app/core/production_checks.py`).

## Deploy steps

1. Copy `backend/.env.example` → host secrets; fill production values above.
2. Deploy API + Celery worker + Celery beat + Postgres + Redis + static frontend.
3. Run migrations: `alembic upgrade head` against the production database.
4. Confirm `GET /health` returns `{"status":"ok"}`.
5. Register the allowlisted owner (or `python -m scripts.seed_chapter_owner`), then 1–2 SEMO board accounts.
6. Send a test password-reset, a verification email, and a welcome email to a real inbox.
7. Upload one receipt / avatar / event photo and confirm Cloudinary URLs (not localhost).
8. Run one backup and one restore drill per [BACKUPS.md](BACKUPS.md).

## Explicitly removed for production

- `/health/frontend-url-debug` (board-only FRONTEND_URL dump) — removed from the API.
- Fake guest “Continue with Google” and dead Explore/About links.

## Monitoring (minimum)

- Uptime check on `/health` (host or external ping).
- Retain API + Celery logs; alert on worker crash / email send failures when available.
- Keep Discord/email backup failure alerts enabled if using the Docker backup service.
