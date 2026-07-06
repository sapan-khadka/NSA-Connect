"""Canonical authorization matrix for NSA Connect API endpoints.

Every route under /api/v1 (plus health/debug) must appear here. The test suite
compares this list against the live FastAPI route table and fails when they diverge.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

MinRole = Literal[
    "public",
    "member",
    "board",
    "treasurer",
    "president",
    "meeting_manager",
    "task_manager",
    "task_oversight",
    "self",
]


@dataclass(frozen=True)
class EndpointAuthRule:
  method: str
  path: str
  description: str
  min_role: MinRole
  guard: str
  object_rules: str = ""
  skip_role_probe: bool = False


ENDPOINT_AUTH_RULES: tuple[EndpointAuthRule, ...] = (
    # Root & health
    EndpointAuthRule("GET", "/", "API root message", "public", "none"),
    EndpointAuthRule("GET", "/health", "Liveness check", "public", "none"),
    EndpointAuthRule(
        "GET",
        "/health/frontend-url-debug",
        "Debug FRONTEND_URL resolution",
        "board",
        "require_board",
        object_rules="Strip before production",
    ),
    # Auth
    EndpointAuthRule("POST", "/api/v1/auth/register", "Register pending member", "public", "none"),
    EndpointAuthRule("POST", "/api/v1/auth/login", "Login", "public", "none"),
    EndpointAuthRule("POST", "/api/v1/auth/refresh", "Refresh tokens", "public", "none; valid refresh token"),
    EndpointAuthRule("GET", "/api/v1/auth/me", "Current member profile", "member", "get_current_member"),
    EndpointAuthRule(
        "POST",
        "/api/v1/auth/password-reset/request",
        "Request password reset email",
        "public",
        "none; identical response for unknown email",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/auth/password-reset/confirm",
        "Confirm password reset",
        "public",
        "none; valid reset token",
    ),
    # Members
    EndpointAuthRule("GET", "/api/v1/members/talent-options", "Talent enum options", "member", "get_current_member"),
    EndpointAuthRule(
        "GET",
        "/api/v1/members",
        "Member directory",
        "member",
        "get_current_member",
        object_rules="Approved only by default; status filter board+; privacy fields via MemberResponse.from_member",
    ),
    EndpointAuthRule("GET", "/api/v1/members/me", "Own profile", "self", "get_current_member"),
    EndpointAuthRule("PATCH", "/api/v1/members/me", "Update own profile", "self", "get_current_member"),
    EndpointAuthRule(
        "POST",
        "/api/v1/members/me/password",
        "Change own password",
        "self",
        "get_current_member",
    ),
    EndpointAuthRule("GET", "/api/v1/members/assignees", "Task assignee list", "board", "require_board"),
    EndpointAuthRule("GET", "/api/v1/members/pending", "Pending approvals queue", "board", "require_board"),
    EndpointAuthRule("PATCH", "/api/v1/members/{member_id}/approve", "Approve member", "board", "require_board"),
    EndpointAuthRule("PATCH", "/api/v1/members/{member_id}/reject", "Reject member", "board", "require_board"),
    EndpointAuthRule("PATCH", "/api/v1/members/{member_id}", "Board edit member profile", "board", "require_board"),
    EndpointAuthRule(
        "PATCH",
        "/api/v1/members/{member_id}/role",
        "Change member role",
        "president",
        "require_president; cannot change own role",
    ),
    EndpointAuthRule(
        "PATCH",
        "/api/v1/members/{member_id}/position",
        "Change member position",
        "president",
        "require_president",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/members/{member_id}",
        "Get member by ID",
        "member",
        "get_current_member",
        object_rules="Non-approved hidden unless board; privacy fields via from_member",
        skip_role_probe=True,
    ),
    # Me
    EndpointAuthRule(
        "GET",
        "/api/v1/me/volunteer-signups",
        "Own volunteer signups",
        "self",
        "get_current_member",
    ),
    # Announcements
    EndpointAuthRule("GET", "/api/v1/announcements", "List announcements", "member", "get_current_member"),
    EndpointAuthRule("GET", "/api/v1/announcements/{announcement_id}", "Get announcement", "member", "get_current_member"),
    EndpointAuthRule("POST", "/api/v1/announcements", "Create announcement", "board", "require_board"),
    EndpointAuthRule("PATCH", "/api/v1/announcements/{announcement_id}", "Update announcement", "board", "require_board"),
    EndpointAuthRule("DELETE", "/api/v1/announcements/{announcement_id}", "Delete announcement", "board", "require_board"),
    # Constitution
    EndpointAuthRule("POST", "/api/v1/constitution/upload", "Upload constitution PDF", "board", "require_board"),
    EndpointAuthRule("POST", "/api/v1/constitution/search", "Search constitution", "member", "get_current_member"),
    # AI
    EndpointAuthRule("POST", "/api/v1/ai/generate-checklist", "AI event checklist", "board", "require_board"),
    EndpointAuthRule("POST", "/api/v1/ai/draft-announcement-email", "AI announcement draft", "board", "require_board"),
    EndpointAuthRule("POST", "/api/v1/ai/summarize-minutes", "AI minutes summary", "board", "require_board"),
    EndpointAuthRule(
        "POST",
        "/api/v1/ai/chat/stream",
        "Streaming AI assistant",
        "member",
        "get_current_member",
        object_rules="DB tools role-scoped; events filtered by visibility",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/ai/chat",
        "AI assistant chat",
        "member",
        "get_current_member",
        object_rules="DB tools role-scoped; events filtered by visibility",
    ),
    # Events (core)
    EndpointAuthRule(
        "GET",
        "/api/v1/events",
        "List events",
        "member",
        "get_current_member",
        object_rules="apply_event_visibility_filter on closed meetings",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/upcoming",
        "Upcoming events",
        "member",
        "get_current_member",
        object_rules="apply_event_visibility_filter",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/past",
        "Past events",
        "member",
        "get_current_member",
        object_rules="apply_event_visibility_filter",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/{event_id}",
        "Event detail",
        "member",
        "get_current_member",
        object_rules="404 if closed meeting and not board+",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "PUT",
        "/api/v1/events/{event_id}/rsvp",
        "Set RSVP status",
        "self",
        "get_current_member",
        object_rules="ensure_member_can_access_event; own RSVP only",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/rsvp",
        "RSVP going",
        "self",
        "get_current_member",
        object_rules="ensure_member_can_access_event",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "DELETE",
        "/api/v1/events/{event_id}/rsvp",
        "Cancel RSVP",
        "self",
        "get_current_member",
        object_rules="ensure_member_can_access_event",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/volunteer-signup",
        "Volunteer for event",
        "self",
        "get_current_member",
        object_rules="ensure_member_can_access_event",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "DELETE",
        "/api/v1/events/{event_id}/volunteer-signup",
        "Withdraw event volunteer signup",
        "self",
        "get_current_member",
        object_rules="ensure_member_can_access_event; own signup",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/{event_id}/volunteer-signups",
        "List event volunteer signups",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/feedback",
        "Submit event feedback",
        "self",
        "get_current_member",
        object_rules="ensure_member_can_access_event; past event; own feedback",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/{event_id}/feedback",
        "List event feedback",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/{event_id}/invited-participants",
        "List invited participants",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/invited-participants",
        "Invite participants",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "DELETE",
        "/api/v1/events/{event_id}/invited-participants/{member_id}",
        "Remove participant invitation",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/{event_id}/rsvps",
        "RSVP attendee list",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/tasks",
        "Add prep task",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/prep-tasks",
        "Add prep task (alias)",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/slots",
        "Create volunteer slot",
        "board",
        "require_board",
    ),
    EndpointAuthRule("POST", "/api/v1/events", "Create event", "board", "require_board"),
    EndpointAuthRule("PATCH", "/api/v1/events/{event_id}", "Update event", "board", "require_board"),
    EndpointAuthRule("DELETE", "/api/v1/events/{event_id}", "Delete event", "board", "require_board"),
    # Event check-in
    EndpointAuthRule(
        "GET",
        "/api/v1/events/{event_id}/checkin/qr",
        "Check-in QR code",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/checkin/regenerate",
        "Regenerate check-in token",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/{event_id}/checkins",
        "List check-ins",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/checkin",
        "Member check-in",
        "member",
        "get_current_member",
        object_rules="Valid check-in token + time window",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/checkin/guest",
        "Guest check-in",
        "public",
        "none",
        object_rules="Valid check-in token + time window; rate limited",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/{event_id}/attendance-summary",
        "Attendance summary",
        "board",
        "require_board",
    ),
    # Event meetings
    EndpointAuthRule("GET", "/api/v1/events/meetings", "List meetings", "board", "require_board"),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/{event_id}/meeting",
        "Meeting detail",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "PUT",
        "/api/v1/events/{event_id}/meeting/notes",
        "Update meeting notes",
        "meeting_manager",
        "can_manage_meeting_records",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/meeting/summarize",
        "AI summarize meeting",
        "meeting_manager",
        "can_manage_meeting_records",
    ),
    EndpointAuthRule(
        "PUT",
        "/api/v1/events/{event_id}/meeting/attendance",
        "Update meeting attendance",
        "meeting_manager",
        "can_manage_meeting_records",
    ),
    # Event photos
    EndpointAuthRule(
        "GET",
        "/api/v1/events/photos/albums",
        "Photo album index",
        "member",
        "get_current_member",
        object_rules="apply_event_visibility_filter on archive events",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/{event_id}/photos",
        "List event photos",
        "member",
        "get_current_member",
        object_rules="event_visible_to_member",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/photos",
        "Upload event photo",
        "member",
        "get_current_member",
        object_rules="event_visible_to_member",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/photos/download",
        "Download photo album ZIP",
        "member",
        "get_current_member",
        object_rules="event_visible_to_member",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "DELETE",
        "/api/v1/events/{event_id}/photos/{photo_id}",
        "Delete event photo",
        "member",
        "get_current_member",
        object_rules="Uploader or board+",
        skip_role_probe=True,
    ),
    # Event suggestions
    EndpointAuthRule("GET", "/api/v1/event-suggestions", "List suggestions", "member", "get_current_member"),
    EndpointAuthRule("POST", "/api/v1/event-suggestions", "Create suggestion", "member", "get_current_member"),
    EndpointAuthRule(
        "PATCH",
        "/api/v1/event-suggestions/{suggestion_id}/status",
        "Update suggestion status",
        "board",
        "require_board",
    ),
    # Event tasks
    EndpointAuthRule(
        "POST",
        "/api/v1/events/{event_id}/event-tasks",
        "Create event task",
        "task_manager",
        "require_task_manager",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/events/{event_id}/event-tasks",
        "List event tasks",
        "board",
        "require_board",
    ),
    EndpointAuthRule("GET", "/api/v1/event-tasks/mine", "My assigned tasks", "self", "get_current_member"),
    EndpointAuthRule(
        "GET",
        "/api/v1/event-tasks/overview",
        "Task oversight dashboard",
        "task_oversight",
        "require_task_oversight",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/event-tasks/uploads",
        "Upload task photo",
        "member",
        "get_current_member",
    ),
    EndpointAuthRule(
        "PATCH",
        "/api/v1/event-tasks/{task_id}",
        "Update event task",
        "member",
        "get_current_member",
        object_rules="Assignee or board+ in service",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "PATCH",
        "/api/v1/event-tasks/{task_id}/checklist-items/{item_id}",
        "Toggle checklist item",
        "member",
        "get_current_member",
        object_rules="Assignee or board+ in service",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "DELETE",
        "/api/v1/event-tasks/{task_id}",
        "Delete event task",
        "task_manager",
        "require_task_manager",
    ),
    # Prep tasks (legacy)
    EndpointAuthRule(
        "PATCH",
        "/api/v1/tasks/{task_id}",
        "Update prep task",
        "member",
        "get_current_member",
        object_rules="Assignee or board+ in service",
        skip_role_probe=True,
    ),
    EndpointAuthRule(
        "PATCH",
        "/api/v1/tasks/{task_id}/checklist-items/{item_id}",
        "Toggle prep checklist item",
        "member",
        "get_current_member",
        object_rules="Assignee or board+ in service",
        skip_role_probe=True,
    ),
    # Volunteer slots
    EndpointAuthRule(
        "POST",
        "/api/v1/slots/{slot_id}/signup",
        "Sign up for volunteer slot",
        "self",
        "get_current_member",
        object_rules="ensure_member_can_access_event on slot's event",
        skip_role_probe=True,
    ),
    # Reports
    EndpointAuthRule("GET", "/api/v1/reports", "List reports", "board", "require_board"),
    EndpointAuthRule("POST", "/api/v1/reports", "Generate report", "board", "require_board"),
    EndpointAuthRule(
        "GET",
        "/api/v1/reports/{report_id}",
        "Get report detail",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/reports/{report_id}/pdf",
        "Download report PDF",
        "board",
        "require_board",
    ),
    # Finance
    EndpointAuthRule("POST", "/api/v1/finance/receipts", "Upload receipt", "treasurer", "require_treasurer"),
    EndpointAuthRule(
        "GET",
        "/api/v1/finance/expenses/by-category",
        "Expenses by category",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/finance/event-budgets",
        "Event budget list",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/finance/events/{event_id}/budget",
        "Single event budget",
        "board",
        "require_board",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/finance/change-requests/pending",
        "Pending finance changes",
        "treasurer",
        "require_treasurer",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/finance/change-requests/mine/summary",
        "Own change request summary",
        "treasurer",
        "require_treasurer",
    ),
    EndpointAuthRule(
        "GET",
        "/api/v1/finance/change-requests/mine",
        "Own change requests",
        "treasurer",
        "require_treasurer",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/finance/change-requests/{request_id}/approve",
        "Approve finance change",
        "treasurer",
        "require_treasurer",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/finance/change-requests/{request_id}/reject",
        "Reject finance change",
        "treasurer",
        "require_treasurer",
    ),
    EndpointAuthRule("GET", "/api/v1/finance/summary", "Finance summary", "treasurer", "require_treasurer"),
    EndpointAuthRule("GET", "/api/v1/finance", "List finance entries", "treasurer", "require_treasurer"),
    EndpointAuthRule("POST", "/api/v1/finance", "Create finance entry", "treasurer", "require_treasurer"),
    EndpointAuthRule(
        "PATCH",
        "/api/v1/finance/{entry_id}",
        "Update finance entry",
        "treasurer",
        "require_treasurer",
    ),
    EndpointAuthRule(
        "DELETE",
        "/api/v1/finance/{entry_id}",
        "Delete finance entry",
        "treasurer",
        "require_treasurer",
    ),
    # Dues
    EndpointAuthRule("GET", "/api/v1/finance/dues", "Dues dashboard", "treasurer", "require_treasurer"),
    EndpointAuthRule("GET", "/api/v1/finance/dues/settings", "Dues settings", "treasurer", "require_treasurer"),
    EndpointAuthRule("PUT", "/api/v1/finance/dues/settings", "Update dues settings", "treasurer", "require_treasurer"),
    EndpointAuthRule("POST", "/api/v1/finance/dues/generate", "Generate dues records", "treasurer", "require_treasurer"),
    EndpointAuthRule("GET", "/api/v1/finance/dues/mine", "Own dues status", "self", "get_current_member"),
    EndpointAuthRule(
        "PATCH",
        "/api/v1/finance/dues/{dues_id}",
        "Update dues record",
        "treasurer",
        "require_treasurer",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/finance/dues/{dues_id}/mark-paid",
        "Mark dues paid",
        "treasurer",
        "require_treasurer",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/finance/dues/{dues_id}/mark-unpaid",
        "Mark dues unpaid",
        "treasurer",
        "require_treasurer",
    ),
    # Notifications
    EndpointAuthRule(
        "GET",
        "/api/v1/notifications/preferences",
        "Notification preferences",
        "self",
        "get_current_member",
    ),
    EndpointAuthRule(
        "PATCH",
        "/api/v1/notifications/preferences",
        "Update notification preferences",
        "self",
        "get_current_member",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/notifications/test-email",
        "Send test email",
        "board",
        "require_board",
        object_rules="Strip before production",
    ),
    EndpointAuthRule(
        "POST",
        "/api/v1/notifications/run-check",
        "Run notification scan",
        "board",
        "require_board",
        object_rules="Strip before production",
    ),
)


RESTRICTED_MIN_ROLES = frozenset({
    "board",
    "treasurer",
    "president",
    "meeting_manager",
    "task_manager",
    "task_oversight",
})

RESTRICTED_ENDPOINT_RULES: tuple[EndpointAuthRule, ...] = tuple(
    rule for rule in ENDPOINT_AUTH_RULES if rule.min_role in RESTRICTED_MIN_ROLES
)

# Static-path probes (no ID substitution) — kept for fast smoke tests.
BOARD_ONLY_PATHS: tuple[tuple[str, str], ...] = tuple(
    (rule.method, rule.path)
    for rule in ENDPOINT_AUTH_RULES
    if rule.min_role == "board" and "{" not in rule.path
)

TREASURER_ONLY_PATHS: tuple[tuple[str, str], ...] = tuple(
    (rule.method, rule.path)
    for rule in ENDPOINT_AUTH_RULES
    if rule.min_role == "treasurer" and "{" not in rule.path
)

MEMBER_REQUIRED_PATHS: tuple[tuple[str, str], ...] = tuple(
    (rule.method, rule.path)
    for rule in ENDPOINT_AUTH_RULES
    if rule.min_role in {"member", "self"} and not rule.skip_role_probe
)

PUBLIC_PATHS: tuple[tuple[str, str], ...] = tuple(
    (rule.method, rule.path)
    for rule in ENDPOINT_AUTH_RULES
    if rule.min_role == "public"
)
