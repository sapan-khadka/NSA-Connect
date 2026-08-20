"""Database tools the NSA Connect AI assistant can call for live chapter data."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import member_has_role_at_least
from app.lib.event_visibility import (
    apply_event_visibility_filter,
    event_visible_to_member,
)
from app.lib.semester import get_current_semester_slug
from app.models.announcement import Announcement
from app.models.event import Event, EventType
from app.models.event_task import EventTask, EventTaskKind, EventTaskStatus
from app.models.member import Member, MemberRole, MemberStatus
from app.models.member_dues import DuesStatus, MemberDues
from app.services.dues_service import get_dues_dashboard, get_my_dues_status
from app.services.event_service import EventNotFoundError, get_event_with_tasks
from app.services.finance_service import get_finance_summary
from app.services.org_document_service import list_org_documents


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
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "search_events",
        "description": (
            "Search events by title keyword and optional event type."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string"},
                "event_type": {
                    "type": "string",
                    "enum": [event_type.value for event_type in EventType],
                },
                "limit": {"type": "integer", "minimum": 1, "maximum": 20},
            },
            "required": ["keyword"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_event_details",
        "description": "Get detailed information about one event.",
        "input_schema": {
            "type": "object",
            "properties": {"event_id": {"type": "integer", "minimum": 1}},
            "required": ["event_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_event_prep_tasks",
        "description": "List checklist tasks for an event. Board+ only.",
        "input_schema": {
            "type": "object",
            "properties": {"event_id": {"type": "integer", "minimum": 1}},
            "required": ["event_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "search_members",
        "description": (
            "Search chapter members by name or email. Returns membership status, "
            "role, and position. Use for 'Is Apsana a member?' style questions. "
            "Board+ sees pending/rejected; general members only see approved names "
            "in the public directory."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Name or email fragment",
                },
                "limit": {"type": "integer", "minimum": 1, "maximum": 25},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_member_counts",
        "description": "Member counts by status and role. Board+ only.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
    {
        "name": "get_member_dues",
        "description": (
            "Look up membership dues for a person by name (or optional member_id). "
            "Answers 'Did Mukesh pay dues?'. Treasurer / president / VP only."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "member_id": {"type": "integer", "minimum": 1},
                "semester": {
                    "type": "string",
                    "description": "e.g. 2026-fall; defaults to current semester",
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_dues_summary",
        "description": (
            "Chapter dues dashboard for a semester (paid/unpaid counts and totals). "
            "Treasurer / president / VP only."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "semester": {"type": "string"},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_my_dues",
        "description": "Return the current user's own dues status for a semester.",
        "input_schema": {
            "type": "object",
            "properties": {"semester": {"type": "string"}},
            "additionalProperties": False,
        },
    },
    {
        "name": "get_finance_summary",
        "description": (
            "Treasury balance, income, expenses. Treasurer / president / VP only."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"semester": {"type": "string"}},
            "additionalProperties": False,
        },
    },
    {
        "name": "list_open_tasks",
        "description": (
            "List open event tasks (todo / in progress). "
            "Board sees chapter tasks; others see their assigned tasks."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "minimum": 1, "maximum": 30},
                "assignee_name": {"type": "string"},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "list_announcements",
        "description": "Recent chapter announcements.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 20}},
            "additionalProperties": False,
        },
    },
    {
        "name": "list_upcoming_meetings",
        "description": "Upcoming board meeting records. Board+ only.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 20}},
            "additionalProperties": False,
        },
    },
    {
        "name": "list_nsa_documents",
        "description": (
            "List uploaded NSA chapter documents (policies, guides). "
            "Public docs for all members; board-only docs for board+."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
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
    if isinstance(value, DuesStatus):
        return value.value
    if isinstance(value, EventTaskStatus):
        return value.value
    raise TypeError(f"Object of type {type(value)!r} is not JSON serializable")


def _tool_result(payload: Any) -> str:
    return json.dumps(payload, default=_json_default)


def _require_role(member: Member, minimum_role: MemberRole) -> None:
    if not member_has_role_at_least(member, minimum_role):
        raise ChatToolPermissionError(
            f"Requires {minimum_role.value} role or higher",
        )


def _require_treasury(member: Member) -> None:
    from app.core.permissions import can_manage_treasury

    if not can_manage_treasury(member):
        raise ChatToolPermissionError(
            "Requires treasurer, president, or vice president",
        )


def _list_upcoming_events(
    db: Session, member: Member, tool_input: dict[str, Any]
) -> str:
    limit = max(1, min(int(tool_input.get("limit") or 10), 20))
    now = datetime.now(UTC)
    query = (
        select(Event)
        .where(Event.starts_at >= now)
        .order_by(Event.starts_at.asc())
        .limit(limit)
    )
    query = apply_event_visibility_filter(query, member)
    events = db.scalars(query).all()
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


def _search_events(db: Session, member: Member, tool_input: dict[str, Any]) -> str:
    keyword = str(tool_input.get("keyword", "")).strip()
    if not keyword:
        raise ChatToolValidationError("keyword is required")
    limit = max(1, min(int(tool_input.get("limit") or 10), 20))
    query = select(Event).where(Event.title.ilike(f"%{keyword}%"))
    event_type = tool_input.get("event_type")
    if event_type:
        query = query.where(Event.event_type == EventType(event_type))
    query = apply_event_visibility_filter(query, member)
    events = db.scalars(query.order_by(Event.starts_at.asc()).limit(limit)).all()
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


def _get_event_details(
    db: Session, member: Member, tool_input: dict[str, Any]
) -> str:
    event_id = int(tool_input["event_id"])
    event = db.get(Event, event_id)
    if event is None or not event_visible_to_member(event, member):
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
    db: Session, member: Member, tool_input: dict[str, Any]
) -> str:
    _require_role(member, MemberRole.BOARD)
    event_id = int(tool_input["event_id"])
    event = get_event_with_tasks(db, event_id)
    if not event_visible_to_member(event, member):
        raise EventNotFoundError
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
                    {"label": item.label, "completed": item.is_completed}
                    for item in task.checklist_items
                ],
            }
            for task in checklist_tasks
        ]
    )


def _search_members(db: Session, member: Member, tool_input: dict[str, Any]) -> str:
    query = str(tool_input.get("query", "")).strip()
    if not query:
        raise ChatToolValidationError("query is required")
    limit = max(1, min(int(tool_input.get("limit") or 10), 25))
    is_board = member_has_role_at_least(member, MemberRole.BOARD)

    statement = select(Member).where(
        or_(
            Member.full_name.ilike(f"%{query}%"),
            Member.email.ilike(f"%{query}%"),
        )
    )
    if not is_board:
        statement = statement.where(Member.status == MemberStatus.APPROVED)

    rows = db.scalars(statement.order_by(Member.full_name.asc()).limit(limit)).all()

    if is_board:
        payload = [
            {
                "id": row.id,
                "full_name": row.full_name,
                "email": row.email,
                "status": row.status,
                "role": row.role,
                "position": row.position,
                "is_member": row.status == MemberStatus.APPROVED,
            }
            for row in rows
        ]
    else:
        payload = [
            {
                "id": row.id,
                "full_name": row.full_name,
                "status": "approved",
                "role": row.role,
                "is_member": True,
            }
            for row in rows
        ]

    if not payload:
        return _tool_result(
            {
                "matches": [],
                "note": f"No members matched '{query}'.",
            }
        )
    return _tool_result({"matches": payload, "count": len(payload)})


def _get_member_counts(db: Session, member: Member) -> str:
    _require_role(member, MemberRole.BOARD)
    status_rows = db.execute(
        select(Member.status, func.count()).group_by(Member.status),
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


def _get_member_dues(db: Session, member: Member, tool_input: dict[str, Any]) -> str:
    _require_treasury(member)
    semester = str(tool_input.get("semester") or get_current_semester_slug())
    member_id = tool_input.get("member_id")
    name = str(tool_input.get("name") or "").strip()

    target: Member | None = None
    if member_id is not None:
        target = db.get(Member, int(member_id))
    elif name:
        target = db.scalars(
            select(Member)
            .where(Member.full_name.ilike(f"%{name}%"))
            .order_by(Member.full_name.asc())
            .limit(1)
        ).first()
        # Prefer exact-ish if multiple
        if target is None:
            return _tool_result(
                {"error": "not_found", "detail": f"No member matched '{name}'"}
            )
        candidates = db.scalars(
            select(Member)
            .where(Member.full_name.ilike(f"%{name}%"))
            .order_by(Member.full_name.asc())
            .limit(8)
        ).all()
        if len(candidates) > 1:
            exact = [
                c
                for c in candidates
                if c.full_name.strip().lower() == name.lower()
            ]
            target = exact[0] if exact else candidates[0]
            if not exact and len(candidates) > 1:
                return _tool_result(
                    {
                        "needs_clarification": True,
                        "matches": [
                            {
                                "id": c.id,
                                "full_name": c.full_name,
                                "status": c.status,
                            }
                            for c in candidates
                        ],
                        "note": "Multiple people matched; re-query with member_id.",
                    }
                )
    else:
        raise ChatToolValidationError("Provide name or member_id")

    if target is None:
        return _tool_result({"error": "not_found", "detail": "Member not found"})

    record = db.scalar(
        select(MemberDues)
        .options(joinedload(MemberDues.member))
        .where(
            MemberDues.member_id == target.id,
            MemberDues.semester == semester,
        )
    )
    if record is None:
        return _tool_result(
            {
                "member_id": target.id,
                "full_name": target.full_name,
                "semester": semester,
                "has_dues_record": False,
                "note": "No dues record for this semester yet.",
            }
        )

    status = MemberDues.compute_status(record.amount_owed, record.amount_paid)
    return _tool_result(
        {
            "member_id": target.id,
            "full_name": target.full_name,
            "semester": semester,
            "has_dues_record": True,
            "amount_owed": record.amount_owed,
            "amount_paid": record.amount_paid,
            "status": status,
            "is_paid": status == DuesStatus.PAID,
            "is_unpaid": status == DuesStatus.UNPAID,
            "is_partial": status == DuesStatus.PARTIAL,
            "paid_at": record.paid_at,
            "payment_method": (
                record.payment_method.value if record.payment_method else None
            ),
            "note": record.note,
        }
    )


def _get_dues_summary(db: Session, member: Member, tool_input: dict[str, Any]) -> str:
    _require_treasury(member)
    semester = str(tool_input.get("semester") or get_current_semester_slug())
    dashboard = get_dues_dashboard(db, semester=semester)
    return _tool_result(dashboard.summary.model_dump(mode="json"))


def _get_my_dues(db: Session, member: Member, tool_input: dict[str, Any]) -> str:
    semester = str(tool_input.get("semester") or get_current_semester_slug())
    status = get_my_dues_status(db, member_id=member.id, semester=semester)
    return _tool_result(status.model_dump(mode="json"))


def _get_finance_summary(
    db: Session, member: Member, tool_input: dict[str, Any]
) -> str:
    _require_treasury(member)
    semester = tool_input.get("semester")
    summary = get_finance_summary(db, semester=semester)
    return _tool_result(summary.model_dump(mode="json"))


def _list_open_tasks(db: Session, member: Member, tool_input: dict[str, Any]) -> str:
    limit = max(1, min(int(tool_input.get("limit") or 15), 30))
    assignee_name = str(tool_input.get("assignee_name") or "").strip()
    is_board = member_has_role_at_least(member, MemberRole.BOARD)

    statement = (
        select(EventTask)
        .options(joinedload(EventTask.assignee), joinedload(EventTask.event))
        .where(
            EventTask.status.in_(
                [EventTaskStatus.TODO, EventTaskStatus.IN_PROGRESS]
            )
        )
        .order_by(EventTask.due_date.asc().nulls_last(), EventTask.id.desc())
        .limit(limit)
    )
    if not is_board:
        statement = statement.where(EventTask.assignee_id == member.id)
    elif assignee_name:
        statement = statement.join(Member, Member.id == EventTask.assignee_id).where(
            Member.full_name.ilike(f"%{assignee_name}%")
        )

    tasks = db.scalars(statement).unique().all()
    return _tool_result(
        [
            {
                "id": task.id,
                "title": task.title,
                "status": task.status,
                "due_date": task.due_date,
                "assignee_name": (
                    task.assignee.full_name if task.assignee else None
                ),
                "event_id": task.event_id,
                "event_title": task.event.title if task.event else None,
                "is_overdue": task.is_overdue,
            }
            for task in tasks
        ]
    )


def _list_announcements(
    db: Session, member: Member, tool_input: dict[str, Any]
) -> str:
    del member
    limit = max(1, min(int(tool_input.get("limit") or 10), 20))
    rows = db.scalars(
        select(Announcement)
        .order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
        .limit(limit)
    ).all()
    return _tool_result(
        [
            {
                "id": row.id,
                "title": row.title,
                "category": (
                    row.category.value
                    if hasattr(row.category, "value")
                    else row.category
                ),
                "is_pinned": row.is_pinned,
                "created_at": row.created_at,
                "body_preview": (row.body or "")[:240],
            }
            for row in rows
        ]
    )


def _list_upcoming_meetings(
    db: Session, member: Member, tool_input: dict[str, Any]
) -> str:
    _require_role(member, MemberRole.BOARD)
    limit = max(1, min(int(tool_input.get("limit") or 10), 20))
    now = datetime.now(UTC)
    query = (
        select(Event)
        .where(
            Event.event_type == EventType.MEETING,
            Event.starts_at >= now,
        )
        .order_by(Event.starts_at.asc())
        .limit(limit)
    )
    query = apply_event_visibility_filter(query, member)
    events = db.scalars(query).all()
    if not events:
        past_query = (
            select(Event)
            .where(Event.event_type == EventType.MEETING)
            .order_by(Event.starts_at.desc())
            .limit(limit)
        )
        past_query = apply_event_visibility_filter(past_query, member)
        events = db.scalars(past_query).all()
    return _tool_result(
        [
            {
                "id": event.id,
                "title": event.title,
                "starts_at": event.starts_at,
                "location": event.location,
            }
            for event in events
        ]
    )


def _list_nsa_documents(db: Session, member: Member) -> str:
    docs = list_org_documents(db, member=member)
    return _tool_result(
        [
            {
                "id": doc.id,
                "title": doc.title,
                "description": doc.description,
                "visibility": doc.visibility,
                "file_name": doc.file_name,
                "chunk_count": doc.chunk_count,
            }
            for doc in docs
        ]
    )


def execute_chat_tool(
    *,
    db: Session,
    member: Member,
    tool_name: str,
    tool_input: dict[str, Any],
) -> str:
    try:
        if tool_name == "list_upcoming_events":
            return _list_upcoming_events(db, member, tool_input)
        if tool_name == "search_events":
            return _search_events(db, member, tool_input)
        if tool_name == "get_event_details":
            return _get_event_details(db, member, tool_input)
        if tool_name == "get_event_prep_tasks":
            return _get_event_prep_tasks(db, member, tool_input)
        if tool_name == "search_members":
            return _search_members(db, member, tool_input)
        if tool_name == "get_member_counts":
            return _get_member_counts(db, member)
        if tool_name == "get_member_dues":
            return _get_member_dues(db, member, tool_input)
        if tool_name == "get_dues_summary":
            return _get_dues_summary(db, member, tool_input)
        if tool_name == "get_my_dues":
            return _get_my_dues(db, member, tool_input)
        if tool_name == "get_finance_summary":
            return _get_finance_summary(db, member, tool_input)
        if tool_name == "list_open_tasks":
            return _list_open_tasks(db, member, tool_input)
        if tool_name == "list_announcements":
            return _list_announcements(db, member, tool_input)
        if tool_name == "list_upcoming_meetings":
            return _list_upcoming_meetings(db, member, tool_input)
        if tool_name == "list_nsa_documents":
            return _list_nsa_documents(db, member)
    except ChatToolPermissionError as exc:
        return _tool_result({"error": "permission_denied", "detail": str(exc)})
    except ChatToolValidationError as exc:
        return _tool_result({"error": "validation_error", "detail": str(exc)})
    except EventNotFoundError:
        return _tool_result({"error": "not_found", "detail": "Event not found"})
    except Exception as exc:
        return _tool_result(
            {"error": "tool_failed", "detail": str(exc)[:200]},
        )

    return _tool_result(
        {"error": "unknown_tool", "detail": f"Unknown tool: {tool_name}"},
    )
