from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.models.base import Base


class CustomBoardPosition(Base):
    """President-managed board seat outside the fixed officer enum."""

    __tablename__ = "custom_board_positions"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "name_normalized",
            name="uq_custom_board_positions_org_name_normalized",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        server_default="1",
        index=True,
    )
    name = Column(String(120), nullable=False)
    name_normalized = Column(String(120), nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
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
    archived_at = Column(DateTime(timezone=True), nullable=True)

    created_by = relationship("Member", foreign_keys=[created_by_id])
    holder = relationship(
        "Member",
        foreign_keys="Member.custom_board_position_id",
        uselist=False,
        back_populates="custom_board_position",
    )
