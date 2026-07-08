#!/usr/bin/env bash

set -euo pipefail

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${LIB_DIR}/common.sh"

prune_old_backups() {
  local daily_dir="${BACKUP_DIR}/daily"
  local weekly_dir="${BACKUP_DIR}/weekly"
  local encrypted_dir="${BACKUP_DIR}/encrypted"

  log_info "Applying retention: daily=${BACKUP_DAILY_RETENTION_DAYS}d, weekly=${BACKUP_WEEKLY_RETENTION_WEEKS}w"

  if [[ -d "${daily_dir}" ]]; then
    find "${daily_dir}" -maxdepth 1 -type f -name '*.sql.gz' -mtime "+${BACKUP_DAILY_RETENTION_DAYS}" -print -delete \
      | while read -r removed; do
          log_info "Pruned expired daily backup: ${removed}"
        done
  fi

  if [[ -d "${weekly_dir}" ]]; then
    local weekly_days=$((BACKUP_WEEKLY_RETENTION_WEEKS * 7))
    find "${weekly_dir}" -maxdepth 1 -type f -name '*.sql.gz' -mtime "+${weekly_days}" -print -delete \
      | while read -r removed; do
          log_info "Pruned expired weekly backup: ${removed}"
        done
  fi

  if [[ -d "${encrypted_dir}" ]]; then
    find "${encrypted_dir}" -maxdepth 1 -type f -name '*.sql.gz.enc' -mtime "+${BACKUP_DAILY_RETENTION_DAYS}" -print -delete \
      | while read -r removed; do
          log_info "Pruned expired encrypted artifact: ${removed}"
        done
  fi
}

maybe_promote_weekly_backup() {
  local daily_backup_path="$1"
  local weekly_dir="${BACKUP_DIR}/weekly"
  local day_of_week
  day_of_week="$(date -u +%w)"

  if [[ "${day_of_week}" != "${BACKUP_WEEKLY_DAY}" ]]; then
    return 0
  fi

  local weekly_name="nsa_connect_$(iso_week_label).sql.gz"
  local weekly_path="${weekly_dir}/${weekly_name}"
  cp -f "${daily_backup_path}" "${weekly_path}"
  log_info "Promoted weekly backup: ${weekly_path}"
}
