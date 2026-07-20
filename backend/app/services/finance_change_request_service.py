import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.lib.event_finance import assert_event_finance_editable
from app.models.finance_change_request import (
    FinanceChangeAction,
    FinanceChangeRequest,
    FinanceChangeStatus,
)
from app.models.member import Member, MemberRole
from app.schemas.finance import FinanceEntryUpdateRequest
from app.services.event_service import EventNotFoundError
from app.services.finance_service import (
    FinanceEntryNotFoundError,
    delete_finance_entry,
    update_finance_entry,
)

APPROVER_ROLES = frozenset({MemberRole.TREASURER, MemberRole.PRESIDENT})
RECENT_REVIEW_DAYS = 7


@dataclass(frozen=True)
class FinanceChangeRequestSummary:
    pending_count: int
    recently_rejected_count: int
    recently_approved_count: int


class FinanceChangeRequestNotFoundError(Exception):
    pass


class FinanceChangeForbiddenError(Exception):
    pass


class FinanceChangeConflictError(Exception):
    pass


class InvalidFinanceChangeStateError(Exception):
    pass


def _can_submit(member: Member) -> bool:
    return member.role in APPROVER_ROLES


def _can_review(requester: Member, reviewer: Member) -> bool:
    if requester.id == reviewer.id:
        return False
    if requester.role == MemberRole.TREASURER and reviewer.role == MemberRole.PRESIDENT:
        return True
    if requester.role == MemberRole.PRESIDENT and reviewer.role == MemberRole.TREASURER:
        return True
    return False


def _load_request(db: Session, request_id: int) -> FinanceChangeRequest | None:
    return db.scalar(
        select(FinanceChangeRequest)
        .where(FinanceChangeRequest.id == request_id)
        .options(
            selectinload(FinanceChangeRequest.entry),
            selectinload(FinanceChangeRequest.requested_by),
            selectinload(FinanceChangeRequest.reviewed_by),
        ),
    )


def _pending_for_entry(db: Session, entry_id: int) -> FinanceChangeRequest | None:
    return db.scalar(
        select(FinanceChangeRequest).where(
            FinanceChangeRequest.entry_id == entry_id,
            FinanceChangeRequest.status == FinanceChangeStatus.PENDING,
        ),
    )


def submit_update_request(
    db: Session,
    entry_id: int,
    data: FinanceEntryUpdateRequest,
    requester: Member,
) -> FinanceChangeRequest:
    if not _can_submit(requester):
        raise FinanceChangeForbiddenError

    from app.models.finance_entry import FinanceEntry

    entry = db.get(FinanceEntry, entry_id)
    if entry is None:
        raise FinanceEntryNotFoundError

    if entry.event_id is not None:
        from app.models.event import Event

        event = db.get(Event, entry.event_id)
        if event is not None:
            assert_event_finance_editable(event)

    if _pending_for_entry(db, entry_id):
        raise FinanceChangeConflictError("A pending change request already exists")

    updates = data.model_dump(exclude_unset=True)
    target_event_id = updates.get("event_id", entry.event_id)
    if target_event_id is not None:
        from app.models.event import Event

        target_event = db.get(Event, target_event_id)
        if target_event is None:
            raise EventNotFoundError
        assert_event_finance_editable(target_event)

    request = FinanceChangeRequest(
        entry_id=entry_id,
        action=FinanceChangeAction.UPDATE,
        status=FinanceChangeStatus.PENDING,
        payload=json.dumps(data.model_dump(mode="json", exclude_unset=True)),
        requested_by_id=requester.id,
    )
    db.add(request)
    db.commit()
    loaded = _load_request(db, request.id)
    assert loaded is not None

    from app.services.inbox_notification_service import notify_finance_change_pending

    notify_finance_change_pending(
        db,
        request_id=loaded.id,
        requester=requester,
        action_label="update",
    )
    return loaded


def submit_delete_request(
    db: Session,
    entry_id: int,
    requester: Member,
) -> FinanceChangeRequest:
    if not _can_submit(requester):
        raise FinanceChangeForbiddenError

    from app.models.finance_entry import FinanceEntry

    entry = db.get(FinanceEntry, entry_id)
    if entry is None:
        raise FinanceEntryNotFoundError

    if entry.event_id is not None:
        from app.models.event import Event

        event = db.get(Event, entry.event_id)
        if event is not None:
            assert_event_finance_editable(event)

    if _pending_for_entry(db, entry_id):
        raise FinanceChangeConflictError("A pending change request already exists")

    request = FinanceChangeRequest(
        entry_id=entry_id,
        action=FinanceChangeAction.DELETE,
        status=FinanceChangeStatus.PENDING,
        payload=None,
        requested_by_id=requester.id,
    )
    db.add(request)
    db.commit()
    loaded = _load_request(db, request.id)
    assert loaded is not None

    from app.services.inbox_notification_service import notify_finance_change_pending

    notify_finance_change_pending(
        db,
        request_id=loaded.id,
        requester=requester,
        action_label="deletion",
    )
    return loaded


