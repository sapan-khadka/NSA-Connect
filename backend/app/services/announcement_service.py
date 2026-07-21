from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.announcement import (
    Announcement,
    AnnouncementAudience,
    AnnouncementCategory,
)
from app.models.event import Event
from app.models.member import Member
from app.schemas.announcement import (
    AnnouncementCreateRequest,
    AnnouncementUpdateRequest,
)
from app.services.announcement_notification_service import notify_announcement_broadcast
from app.services.event_service import EventNotFoundError
from app.services.organization_context import get_default_organization_id


class AnnouncementNotFoundError(Exception):
    pass


class AnnouncementEventInvalidError(Exception):
    pass


def _load_announcement(db: Session, announcement_id: int) -> Announcement | None:
    return db.scalar(
        select(Announcement)
        .where(Announcement.id == announcement_id)
        .options(joinedload(Announcement.author)),
    )


def list_announcements(
    db: Session,
    *,
    event_id: int | None = None,
) -> list[Announcement]:
    query = (
        select(Announcement)
        .options(joinedload(Announcement.author))
        .where(Announcement.organization_id == get_default_organization_id(db))
        .order_by(Announcement.created_at.desc())
    )
    if event_id is not None:
        query = query.where(Announcement.event_id == event_id)
    return list(db.scalars(query).all())


def get_announcement(db: Session, announcement_id: int) -> Announcement:
    announcement = _load_announcement(db, announcement_id)
    if announcement is None:
        raise AnnouncementNotFoundError
    return announcement


def create_announcement(
    db: Session,
    *,
    author: Member,
    data: AnnouncementCreateRequest,
) -> Announcement:
    org_id = get_default_organization_id(db)
    event_id = data.event_id
    if event_id is not None:
        event = db.get(Event, event_id)
        if event is None or event.organization_id != org_id:
            raise AnnouncementEventInvalidError

    now = datetime.now(UTC)
    announcement = Announcement(
        title=data.title.strip(),
        body=data.body.strip(),
        category=AnnouncementCategory(data.category),
        audience=AnnouncementAudience(data.audience).value,
        event_id=event_id,
        author_id=author.id,
        created_at=now,
        updated_at=now,
        organization_id=org_id,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)

    announcement = get_announcement(db, announcement.id)
    notify_announcement_broadcast(db, announcement)

    from app.services.inbox_notification_service import notify_announcement_published

    notify_announcement_published(
        db,
        announcement_id=announcement.id,
        title=announcement.title,
        author=author,
        category_label=announcement.category.value.replace("_", " ").title(),
        announcement=announcement,
    )
    return announcement


def update_announcement(
    db: Session,
    *,
    announcement_id: int,
    data: AnnouncementUpdateRequest,
) -> Announcement:
    announcement = get_announcement(db, announcement_id)

    if data.title is not None:
        announcement.title = data.title.strip()
    if data.body is not None:
        announcement.body = data.body.strip()
    if data.category is not None:
        announcement.category = AnnouncementCategory(data.category)

    announcement.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(announcement)
    return get_announcement(db, announcement.id)


def delete_announcement(db: Session, *, announcement_id: int) -> None:
    announcement = get_announcement(db, announcement_id)
    db.delete(announcement)
    db.commit()
