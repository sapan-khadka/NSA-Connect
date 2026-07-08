# NSA Connect — Database Backups

Production-grade automated PostgreSQL backups for the NSA Connect Docker stack. Backups are compressed, verified, optionally encrypted for cloud upload, and retained on a daily/weekly schedule.

## Overview

| Component | Location |
|-----------|----------|
| Backup scripts | `backup/scripts/` |
| Docker image | `backup/Dockerfile` |
| Scheduler | `db-backup` service (supercronic, daily 03:00 UTC) |
| Local storage | `./backups/` (gitignored) |
| Configuration | `backup/.env` (copy from `backup/.env.example`) |

### What each backup does

1. `pg_dump` → gzip → `backups/daily/nsa_connect_YYYYMMDD_HHMMSS.sql.gz`
2. Verify gzip integrity and dump header
3. Restore into a throwaway DB (`nsa_connect_verify_*`), validate tables + Alembic revision, drop it
4. On Sundays (UTC), copy to `backups/weekly/nsa_connect_YYYY-Www.sql.gz`
5. Encrypt with OpenSSL AES-256-CBC → `backups/encrypted/*.sql.gz.enc`
6. Upload encrypted file to S3-compatible storage (never overwrites — unique keys)
7. Prune expired daily (30 days) and weekly (12 weeks) files
8. Log everything to `backups/backup.log`
9. On failure: Discord webhook and/or Resend email alert

## Quick start (Docker)

```bash
# 1. Configure secrets (never commit backup/.env)
cp backup/.env.example backup/.env
# Edit: BACKUP_ENCRYPTION_PASSPHRASE, S3/R2 credentials, alert webhooks

# 2. Start stack including backup scheduler
docker compose up -d postgres db-backup

# 3. Run a manual backup immediately
docker compose run --rm db-backup /backup/scripts/backup.sh

# 4. Tail logs
tail -f backups/backup.log
```

## Schedule

| Schedule | Cron (UTC) | Retention |
|----------|------------|-----------|
| Daily | `0 3 * * *` | 30 days (`backups/daily/`) |
| Weekly | Sunday daily backup also copied | 12 weeks (`backups/weekly/`) |

Change the schedule in `backup/crontab`.

## Storage locations

### Local (`./backups/`)

```
backups/
├── backup.log
├── daily/
│   └── nsa_connect_20250706_030000.sql.gz
├── weekly/
│   └── nsa_connect_2025-W27.sql.gz
└── encrypted/
    └── nsa_connect_20250706_030000.sql.gz.enc   # uploaded to cloud
```

Local daily/weekly files are **plain gzip SQL** for fast restore. Cloud copies are **encrypted** only.

### Cloud (S3-compatible)

Set in `backup/.env`:

| Provider | `BACKUP_S3_ENDPOINT_URL` | Notes |
|----------|--------------------------|-------|
| AWS S3 | *(leave empty)* | Standard `aws s3 cp` |
| Cloudflare R2 | `https://<account_id>.r2.cloudflarestorage.com` | S3 API |
| Google Cloud Storage | `https://storage.googleapis.com` | Enable S3 interop + HMAC keys |

Object key format: `{BACKUP_S3_PREFIX}/nsa_connect_YYYYMMDD_HHMMSS.sql.gz.enc`

## Restore (one command)

### From local backup

**Stop app services first** so nothing holds connections to `nsa_connect`:

```bash
docker compose stop backend celery-worker celery-beat db-backup
```

Rebuild only if you changed `backup/Dockerfile` or `backup/crontab` (scripts are mounted live):

```bash
docker compose build db-backup
```

```bash
docker compose run --rm -it db-backup \
  /backup/scripts/restore.sh /backups/daily/nsa_connect_YYYYMMDD_HHMMSS.sql.gz
```

Restart after restore:

```bash
docker compose up -d backend celery-worker celery-beat db-backup
```

You will be prompted to type the database name to confirm. Use `--yes` to skip (automation only).

### From cloud (encrypted)

```bash
docker compose run --rm -it db-backup \
  /backup/scripts/restore.sh --from-cloud nsa_connect_YYYYMMDD_HHMMSS.sql.gz.enc
```