def list_pending_for_reviewer(
    db: Session,
    reviewer: Member,
) -> list[FinanceChangeRequest]:
    pending = list(
        db.scalars(
            select(FinanceChangeRequest)
            .where(FinanceChangeRequest.status == FinanceChangeStatus.PENDING)
            .options(
                selectinload(FinanceChangeRequest.entry),
                selectinload(FinanceChangeRequest.requested_by),
            )
            .order_by(FinanceChangeRequest.created_at.asc()),
        ).all(),
    )
    return [
        request
        for request in pending
        if request.requested_by and _can_review(request.requested_by, reviewer)
    ]


def _recent_review_cutoff() -> datetime:
    return datetime.now(UTC) - timedelta(days=RECENT_REVIEW_DAYS)


def summarize_my_change_requests(
    db: Session,
    member: Member,
) -> FinanceChangeRequestSummary:
    if member.role not in APPROVER_ROLES:
        return FinanceChangeRequestSummary(0, 0, 0)

    pending_count = (
        db.scalar(
            select(func.count())
            .select_from(FinanceChangeRequest)
            .where(
                FinanceChangeRequest.requested_by_id == member.id,
                FinanceChangeRequest.status == FinanceChangeStatus.PENDING,
            ),
        )
        or 0
    )

    recent_cutoff = _recent_review_cutoff()
    recently_rejected_count = (
        db.scalar(
            select(func.count())
            .select_from(FinanceChangeRequest)
            .where(
                FinanceChangeRequest.requested_by_id == member.id,
                FinanceChangeRequest.status == FinanceChangeStatus.REJECTED,
                FinanceChangeRequest.reviewed_at.is_not(None),
                FinanceChangeRequest.reviewed_at >= recent_cutoff,
            ),
        )
        or 0
    )

    recently_approved_count = (
        db.scalar(
            select(func.count())
            .select_from(FinanceChangeRequest)
            .where(
                FinanceChangeRequest.requested_by_id == member.id,
                FinanceChangeRequest.status == FinanceChangeStatus.APPROVED,
                FinanceChangeRequest.reviewed_at.is_not(None),
                FinanceChangeRequest.reviewed_at >= recent_cutoff,
            ),
        )
        or 0
    )

    return FinanceChangeRequestSummary(
        pending_count=pending_count,
        recently_rejected_count=recently_rejected_count,
        recently_approved_count=recently_approved_count,
    )


def list_my_change_requests(
    db: Session,
    member: Member,
    *,
    limit: int = 50,
) -> list[FinanceChangeRequest]:
    if member.role not in APPROVER_ROLES:
        return []

    return list(
        db.scalars(
            select(FinanceChangeRequest)
            .where(FinanceChangeRequest.requested_by_id == member.id)
            .options(
                selectinload(FinanceChangeRequest.entry),
                selectinload(FinanceChangeRequest.requested_by),
                selectinload(FinanceChangeRequest.reviewed_by),
            )
            .order_by(FinanceChangeRequest.created_at.desc())
            .limit(limit),
        ).all(),
    )


def approve_change_request(
    db: Session,
    request_id: int,
    reviewer: Member,
) -> FinanceChangeRequest:
    request = _load_request(db, request_id)
    if request is None:
        raise FinanceChangeRequestNotFoundError

    if request.status != FinanceChangeStatus.PENDING:
        raise InvalidFinanceChangeStateError("Request is no longer pending")

    if request.requested_by is None or not _can_review(request.requested_by, reviewer):
        raise FinanceChangeForbiddenError

    if request.action == FinanceChangeAction.UPDATE:
        payload = json.loads(request.payload or "{}")
        update_finance_entry(
            db,
            request.entry_id,
            FinanceEntryUpdateRequest.model_validate(payload),
        )
    else:
        delete_finance_entry(db, request.entry_id)

    request.status = FinanceChangeStatus.APPROVED
    request.reviewed_by_id = reviewer.id
    request.reviewed_at = datetime.now(UTC)
    requester_id = request.requested_by_id
    db.commit()

    from app.services.inbox_notification_service import notify_finance_change_resolved

    notify_finance_change_resolved(
        db,
        request_id=request_id,
        requester_id=requester_id,
        approved=True,
        reviewer_name=reviewer.full_name,
    )
    return _load_request(db, request_id)  # type: ignore[return-value]


def reject_change_request(
    db: Session,
    request_id: int,
    reviewer: Member,
    *,
    review_note: str | None = None,
) -> FinanceChangeRequest:
    request = _load_request(db, request_id)
    if request is None:
        raise FinanceChangeRequestNotFoundError

    if request.status != FinanceChangeStatus.PENDING:
        raise InvalidFinanceChangeStateError("Request is no longer pending")

    if request.requested_by is None or not _can_review(request.requested_by, reviewer):
        raise FinanceChangeForbiddenError

    request.status = FinanceChangeStatus.REJECTED
    request.reviewed_by_id = reviewer.id
    request.reviewed_at = datetime.now(UTC)
    request.review_note = review_note
    requester_id = request.requested_by_id
    db.commit()

    from app.services.inbox_notification_service import notify_finance_change_resolved

    notify_finance_change_resolved(
        db,
        request_id=request_id,
        requester_id=requester_id,
        approved=False,
        reviewer_name=reviewer.full_name,
    )
    return _load_request(db, request_id)  # type: ignore[return-value]
