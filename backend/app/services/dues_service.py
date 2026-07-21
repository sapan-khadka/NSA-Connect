from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.lib.semester import InvalidSemesterError, semester_date_range
from app.models.finance_entry import FinanceCategory, FinanceEntry, FinanceEntryType
from app.models.member import Member, MemberStatus
from app.models.member_dues import (
    DuesPaymentMethod,
    DuesStatus,
    MemberDues,
    SemesterDuesSettings,
)
from app.schemas.dues import (
    DuesDashboardResponse,
    DuesDashboardSummary,
    GenerateDuesResponse,
    MemberDuesHistoryItemResponse,
    MemberDuesHistoryResponse,
    MemberDuesResponse,
    MyDuesStatusResponse,
    SemesterDuesSettingsResponse,
)
from app.services.member_service import MemberNotFoundError, get_member_by_id
from app.services.organization_context import get_default_organization_id


class DuesNotFoundError(Exception):
    pass


class DuesSettingsNotFoundError(Exception):
    pass


class InvalidDuesOperationError(Exception):
    pass


_STATUS_SORT_ORDER = {
    DuesStatus.UNPAID: 0,
    DuesStatus.PARTIAL: 1,
    DuesStatus.PAID: 2,
    DuesStatus.EXEMPT: 3,
}


def _validate_semester(semester: str) -> None:
    try:
        semester_date_range(semester)
    except InvalidSemesterError as exc:
        raise InvalidDuesOperationError(str(exc)) from exc


def _to_response(record: MemberDues) -> MemberDuesResponse:
    return MemberDuesResponse(
        id=record.id,
        member_id=record.member_id,
        member_name=record.member.full_name,
        member_email=record.member.email,
        semester=record.semester,
        amount_owed=Decimal(record.amount_owed),
        amount_paid=Decimal(record.amount_paid),
        status=MemberDues.compute_status(record.amount_owed, record.amount_paid),
        paid_at=record.paid_at,
        payment_method=record.payment_method,
        note=record.note,
        finance_entry_id=record.finance_entry_id,
    )


def _sync_finance_entry(
    db: Session,
    record: MemberDues,
    *,
    actor: Member,
    paid_at: datetime | None = None,
) -> None:
    """Keep the finance ledger in sync with collected dues (avoids double-counting)."""
    amount_paid = Decimal(record.amount_paid)

    if amount_paid <= 0:
        if record.finance_entry_id is not None:
            entry = db.get(FinanceEntry, record.finance_entry_id)
            if entry is not None:
                db.delete(entry)
            record.finance_entry_id = None
        return

    description = f"Membership dues — {record.member.full_name} ({record.semester})"
    timestamp = paid_at or record.paid_at or datetime.now(UTC)

    if record.finance_entry_id is not None:
        entry = db.get(FinanceEntry, record.finance_entry_id)
        if entry is not None:
            entry.amount = amount_paid
            entry.description = description
            entry.created_at = timestamp
            return

    entry = FinanceEntry(
        entry_type=FinanceEntryType.INCOME,
        category=FinanceCategory.MEMBERSHIP_DUES.value,
        amount=amount_paid,
        description=description,
        created_by_id=actor.id,
        created_at=timestamp,
        organization_id=get_default_organization_id(db),
    )
    db.add(entry)
    db.flush()
    record.finance_entry_id = entry.id


def get_semester_settings(
    db: Session,
    semester: str,
) -> SemesterDuesSettings | None:
    _validate_semester(semester)
    return db.scalar(
        select(SemesterDuesSettings).where(
            SemesterDuesSettings.semester == semester,
            SemesterDuesSettings.organization_id == get_default_organization_id(db),
        ),
    )


def upsert_semester_settings(
    db: Session,
    *,
    semester: str,
    default_amount: Decimal,
    updated_by: Member,
) -> SemesterDuesSettingsResponse:
    _validate_semester(semester)

    settings = get_semester_settings(db, semester)
    if settings is None:
        settings = SemesterDuesSettings(
            semester=semester,
            default_amount=default_amount,
            updated_by_id=updated_by.id,
            organization_id=get_default_organization_id(db),
        )
        db.add(settings)
    else:
        settings.default_amount = default_amount
        settings.updated_by_id = updated_by.id

    db.commit()
    db.refresh(settings)
    return SemesterDuesSettingsResponse.model_validate(settings)


