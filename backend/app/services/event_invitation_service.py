from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.event import Event
from app.models.event_participant_invitation import EventParticipantInvitation
from app.models.member import Member, MemberStatus
from app.services.event_service import EventNotFoundError
from app.services.member_service import MemberNotFoundError, get_member_by_id


class InvitationAlreadyExistsError(Exception):
    pass


def is_member_invited_to_event(db: Session, event_id: int, member_id: int) -> bool:
    invitation = db.scalar(
        select(EventParticipantInvitation).where(
            EventParticipantInvitation.event_id == event_id,
            EventParticipantInvitation.member_id == member_id,
        ),
    )
    return invitation is not None


def list_event_participant_invitations(
    db: Session,
    event_id: int,
) -> list[EventParticipantInvitation]:
    get_event_or_raise(db, event_id)
    return list(
        db.scalars(
            select(EventParticipantInvitation)
            .options(
                joinedload(EventParticipantInvitation.member),
                joinedload(EventParticipantInvitation.invited_by),
            )
            .where(EventParticipantInvitation.event_id == event_id)
            .order_by(EventParticipantInvitation.created_at.asc()),
        ).all(),
    )


def invite_members_to_event(
    db: Session,
    *,
    event_id: int,
    member_ids: list[int],
    invited_by_id: int,
) -> list[EventParticipantInvitation]:
    get_event_or_raise(db, event_id)
    now = datetime.now(UTC)
    created: list[EventParticipantInvitation] = []

    for member_id in member_ids:
        member = db.get(Member, member_id)
        if member is None or member.status != MemberStatus.APPROVED:
            raise MemberNotFoundError

        existing = db.scalar(
            select(EventParticipantInvitation).where(
                EventParticipantInvitation.event_id == event_id,
                EventParticipantInvitation.member_id == member_id,
            ),
        )
        if existing is not None:
            continue

        invitation = EventParticipantInvitation(
            event_id=event_id,
            member_id=member_id,
            invited_by_id=invited_by_id,
            created_at=now,
        )
        db.add(invitation)
        created.append(invitation)

    db.commit()

    for invitation in created:
        db.refresh(invitation)

    return list_event_participant_invitations(db, event_id)


def remove_event_participant_invitation(
    db: Session,
    *,
    event_id: int,
    member_id: int,
) -> None:
    invitation = db.scalar(
        select(EventParticipantInvitation).where(
            EventParticipantInvitation.event_id == event_id,
            EventParticipantInvitation.member_id == member_id,
        ),
    )
    if invitation is None:
        raise MemberNotFoundError
    db.delete(invitation)
    db.commit()


def get_event_or_raise(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise EventNotFoundError
    return event
