from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class InboxNotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    title: str
    body: str | None = None
    href: str | None = None
    read_at: datetime | None = None
    created_at: datetime
    unread: bool = False

    @classmethod
    def from_orm_notification(cls, notification) -> "InboxNotificationResponse":
        return cls(
            id=notification.id,
            type=notification.type,
            title=notification.title,
            body=notification.body,
            href=notification.href,
            read_at=notification.read_at,
            created_at=notification.created_at,
            unread=notification.read_at is None,
        )


class InboxNotificationListResponse(BaseModel):
    notifications: list[InboxNotificationResponse]
    total: int = Field(ge=0)
    unread_count: int = Field(ge=0)


class MarkInboxReadResponse(BaseModel):
    id: int
    read_at: datetime
    unread: bool = False


class MarkAllInboxReadResponse(BaseModel):
    marked_count: int = Field(ge=0)
    read_at: datetime