def generate_dues_records(
    db: Session,
    *,
    semester: str,
    actor: Member,
) -> GenerateDuesResponse:
    _validate_semester(semester)

    settings = get_semester_settings(db, semester)
    if settings is None:
        raise DuesSettingsNotFoundError

    default_amount = Decimal(settings.default_amount)
    approved_members = list(
        db.scalars(
            select(Member)
            .where(Member.status == MemberStatus.APPROVED)
            .order_by(Member.full_name.asc(), Member.id.asc()),
        ).all(),
    )

    org_id = get_default_organization_id(db)
    existing_member_ids = set(
        db.scalars(
            select(MemberDues.member_id).where(
                MemberDues.semester == semester,
                MemberDues.organization_id == org_id,
            ),
        ).all(),
    )

    created_count = 0
    skipped_count = 0

    for member in approved_members:
        if member.id in existing_member_ids:
            skipped_count += 1
            continue

        db.add(
            MemberDues(
                member_id=member.id,
                semester=semester,
                amount_owed=default_amount,
                amount_paid=Decimal("0"),
                organization_id=org_id,
            ),
        )
        created_count += 1

    db.commit()

    return GenerateDuesResponse(
        semester=semester,
        created_count=created_count,
        skipped_count=skipped_count,
        default_amount=default_amount,
    )


def get_dues_dashboard(
    db: Session,
    *,
    semester: str,
    status_filter: DuesStatus | None = None,
    search: str | None = None,
) -> DuesDashboardResponse:
    _validate_semester(semester)

    settings = get_semester_settings(db, semester)
    default_amount = Decimal(settings.default_amount) if settings else None

    query = (
        select(MemberDues)
        .options(joinedload(MemberDues.member))
        .where(
            MemberDues.semester == semester,
            MemberDues.organization_id == get_default_organization_id(db),
        )
    )

    if search:
        term = f"%{search.strip()}%"
        query = query.join(Member).where(
            or_(
                Member.full_name.ilike(term),
                Member.email.ilike(term),
            ),
        )

    records = list(db.scalars(query).unique().all())

    responses = [_to_response(record) for record in records]

    if status_filter is not None:
        responses = [
            response for response in responses if response.status == status_filter
        ]

    responses.sort(
        key=lambda item: (
            _STATUS_SORT_ORDER[item.status],
            item.member_name.lower(),
        ),
    )

    all_responses = [_to_response(record) for record in records]
    total_expected = sum(
        (
            response.amount_owed
            for response in all_responses
            if response.status != DuesStatus.EXEMPT
        ),
        Decimal("0"),
    )
    total_collected = sum(
        (response.amount_paid for response in all_responses), Decimal("0")
    )
    total_outstanding = sum(
        (
            max(response.amount_owed - response.amount_paid, Decimal("0"))
            for response in all_responses
            if response.status in {DuesStatus.UNPAID, DuesStatus.PARTIAL}
        ),
        Decimal("0"),
    )

    paid_count = sum(
        1 for response in all_responses if response.status == DuesStatus.PAID
    )
    unpaid_count = sum(
        1 for response in all_responses if response.status == DuesStatus.UNPAID
    )
    partial_count = sum(
        1 for response in all_responses if response.status == DuesStatus.PARTIAL
    )
    exempt_count = sum(
        1 for response in all_responses if response.status == DuesStatus.EXEMPT
    )

    summary = DuesDashboardSummary(
        semester=semester,
        default_amount=default_amount,
        total_expected=total_expected,
        total_collected=total_collected,
        total_outstanding=total_outstanding,
        paid_count=paid_count,
        unpaid_count=unpaid_count,
        partial_count=partial_count,
        exempt_count=exempt_count,
        member_count=len(all_responses),
    )

    return DuesDashboardResponse(summary=summary, records=responses)


def get_member_dues_record(db: Session, dues_id: int) -> MemberDues:
    record = db.scalar(
        select(MemberDues)
        .options(joinedload(MemberDues.member))
        .where(MemberDues.id == dues_id),
    )
    if record is None:
        raise DuesNotFoundError
    return record


