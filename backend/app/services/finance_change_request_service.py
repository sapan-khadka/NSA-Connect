import json
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

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
    if (
        requester.role == MemberRole.TREASURER
        and reviewer.role == MemberRole.PRESIDENT
    ):
        return True
    if (
        requester.role == MemberRole.PRESIDENT
        and reviewer.role == MemberRole.TREASURER
    ):
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

    if db.get(FinanceEntry, entry_id) is None:
        raise FinanceEntryNotFoundError

    if _pending_for_entry(db, entry_id):
        raise FinanceChangeConflictError("A pending change request already exists")

    updates = data.model_dump(exclude_unset=True)
    if updates.get("event_id") is not None:
        from app.models.event import Event

        if db.get(Event, updates["event_id"]) is None:
            raise EventNotFoundError

    request = FinanceChangeRequest(
        entry_id=entry_id,
        action=FinanceChangeAction.UPDATE,
        status=FinanceChangeStatus.PENDING,
        payload=json.dumps(data.model_dump(mode="json", exclude_unset=True)),
        requested_by_id=requester.id,
    )
    db.add(request)
    db.commit()
    return _load_request(db, request.id)  # type: ignore[return-value]


def submit_delete_request(
    db: Session,
    entry_id: int,
    requester: Member,
) -> FinanceChangeRequest:
    if not _can_submit(requester):
        raise FinanceChangeForbiddenError

    from app.models.finance_entry import FinanceEntry

    if db.get(FinanceEntry, entry_id) is None:
        raise FinanceEntryNotFoundError

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
    return _load_request(db, request.id)  # type: ignore[return-value]


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
    db.commit()
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
    db.commit()
    return _load_request(db, request_id)  # type: ignore[return-value]
