#!/usr/bin/env bash

set -euo pipefail

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${LIB_DIR}/common.sh"

s3_object_key() {
  local filename="$1"
  local prefix="${BACKUP_S3_PREFIX%/}"
  if [[ -n "${prefix}" ]]; then
    echo "${prefix}/${filename}"
  else
    echo "${filename}"
  fi
}

upload_to_cloud() {
  local local_path="$1"
  local remote_name
  remote_name="$(basename "${local_path}")"
  local s3_key
  s3_key="$(s3_object_key "${remote_name}")"

  if [[ "${BACKUP_S3_ENABLED}" != "true" ]]; then
    log_info "Cloud upload disabled (BACKUP_S3_ENABLED != true); skipping ${remote_name}"
    return 0
  fi

  require_command aws
  [[ -n "${BACKUP_S3_BUCKET:-}" ]] || die "BACKUP_S3_BUCKET is required when cloud upload is enabled"

  local -a aws_args=(s3 cp "${local_path}" "s3://${BACKUP_S3_BUCKET}/${s3_key}")
  if [[ -n "${BACKUP_S3_ENDPOINT_URL:-}" ]]; then
    aws_args+=(--endpoint-url "${BACKUP_S3_ENDPOINT_URL}")
  fi

  log_info "Uploading ${remote_name} to s3://${BACKUP_S3_BUCKET}/${s3_key}"
  AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}" \
  AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}" \
  AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}" \
    aws "${aws_args[@]}"

  log_info "Cloud upload complete: s3://${BACKUP_S3_BUCKET}/${s3_key}"
}

download_from_cloud() {
  local remote_name="$1"
  local local_path="$2"
  local s3_key
  s3_key="$(s3_object_key "${remote_name}")"

  require_command aws
  [[ -n "${BACKUP_S3_BUCKET:-}" ]] || die "BACKUP_S3_BUCKET is required for cloud download"

  local -a aws_args=(s3 cp "s3://${BACKUP_S3_BUCKET}/${s3_key}" "${local_path}")
  if [[ -n "${BACKUP_S3_ENDPOINT_URL:-}" ]]; then
    aws_args+=(--endpoint-url "${BACKUP_S3_ENDPOINT_URL}")
  fi

  log_info "Downloading s3://${BACKUP_S3_BUCKET}/${s3_key} to ${local_path}"
  AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}" \
  AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}" \
  AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}" \
    aws "${aws_args[@]}"
}