def update_member_dues(
    db: Session,
    dues_id: int,
    *,
    actor: Member,
    amount_owed: Decimal | None = None,
    amount_paid: Decimal | None = None,
    payment_method: DuesPaymentMethod | None = None,
    note: str | None = None,
    paid_at: datetime | None = None,
) -> MemberDuesResponse:
    record = get_member_dues_record(db, dues_id)

    if amount_owed is not None:
        record.amount_owed = amount_owed
        if amount_owed <= 0:
            record.amount_paid = Decimal("0")
            record.paid_at = None
            record.payment_method = None

    if amount_paid is not None:
        record.amount_paid = amount_paid
        if amount_paid <= 0:
            record.paid_at = None
            record.payment_method = None
        elif record.paid_at is None:
            record.paid_at = paid_at or datetime.now(UTC)

    if payment_method is not None:
        record.payment_method = payment_method

    if note is not None:
        record.note = note

    if paid_at is not None and Decimal(record.amount_paid) > 0:
        record.paid_at = paid_at

    if (
        Decimal(record.amount_paid) > Decimal(record.amount_owed)
        and Decimal(record.amount_owed) > 0
    ):
        raise InvalidDuesOperationError("Amount paid cannot exceed amount owed.")

    status = MemberDues.compute_status(record.amount_owed, record.amount_paid)
    if (
        status in {DuesStatus.PAID, DuesStatus.PARTIAL}
        and record.payment_method is None
    ):
        raise InvalidDuesOperationError(
            "Payment method is required when recording a payment."
        )

    _sync_finance_entry(db, record, actor=actor, paid_at=paid_at)
    db.commit()
    db.refresh(record)
    return _to_response(record)


def mark_dues_paid(
    db: Session,
    dues_id: int,
    *,
    actor: Member,
    payment_method: DuesPaymentMethod,
    paid_at: datetime | None = None,
    amount_paid: Decimal | None = None,
    note: str | None = None,
) -> MemberDuesResponse:
    record = get_member_dues_record(db, dues_id)
    owed = Decimal(record.amount_owed)

    if owed <= 0:
        raise InvalidDuesOperationError(
            "This member is exempt from dues for this semester."
        )

    target_paid = amount_paid if amount_paid is not None else owed
    if target_paid <= 0:
        raise InvalidDuesOperationError("Payment amount must be greater than zero.")
    if target_paid > owed:
        raise InvalidDuesOperationError("Amount paid cannot exceed amount owed.")

    record.amount_paid = target_paid
    record.payment_method = payment_method
    record.paid_at = paid_at or datetime.now(UTC)
    if note is not None:
        record.note = note

    _sync_finance_entry(db, record, actor=actor, paid_at=record.paid_at)
    db.commit()
    db.refresh(record)
    return _to_response(record)


def mark_dues_unpaid(
    db: Session,
    dues_id: int,
    *,
    actor: Member,
) -> MemberDuesResponse:
    record = get_member_dues_record(db, dues_id)
    record.amount_paid = Decimal("0")
    record.paid_at = None
    record.payment_method = None

    _sync_finance_entry(db, record, actor=actor)
    db.commit()
    db.refresh(record)
    return _to_response(record)


def get_my_dues_status(
    db: Session,
    *,
    member_id: int,
    semester: str,
) -> MyDuesStatusResponse:
    _validate_semester(semester)

    record = db.scalar(
        select(MemberDues).where(
            MemberDues.member_id == member_id,
            MemberDues.semester == semester,
        ),
    )

    if record is None:
        return MyDuesStatusResponse(
            semester=semester,
            amount_owed=None,
            amount_paid=None,
            status=None,
            has_record=False,
            paid_at=None,
        )

    return MyDuesStatusResponse(
        semester=semester,
        amount_owed=Decimal(record.amount_owed),
        amount_paid=Decimal(record.amount_paid),
        status=MemberDues.compute_status(record.amount_owed, record.amount_paid),
        has_record=True,
        paid_at=record.paid_at,
    )


def get_member_dues_history(
    db: Session,
    *,
    member_id: int,
) -> MemberDuesHistoryResponse:
    """All semester dues rows for one member (oldest semester first)."""
    try:
        get_member_by_id(db, member_id)
    except MemberNotFoundError:
        raise

    rows = db.scalars(
        select(MemberDues)
        .where(
            MemberDues.member_id == member_id,
            MemberDues.organization_id == get_default_organization_id(db),
        )
        .order_by(MemberDues.semester.asc(), MemberDues.id.asc()),
    ).all()

    records = [
        MemberDuesHistoryItemResponse(
            id=row.id,
            member_id=row.member_id,
            semester=row.semester,
            amount_owed=Decimal(row.amount_owed),
            amount_paid=Decimal(row.amount_paid),
            status=MemberDues.compute_status(row.amount_owed, row.amount_paid),
            paid_at=row.paid_at,
        )
        for row in rows
    ]
    return MemberDuesHistoryResponse(
        member_id=member_id,
        records=records,
        total=len(records),
    )
