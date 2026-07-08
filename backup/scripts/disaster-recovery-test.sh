#!/usr/bin/env bash
# Full disaster-recovery drill: backup → drop test DB → restore → validate → cleanup.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/verify.sh
source "${SCRIPT_DIR}/lib/verify.sh"

main() {
  load_env
  export_pg_env

  local dr_db="${DR_TEST_DB:-nsa_connect_dr_test}"
  local stamp
  stamp="$(timestamp_utc)"

  log_info "=== Disaster recovery test started (target DB: ${dr_db}) ==="

  BACKUP_S3_ENABLED=false "${SCRIPT_DIR}/backup.sh"

  local latest_backup
  latest_backup="$(ls -1t "${BACKUP_DIR}/daily"/nsa_connect_*.sql.gz | head -n 1)"
  [[ -n "${latest_backup}" ]] || die "No backup file found after backup.sh"

  log_info "Using backup artifact: ${latest_backup}"

  drop_database_if_exists "${dr_db}"
  restore_backup_to_database "${latest_backup}" "${dr_db}"
  validate_restored_database "${dr_db}"

  local source_tables target_tables
  source_tables="$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
  target_tables="$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${dr_db}" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"

  if [[ "${source_tables}" != "${target_tables}" ]]; then
    die "Table count mismatch: source=${source_tables}, restored=${target_tables}"
  fi

  drop_database_if_exists "${dr_db}"
  log_info "=== Disaster recovery test PASSED (${source_tables} tables verified) ==="
}

main "$@"
