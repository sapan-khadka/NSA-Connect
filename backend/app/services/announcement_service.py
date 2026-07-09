from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.announcement import Announcement, AnnouncementCategory
from app.models.member import Member
from app.schemas.announcement import (
    AnnouncementCreateRequest,
    AnnouncementUpdateRequest,
)
from app.services.announcement_notification_service import notify_announcement_broadcast


class AnnouncementNotFoundError(Exception):
    pass


def _load_announcement(db: Session, announcement_id: int) -> Announcement | None:
    return db.scalar(
        select(Announcement)
        .where(Announcement.id == announcement_id)
        .options(joinedload(Announcement.author)),
    )


def list_announcements(db: Session) -> list[Announcement]:
    return list(
        db.scalars(
            select(Announcement)
            .options(joinedload(Announcement.author))
            .order_by(Announcement.created_at.desc()),
        ).all(),
    )


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
    now = datetime.now(UTC)
    announcement = Announcement(
        title=data.title.strip(),
        body=data.body.strip(),
        category=AnnouncementCategory(data.category),
        author_id=author.id,
        created_at=now,
        updated_at=now,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)

    announcement = get_announcement(db, announcement.id)
    notify_announcement_broadcast(db, announcement)
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
