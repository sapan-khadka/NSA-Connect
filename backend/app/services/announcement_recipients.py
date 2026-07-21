"""Resolve announcement email/inbox recipients by audience + organization."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.announcement import Announcement, AnnouncementAudience
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.models.member import Member, MemberStatus
from app.models.organization_membership import (
    OrganizationMembership,
    OrganizationMembershipStatus,
)
from app.services.organization_context import get_default_organization_id


def list_recipients_for_audience(
    db: Session,
    *,
    audience: str,
    event_id: int | None,
    organization_id: int | None = None,
) -> list[Member]:
    org_id = organization_id or get_default_organization_id(db)
    membership_user_ids = select(OrganizationMembership.user_id).where(
        OrganizationMembership.organization_id == org_id,
        OrganizationMembership.status == OrganizationMembershipStatus.APPROVED,
    )

    base = select(Member).where(
        Member.status == MemberStatus.APPROVED,
        Member.id.in_(membership_user_ids),
    )

    resolved_audience = audience or AnnouncementAudience.ALL_APPROVED.value

    if resolved_audience == AnnouncementAudience.ALL_APPROVED.value or event_id is None:
        return list(db.scalars(base).all())

    if resolved_audience == AnnouncementAudience.GOING.value:
        return list(
            db.scalars(
                base.join(EventRsvp, EventRsvp.member_id == Member.id).where(
                    EventRsvp.event_id == event_id,
                    EventRsvp.status == RsvpStatus.GOING,
                ),
            ).all(),
        )

    if resolved_audience == AnnouncementAudience.MAYBE.value:
        return list(
            db.scalars(
                base.join(EventRsvp, EventRsvp.member_id == Member.id).where(
                    EventRsvp.event_id == event_id,
                    EventRsvp.status == RsvpStatus.MAYBE,
                ),
            ).all(),
        )

    if resolved_audience == AnnouncementAudience.NO_RSVP.value:
        rsvped_ids = select(EventRsvp.member_id).where(EventRsvp.event_id == event_id)
        return list(
            db.scalars(base.where(Member.id.not_in(rsvped_ids))).all(),
        )

    return list(db.scalars(base).all())


def list_announcement_recipients(
    db: Session,
    announcement: Announcement,
) -> list[Member]:
    return list_recipients_for_audience(
        db,
        audience=announcement.audience or AnnouncementAudience.ALL_APPROVED.value,
        event_id=announcement.event_id,
        organization_id=announcement.organization_id,
    )


def count_emailable_recipients(
    db: Session,
    *,
    audience: str,
    event_id: int | None,
    organization_id: int | None = None,
) -> dict[str, int]:
    members = list_recipients_for_audience(
        db,
        audience=audience,
        event_id=event_id,
        organization_id=organization_id,
    )
    emailable = [member for member in members if member.notify_announcements]
    return {
        "total": len(members),
        "emailable": len(emailable),
    }
