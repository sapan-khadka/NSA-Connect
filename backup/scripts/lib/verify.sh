#!/usr/bin/env bash

set -euo pipefail

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${LIB_DIR}/common.sh"

verify_backup_integrity() {
  local backup_path="$1"

  [[ -f "${backup_path}" ]] || die "Backup file not found: ${backup_path}"
  [[ -s "${backup_path}" ]] || die "Backup file is empty: ${backup_path}"

  log_info "Verifying gzip integrity for ${backup_path}"
  gzip -t "${backup_path}"

  log_info "Verifying SQL structure"
  local header
  header="$(gunzip -c "${backup_path}" | head -c 512 || true)"
  if [[ "${header}" != *"PostgreSQL database dump"* ]]; then
    die "Backup does not look like a PostgreSQL plain dump: ${backup_path}"
  fi

  local size
  size="$(file_size_bytes "${backup_path}")"
  log_info "Backup size: $(human_size "${size}") (${size} bytes)"
}

disconnect_database_sessions() {
  local target_db="$1"
  export_pg_env
  log_info "Terminating active connections to database ${target_db}"
  psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 --quiet <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${target_db}'
  AND pid <> pg_backend_pid();
SQL
}

restore_backup_to_database() {
  local backup_path="$1"
  local target_db="$2"

  export_pg_env
  require_command psql
  require_command createdb
  require_command dropdb

  log_info "Restoring ${backup_path} into database ${target_db}"

  if psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres \
    -tAc "SELECT 1 FROM pg_database WHERE datname='${target_db}'" | grep -q 1; then
    disconnect_database_sessions "${target_db}"
    # --force (PG 13+): terminate backends then drop
    dropdb --force -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${target_db}"
  fi

  createdb -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" --template=template0 "${target_db}"
  gunzip -c "${backup_path}" | psql \
    -h "${POSTGRES_HOST}" \
    -p "${POSTGRES_PORT}" \
    -U "${POSTGRES_USER}" \
    -d "${target_db}" \
    --set ON_ERROR_STOP=on \
    --quiet \
    > /dev/null
}

validate_restored_database() {
  local target_db="$1"

  export_pg_env
  local table_count
  table_count="$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${target_db}" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"

  [[ "${table_count}" -gt 0 ]] || die "Restored database ${target_db} has no public tables"

  local has_alembic
  has_alembic="$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${target_db}" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='alembic_version'")"

  if [[ "${has_alembic}" -eq 1 ]]; then
    local revision
    revision="$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${target_db}" -tAc \
      "SELECT version_num FROM alembic_version LIMIT 1")"
    log_info "Restored DB ${target_db}: ${table_count} tables, alembic revision ${revision}"
  else
    log_warn "Restored DB ${target_db}: ${table_count} tables (no alembic_version table)"
  fi
}

verify_backup_with_restore() {
  local backup_path="$1"
  local verify_db="${BACKUP_VERIFY_DB_PREFIX}_$(timestamp_utc)"

  if [[ "${BACKUP_VERIFY_RESTORE}" != "true" ]]; then
    log_info "Restore verification disabled; skipping"
    return 0
  fi

  restore_backup_to_database "${backup_path}" "${verify_db}"
  validate_restored_database "${verify_db}"

  export_pg_env
  dropdb -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${verify_db}" \
    || log_warn "Could not drop verification database ${verify_db}"
  log_info "Restore verification passed for ${backup_path}"
}

drop_database_if_exists() {
  local target_db="$1"
  export_pg_env
  if psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres \
    -tAc "SELECT 1 FROM pg_database WHERE datname='${target_db}'" | grep -q 1; then
    dropdb -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${target_db}"
  fi
}
