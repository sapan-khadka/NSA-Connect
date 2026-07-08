#!/usr/bin/env bash

set -euo pipefail

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${LIB_DIR}/common.sh"

send_failure_notification() {
  local subject="$1"
  local body="$2"

  if [[ "${BACKUP_NOTIFY_ON_FAILURE}" != "true" ]]; then
    log_info "Failure notifications disabled"
    return 0
  fi

  if [[ -n "${BACKUP_DISCORD_WEBHOOK_URL:-}" ]]; then
    local payload
    payload="$(SUBJECT="${subject}" BODY="${body}" python3 - <<'PY'
import json
import os
content = os.environ["SUBJECT"] + "\n```" + os.environ["BODY"] + "```"
print(json.dumps({"content": content}))
PY
)"
    curl -fsS -X POST "${BACKUP_DISCORD_WEBHOOK_URL}" \
      -H "Content-Type: application/json" \
      -d "${payload}" \
      >/dev/null || log_warn "Discord webhook notification failed"
    log_info "Discord failure notification sent"
  fi

  if [[ -n "${BACKUP_RESEND_API_KEY:-}" && -n "${BACKUP_ALERT_EMAIL_TO:-}" ]]; then
    local from_email="${BACKUP_ALERT_EMAIL_FROM:-NSA Connect Backups <onboarding@resend.dev>}"
    local email_payload
    email_payload="$(FROM_EMAIL="${from_email}" TO_EMAIL="${BACKUP_ALERT_EMAIL_TO}" SUBJECT="${subject}" BODY="${body}" python3 - <<'PY'
import json
import os
print(json.dumps({
  "from": os.environ["FROM_EMAIL"],
  "to": [os.environ["TO_EMAIL"]],
  "subject": os.environ["SUBJECT"],
  "text": os.environ["BODY"],
}))
PY
)"
    curl -fsS -X POST "https://api.resend.com/emails" \
      -H "Authorization: Bearer ${BACKUP_RESEND_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "${email_payload}" \
      >/dev/null || log_warn "Resend email notification failed"
    log_info "Email failure notification sent to ${BACKUP_ALERT_EMAIL_TO}"
  fi
}
