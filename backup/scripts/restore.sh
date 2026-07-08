#!/usr/bin/env bash
# Restore NSA Connect PostgreSQL from a local or cloud backup file.
#
# Usage:
#   ./restore.sh /backups/daily/nsa_connect_YYYYMMDD_HHMMSS.sql.gz
#   ./restore.sh --from-cloud nsa_connect_YYYYMMDD_HHMMSS.sql.gz.enc
#   ./restore.sh --target-db nsa_connect /path/to/backup.sql.gz

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/encrypt.sh
source "${SCRIPT_DIR}/lib/encrypt.sh"
# shellcheck source=lib/upload.sh
source "${SCRIPT_DIR}/lib/upload.sh"
# shellcheck source=lib/verify.sh
source "${SCRIPT_DIR}/lib/verify.sh"

usage() {
  cat <<'EOF'
Restore NSA Connect database from a backup.

Examples:
  ./restore.sh /backups/daily/nsa_connect_20250706_030000.sql.gz
  ./restore.sh --from-cloud nsa_connect_20250706_030000.sql.gz.enc
  ./restore.sh --target-db nsa_connect_staging backup.sql.gz

Options:
  --from-cloud <filename>   Download encrypted backup from S3/R2/GCS (S3 interop)
  --target-db <name>        Database to restore into (default: POSTGRES_DB)
  --yes                     Skip confirmation prompt (automation / DR tests)
  -h, --help                Show this help
EOF
}

confirm_restore() {
  local target_db="$1"
  if [[ "${RESTORE_ASSUME_YES:-false}" == "true" ]]; then
    return 0
  fi
  echo "WARNING: This will DROP and recreate database '${target_db}' on ${POSTGRES_HOST}:${POSTGRES_PORT}."
  read -r -p "Type the database name to confirm: " typed
  [[ "${typed}" == "${target_db}" ]] || die "Confirmation failed; restore aborted"
}

main() {
  local from_cloud=""
  local target_db=""
  local backup_path=""
  local assume_yes="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --from-cloud)
        from_cloud="$2"
        shift 2
        ;;
      --target-db)
        target_db="$2"
        shift 2
        ;;
      --yes)
        assume_yes="true"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      -*)
        die "Unknown option: $1"
        ;;
      *)
        backup_path="$1"
        shift
        ;;
    esac
  done

  load_env
  export_pg_env
  target_db="${target_db:-${POSTGRES_DB}}"
  RESTORE_ASSUME_YES="${assume_yes}"

  _restore_work_dir="$(mktemp -d)"
  trap 'rm -rf "${_restore_work_dir}"' EXIT

  if [[ -n "${from_cloud}" ]]; then
    local encrypted_local="${_restore_work_dir}/${from_cloud}"
    download_from_cloud "${from_cloud}" "${encrypted_local}"
    backup_path="${_restore_work_dir}/restored.sql.gz"
    decrypt_backup_file "${encrypted_local}" "${backup_path}"
  fi

  [[ -n "${backup_path}" ]] || die "Backup file path required. Run with --help for usage."
  [[ -f "${backup_path}" ]] || die "Backup file not found: ${backup_path}"

  verify_backup_integrity "${backup_path}"
  confirm_restore "${target_db}"

  log_info "Restoring ${backup_path} into ${target_db}"
  restore_backup_to_database "${backup_path}" "${target_db}"
  validate_restored_database "${target_db}"
  log_info "Restore completed successfully into ${target_db}"
}

main "$@"
