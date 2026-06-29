import json
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.event import Event, EventType
from app.models.member import Member, MemberRole, MemberStatus
from app.services.event_service import EventNotFoundError, get_event_with_tasks
from app.models.event_task import EventTaskKind
from app.services.finance_service import get_finance_summary


class ChatToolPermissionError(Exception):
    pass


class ChatToolValidationError(Exception):
    pass


CHAT_TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "list_upcoming_events",
        "description": (
            "List upcoming NSA events ordered by start date. "
            "Use for questions about what is happening soon."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 20,
                    "description": "Maximum number of events to return",
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "search_events",
        "description": (
            "Search events by title keyword and optional event type. "
            "Use when the user asks about a specific event by name."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "keyword": {
                    "type": "string",
                    "description": "Case-insensitive keyword to match in event titles",
                },
                "event_type": {
                    "type": "string",
                    "enum": [event_type.value for event_type in EventType],
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 20,
                },
            },
            "required": ["keyword"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_event_details",
        "description": (
            "Get detailed information about one event, including description "
            "and budget."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {
                    "type": "integer",
                    "minimum": 1,
                },
            },
            "required": ["event_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_event_prep_tasks",
        "description": (
            "List prep tasks and checklist progress for an event. "
            "Board members and above only."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "event_id": {
                    "type": "integer",
                    "minimum": 1,
                },
            },
            "required": ["event_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_member_counts",
        "description": (
            "Return approved, pending, and total member counts plus counts by role. "
            "Board members and above only."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
    {
        "name": "get_finance_summary",
        "description": (
            "Return treasury balance, income, expenses, and per-event breakdown. "
            "Treasurer and above only."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "semester": {
                    "type": "string",
                    "description": "Optional semester filter such as 2026-Spring",
                },
            },
            "additionalProperties": False,
        },
    },
]


def _json_default(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, EventType):
        return value.value
    if isinstance(value, MemberRole):
        return value.value
    if isinstance(value, MemberStatus):
        return value.value
    raise TypeError(f"Object of type {type(value)!r} is not JSON serializable")


def _tool_result(payload: Any) -> str:
    return json.dumps(payload, default=_json_default)


def _require_role(member: Member, minimum_role: MemberRole) -> None:
    if not member.has_role_at_least(minimum_role):
        raise ChatToolPermissionError(
            f"Requires {minimum_role.value} role or higher",
        )


def _list_upcoming_events(db: Session, tool_input: dict[str, Any]) -> str:
    limit = int(tool_input.get("limit") or 10)
    limit = max(1, min(limit, 20))
    now = datetime.now(UTC)

    events = db.scalars(
        select(Event)
        .where(Event.starts_at >= now)
        .order_by(Event.starts_at.asc())
        .limit(limit),
    ).all()

    return _tool_result(
        [
            {
                "id": event.id,
                "title": event.title,
                "event_type": event.event_type,
                "starts_at": event.starts_at,
                "location": event.location,
                "budget": event.budget,
            }
            for event in events
        ]
    )


def _search_events(db: Session, tool_input: dict[str, Any]) -> str:
    keyword = str(tool_input.get("keyword", "")).strip()
    if not keyword:
        raise ChatToolValidationError("keyword is required")

    limit = int(tool_input.get("limit") or 10)
    limit = max(1, min(limit, 20))

    query = select(Event).where(Event.title.ilike(f"%{keyword}%"))
    event_type = tool_input.get("event_type")
    if event_type:
        query = query.where(Event.event_type == EventType(event_type))

    events = db.scalars(
        query.order_by(Event.starts_at.asc()).limit(limit),
    ).all()

    return _tool_result(
        [
            {
                "id": event.id,
                "title": event.title,
                "event_type": event.event_type,
                "starts_at": event.starts_at,
            }
            for event in events
        ]
    )


def _get_event_details(db: Session, tool_input: dict[str, Any]) -> str:
    event_id = int(tool_input["event_id"])
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError

    return _tool_result(
        {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "event_type": event.event_type,
            "starts_at": event.starts_at,
            "ends_at": event.ends_at,
            "location": event.location,
            "budget": event.budget,
        }
    )


def _get_event_prep_tasks(
    db: Session,
    member: Member,
    tool_input: dict[str, Any],
) -> str:
    _require_role(member, MemberRole.BOARD)
    event_id = int(tool_input["event_id"])
    event = get_event_with_tasks(db, event_id)
    checklist_tasks = [
        task for task in event.event_tasks if task.task_kind == EventTaskKind.CHECKLIST
    ]

    return _tool_result(
        [
            {
                "id": task.id,
                "group_name": task.title,
                "due_date": task.due_date,
                "completed": task.is_checklist_complete,
                "assignee_id": task.assignee_id,
                "checklist_items": [
                    {
                        "label": item.label,
                        "completed": item.is_completed,
                    }
                    for item in task.checklist_items
                ],
            }
            for task in checklist_tasks
        ]
    )


def _get_member_counts(db: Session, member: Member) -> str:
    _require_role(member, MemberRole.BOARD)

    status_rows = db.execute(
        select(Member.status, func.count())
        .group_by(Member.status),
    ).all()
    role_rows = db.execute(
        select(Member.role, func.count())
        .where(Member.status == MemberStatus.APPROVED)
        .group_by(Member.role),
    ).all()

    return _tool_result(
        {
            "by_status": {status.value: count for status, count in status_rows},
            "by_role_approved": {role.value: count for role, count in role_rows},
        }
    )


def _get_finance_summary(
    db: Session,
    member: Member,
    tool_input: dict[str, Any],
) -> str:
    _require_role(member, MemberRole.TREASURER)
    semester = tool_input.get("semester")
    summary = get_finance_summary(db, semester=semester)
    return _tool_result(summary.model_dump(mode="json"))


def execute_chat_tool(
    *,
    db: Session,
    member: Member,
    tool_name: str,
    tool_input: dict[str, Any],
) -> str:
    try:
        if tool_name == "list_upcoming_events":
            return _list_upcoming_events(db, tool_input)
        if tool_name == "search_events":
            return _search_events(db, tool_input)
        if tool_name == "get_event_details":
            return _get_event_details(db, tool_input)
        if tool_name == "get_event_prep_tasks":
            return _get_event_prep_tasks(db, member, tool_input)
        if tool_name == "get_member_counts":
            return _get_member_counts(db, member)
        if tool_name == "get_finance_summary":
            return _get_finance_summary(db, member, tool_input)
    except ChatToolPermissionError as exc:
        return _tool_result({"error": "permission_denied", "detail": str(exc)})
    except ChatToolValidationError as exc:
        return _tool_result({"error": "validation_error", "detail": str(exc)})
    except EventNotFoundError:
        return _tool_result({"error": "not_found", "detail": "Event not found"})

    return _tool_result(
        {"error": "unknown_tool", "detail": f"Unknown tool: {tool_name}"},
    )
