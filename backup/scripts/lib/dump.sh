#!/usr/bin/env bash

set -euo pipefail

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${LIB_DIR}/common.sh"

create_backup_dump() {
  local output_path="$1"
  require_command pg_dump

  export_pg_env
  log_info "Starting pg_dump of ${POSTGRES_DB}@${POSTGRES_HOST}:${POSTGRES_PORT}"

  pg_dump \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --no-owner \
    --no-acl \
    --format=plain \
    --encoding=UTF8 \
    | gzip -9 > "${output_path}.tmp"

  mv "${output_path}.tmp" "${output_path}"
  log_info "Dump written to ${output_path}"
}
