#!/usr/bin/env bash

set -euo pipefail

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${LIB_DIR}/common.sh"

encrypt_backup_file() {
  local input_path="$1"
  local output_path="$2"

  if [[ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]]; then
    die "BACKUP_ENCRYPTION_PASSPHRASE is required for encrypted cloud uploads"
  fi

  require_command openssl
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -pass "env:BACKUP_ENCRYPTION_PASSPHRASE" \
    -in "${input_path}" \
    -out "${output_path}.tmp"
  mv "${output_path}.tmp" "${output_path}"
  log_info "Encrypted backup written to ${output_path}"
}

decrypt_backup_file() {
  local input_path="$1"
  local output_path="$2"

  if [[ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]]; then
    die "BACKUP_ENCRYPTION_PASSPHRASE is required to decrypt ${input_path}"
  fi

  openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
    -pass "env:BACKUP_ENCRYPTION_PASSPHRASE" \
    -in "${input_path}" \
    -out "${output_path}.tmp"
  mv "${output_path}.tmp" "${output_path}"
  log_info "Decrypted backup written to ${output_path}"
}