### Restore into a different database (staging)

```bash
docker compose run --rm -it db-backup \
  /backup/scripts/restore.sh --target-db nsa_connect_staging /backups/daily/nsa_connect_YYYYMMDD_HHMMSS.sql.gz
```

The restore script drops and recreates the target database, restores the dump, and validates table count + `alembic_version`.

## Disaster recovery test

Run monthly in staging or after backup config changes:

```bash
docker compose run --rm db-backup /backup/scripts/disaster-recovery-test.sh
```

This will:

1. Create a full backup (cloud upload disabled for the test run)
2. Restore into `nsa_connect_dr_test`
3. Compare table counts with production DB
4. Drop the test database

## Host / VPS cron (without Docker scheduler)

If you prefer host cron instead of the `db-backup` container:

```cron
0 3 * * * cd /path/to/NSA-Connect && docker compose run --rm db-backup /backup/scripts/backup.sh >> /var/log/nsa-connect-backup.log 2>&1
```

## Environment variables

Copy `backup/.env.example` → `backup/.env`. Required for production:

| Variable | Purpose |
|----------|---------|
| `BACKUP_ENCRYPTION_PASSPHRASE` | Encrypt cloud uploads (`openssl rand -base64 32`) |
| `BACKUP_S3_BUCKET` | Cloud bucket name |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Cloud credentials |
| `BACKUP_DISCORD_WEBHOOK_URL` | Failure alerts (optional) |
| `BACKUP_RESEND_API_KEY` + `BACKUP_ALERT_EMAIL_TO` | Email failure alerts (optional) |

Set `BACKUP_S3_ENABLED=false` for local-only backups (development).

## Security

- Backup files and `backup/.env` are **gitignored**
- Cloud uploads are **encrypted** before leaving the server
- Store encryption passphrase and cloud keys in env vars or a secrets manager (Railway, Doppler, etc.)
- Restrict `./backups` filesystem permissions on production hosts
- Rotate `BACKUP_ENCRYPTION_PASSPHRASE` only with a re-encryption plan

## Recovery playbook

### Lost laptop / new server

1. Clone the repo and restore `backup/.env` from your secrets store
2. `docker compose up -d postgres`
3. Download latest encrypted backup from cloud (or copy from old `./backups`)
4. Run restore (see above)
5. `docker compose up -d` for backend, Redis, Celery
6. `docker compose exec backend alembic upgrade head` *(only if backup predates latest migration)*
7. Verify `/api/v1/health` and spot-check critical data

### Corrupted database

1. Stop writes: `docker compose stop backend celery-worker celery-beat`
2. Restore from most recent **verified** backup (check `backup.log`)
3. Restart services

### Backup failure

1. Check `backups/backup.log` for the error
2. Confirm Postgres is healthy: `docker compose ps postgres`
3. Test manual run: `docker compose run --rm db-backup /backup/scripts/backup.sh`
4. Fix credentials / disk space / network, then re-run

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `BACKUP_ENCRYPTION_PASSPHRASE is required` | Set passphrase in `backup/.env` when `BACKUP_S3_ENABLED=true` |
| `Could not parse DATABASE_URL` | Use `postgresql://user:pass@host:port/dbname` format |
| Cloud upload 403 | Check bucket policy, R2/GCS S3 interop keys, `BACKUP_S3_ENDPOINT_URL` |
| Verify restore slow | Set `BACKUP_VERIFY_RESTORE=false` only if you accept reduced safety |
| Host backup to Docker Postgres | Set `POSTGRES_HOST=localhost` and `POSTGRES_PORT=5433` in `backup/.env` |

## Files reference

| Script | Purpose |
|--------|---------|
| `backup.sh` | Full backup pipeline |
| `restore.sh` | Restore from local or cloud |
| `disaster-recovery-test.sh` | End-to-end DR drill |
| `lib/verify.sh` | Integrity + test-restore validation |
| `lib/retention.sh` | Daily/weekly pruning |
| `lib/encrypt.sh` | OpenSSL encrypt/decrypt |
| `lib/upload.sh` | S3-compatible upload/download |
