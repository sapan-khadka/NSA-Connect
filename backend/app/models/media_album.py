from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.models.base import Base


class MediaAlbum(Base):
    __tablename__ = "media_albums"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    created_by_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    created_by = relationship("Member")
    items = relationship(
        "MediaAlbumItem",
        back_populates="album",
        cascade="all, delete-orphan",
        order_by="MediaAlbumItem.created_at",
    )


class MediaAlbumItem(Base):
    __tablename__ = "media_album_items"

    id = Column(Integer, primary_key=True, index=True)
    album_id = Column(
        Integer,
        ForeignKey("media_albums.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploaded_by_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    image_url = Column(String(2048), nullable=False)
    thumbnail_url = Column(String(2048), nullable=False)
    public_id = Column(String(512), nullable=False)
    media_kind = Column(String(16), nullable=False, server_default="photo")
    duration_seconds = Column(Integer, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    album = relationship("MediaAlbum", back_populates="items")
    uploaded_by = relationship("Member")
