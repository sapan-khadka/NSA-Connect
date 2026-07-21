from datetime import UTC, datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.models.member import MemberPosition, MemberRole, MemberStatus

# Reuse the existing Member* enums for org-scoped role/status/position so that
# membership rows stay compatible with the single-tenant `Member` fields they
# were derived from during the Phase 1 backfill.
OrganizationRole = MemberRole
OrganizationMembershipStatus = MemberStatus
OrganizationPosition = MemberPosition


class OrganizationMembership(Base):
    """A user's membership (role/status/position) within one organization."""

    __tablename__ = "organization_memberships"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "organization_id",
            name="uq_organization_memberships_user_org",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Deliberately mirrors `Member.role` / `.status` / `.position` column
    # definitions (same enum classes, no explicit `name=`/`native_enum=False`)
    # so SQLAlchemy resolves to the *same* existing Postgres enum types
    # (`memberrole`, `memberstatus`, `memberposition`) rather than minting new
    # ones — the migration creates these columns with `create_type=False`.
    role = Column(
        SqlEnum(
            MemberRole,
            values_callable=lambda roles: [role.value for role in roles],
        ),
        default=MemberRole.GENERAL,
        server_default=MemberRole.GENERAL.value,
        nullable=False,
    )
    status = Column(
        SqlEnum(
            MemberStatus,
            values_callable=lambda statuses: [status.value for status in statuses],
        ),
        default=MemberStatus.PENDING,
        server_default=MemberStatus.PENDING.value,
        nullable=False,
    )
    position = Column(
        SqlEnum(
            MemberPosition,
            values_callable=lambda positions: [p.value for p in positions],
        ),
        default=MemberPosition.MEMBER,
        server_default=MemberPosition.MEMBER.value,
        nullable=False,
    )
    custom_board_position_id = Column(
        Integer,
        ForeignKey("custom_board_positions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    user = relationship(
        "Member",
        back_populates="memberships",
        foreign_keys=[user_id],
    )
    organization = relationship("Organization", back_populates="memberships")
    custom_board_position = relationship(
        "CustomBoardPosition",
        foreign_keys=[custom_board_position_id],
    )
