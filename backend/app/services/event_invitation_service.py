from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.event import Event
from app.models.event_participant_invitation import EventParticipantInvitation
from app.models.member import Member, MemberStatus
from app.services.event_service import EventNotFoundError
from app.services.member_service import MemberNotFoundError


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
    purpose: str = "participants",
) -> list[EventParticipantInvitation]:
    event = get_event_or_raise(db, event_id)
    now = datetime.now(UTC)
    created: list[EventParticipantInvitation] = []
    notified_member_ids: list[int] = []

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
            if purpose == "volunteers":
                notified_member_ids.append(member_id)
            continue

        invitation = EventParticipantInvitation(
            event_id=event_id,
            member_id=member_id,
            invited_by_id=invited_by_id,
            created_at=now,
        )
        db.add(invitation)
        created.append(invitation)
        notified_member_ids.append(member_id)

    db.commit()

    for invitation in created:
        db.refresh(invitation)

    if purpose == "volunteers" and notified_member_ids:
        from app.services.inbox_notification_service import (
            notify_members_of_volunteer_invite,
        )

        inviter = db.get(Member, invited_by_id)
        if inviter is not None:
            notify_members_of_volunteer_invite(
                db,
                event=event,
                member_ids=notified_member_ids,
                inviter=inviter,
            )

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
