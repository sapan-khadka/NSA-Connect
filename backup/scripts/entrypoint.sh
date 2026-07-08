#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

load_env

if [[ $# -gt 0 ]]; then
  exec "$@"
fi

if [[ "${BACKUP_MODE:-scheduled}" == "scheduled" ]]; then
  log_info "Starting backup scheduler (supercronic)"
  exec /usr/local/bin/supercronic /etc/cron.d/nsa-connect-backup
fi

exec "${SCRIPT_DIR}/backup.sh"
