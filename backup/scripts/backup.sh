#!/usr/bin/env bash
# Create a timestamped PostgreSQL backup, verify it, encrypt for cloud, upload, and prune.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/dump.sh
source "${SCRIPT_DIR}/lib/dump.sh"
# shellcheck source=lib/encrypt.sh
source "${SCRIPT_DIR}/lib/encrypt.sh"
# shellcheck source=lib/upload.sh
source "${SCRIPT_DIR}/lib/upload.sh"
# shellcheck source=lib/verify.sh
source "${SCRIPT_DIR}/lib/verify.sh"
# shellcheck source=lib/retention.sh
source "${SCRIPT_DIR}/lib/retention.sh"
# shellcheck source=lib/notify.sh
source "${SCRIPT_DIR}/lib/notify.sh"

on_failure() {
  local exit_code=$?
  local message="Backup failed with exit code ${exit_code}"
  log_error "${message}"
  send_failure_notification "NSA Connect backup FAILED" "${message}
Host: $(hostname)
Database: ${POSTGRES_DB:-unknown}
Time (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  exit "${exit_code}"
}

main() {
  load_env
  export_pg_env
  trap on_failure ERR

  local stamp
  stamp="$(timestamp_utc)"
  local backup_name="nsa_connect_${stamp}.sql.gz"
  local daily_path="${BACKUP_DIR}/daily/${backup_name}"
  local encrypted_path="${BACKUP_DIR}/encrypted/${backup_name}.enc"

  log_info "=== Backup started (${backup_name}) ==="

  create_backup_dump "${daily_path}"
  verify_backup_integrity "${daily_path}"
  verify_backup_with_restore "${daily_path}"
  maybe_promote_weekly_backup "${daily_path}"

  if [[ "${BACKUP_S3_ENABLED}" == "true" ]]; then
    encrypt_backup_file "${daily_path}" "${encrypted_path}"
    upload_to_cloud "${encrypted_path}"
  fi

  prune_old_backups
  log_info "=== Backup completed successfully: ${daily_path} ==="
}

main "$@"
