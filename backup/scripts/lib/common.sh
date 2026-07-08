#!/usr/bin/env bash
# Shared helpers for NSA Connect database backups.

set -euo pipefail

_COMMON_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="$(cd "${_COMMON_LIB_DIR}/../.." && pwd)"

load_env() {
  local env_file="${BACKUP_ENV_FILE:-${BACKUP_ROOT}/.env}"
  if [[ -f "${env_file}" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "${env_file}"
    set +a
  fi

  BACKUP_DIR="${BACKUP_DIR:-/backups}"
  BACKUP_LOG_FILE="${BACKUP_LOG_FILE:-${BACKUP_DIR}/backup.log}"
  BACKUP_DAILY_RETENTION_DAYS="${BACKUP_DAILY_RETENTION_DAYS:-30}"
  BACKUP_WEEKLY_RETENTION_WEEKS="${BACKUP_WEEKLY_RETENTION_WEEKS:-12}"
  BACKUP_WEEKLY_DAY="${BACKUP_WEEKLY_DAY:-0}"
  BACKUP_VERIFY_RESTORE="${BACKUP_VERIFY_RESTORE:-true}"
  BACKUP_VERIFY_DB_PREFIX="${BACKUP_VERIFY_DB_PREFIX:-nsa_connect_verify}"
  BACKUP_S3_ENABLED="${BACKUP_S3_ENABLED:-false}"
  BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-production}"
  BACKUP_NOTIFY_ON_FAILURE="${BACKUP_NOTIFY_ON_FAILURE:-true}"
  BACKUP_MODE="${BACKUP_MODE:-manual}"

  mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly" "${BACKUP_DIR}/encrypted"
}

log() {
  local level="$1"
  shift
  local message="[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [${level}] $*"
  echo "${message}"
  mkdir -p "$(dirname "${BACKUP_LOG_FILE}")"
  echo "${message}" >> "${BACKUP_LOG_FILE}"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }

die() {
  log_error "$@"
  exit 1
}

parse_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    if [[ "${DATABASE_URL}" =~ postgresql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^?]+) ]]; then
      POSTGRES_USER="${BASH_REMATCH[1]}"
      POSTGRES_PASSWORD="${BASH_REMATCH[2]}"
      POSTGRES_HOST="${BASH_REMATCH[3]}"
      POSTGRES_PORT="${BASH_REMATCH[4]:-5432}"
      POSTGRES_DB="${BASH_REMATCH[5]}"
      return 0
    fi
    die "Could not parse DATABASE_URL: ${DATABASE_URL}"
  fi

  POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
  POSTGRES_PORT="${POSTGRES_PORT:-5432}"
  POSTGRES_DB="${POSTGRES_DB:-nsa_connect}"
  POSTGRES_USER="${POSTGRES_USER:-postgres}"
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
}

export_pg_env() {
  parse_database_url
  export PGPASSWORD="${POSTGRES_PASSWORD}"
  export PGHOST="${POSTGRES_HOST}"
  export PGPORT="${POSTGRES_PORT}"
  export PGUSER="${POSTGRES_USER}"
  export PGDATABASE="${POSTGRES_DB}"
}

timestamp_utc() {
  date -u +"%Y%m%d_%H%M%S"
}

iso_week_label() {
  date -u +"%Y-W%V"
}

human_size() {
  local bytes="$1"
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec-i --suffix=B "${bytes}"
  else
    echo "${bytes} bytes"
  fi
}

file_size_bytes() {
  local path="$1"
  if [[ "$(uname)" == "Darwin" ]]; then
    stat -f%z "${path}"
  else
    stat -c%s "${path}"
  fi
}

require_command() {
  local cmd="$1"
  command -v "${cmd}" >/dev/null 2>&1 || die "Required command not found: ${cmd}"
}
