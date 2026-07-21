from enum import StrEnum

from sqlalchemy import JSON, Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import relationship

from app.models.base import Base


class MemberRole(StrEnum):
    PRESIDENT = "president"
    TREASURER = "treasurer"
    BOARD = "board"
    GENERAL = "general"

    @property
    def level(self) -> int:
        return _ROLE_LEVELS[self]

    def is_at_least(self, required: "MemberRole") -> bool:
        return self.level >= required.level


class MemberStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ProfileFieldVisibility(StrEnum):
    PUBLIC = "public"
    BOARD_ONLY = "board_only"


class MemberPosition(StrEnum):
    PRESIDENT = "president"
    VICE_PRESIDENT = "vice_president"
    SECRETARY = "secretary"
    TREASURER = "treasurer"
    EVENT_MANAGER = "event_manager"
    PUBLIC_RELATIONS_OFFICER = "public_relations_officer"
    NEW_STUDENT_REPRESENTATIVE = "new_student_representative"
    MEMBER = "member"


class PlatformRole(StrEnum):
    """Cross-tenant role, orthogonal to the org-scoped `MemberRole`/`MemberPosition`.

    Most users are STUDENT; platform/university staff roles are for Phase 2+
    admin tooling that spans universities or organizations.
    """

    SUPER_ADMIN = "super_admin"
    UNIVERSITY_ADMIN = "university_admin"
    UNIVERSITY_STAFF = "university_staff"
    STUDENT = "student"


EXCLUSIVE_MEMBER_POSITIONS = frozenset(
    position for position in MemberPosition if position != MemberPosition.MEMBER
)

POSITION_AUTH_ROLES: dict[MemberPosition, MemberRole] = {
    MemberPosition.PRESIDENT: MemberRole.PRESIDENT,
    MemberPosition.TREASURER: MemberRole.TREASURER,
}

EXCLUSIVE_AUTH_ROLES = frozenset(POSITION_AUTH_ROLES.values())


_ROLE_LEVELS: dict[MemberRole, int] = {
    MemberRole.GENERAL: 1,
    MemberRole.BOARD: 2,
    MemberRole.TREASURER: 3,
    MemberRole.PRESIDENT: 4,
}


class Member(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    university_id = Column(
        Integer,
        ForeignKey("universities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    platform_role = Column(
        SqlEnum(
            PlatformRole,
            values_callable=lambda roles: [r.value for r in roles],
            native_enum=False,
            length=32,
        ),
        default=PlatformRole.STUDENT,
        server_default=PlatformRole.STUDENT.value,
        nullable=False,
    )
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    student_id = Column(String(20), unique=True, nullable=False)
    major = Column(String(255), nullable=False)
    graduation_year = Column(Integer, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(
        SqlEnum(MemberRole, values_callable=lambda roles: [r.value for r in roles]),
        default=MemberRole.GENERAL,
        nullable=False,
    )
    status = Column(
        SqlEnum(
            MemberStatus,
            values_callable=lambda statuses: [s.value for s in statuses],
        ),
        default=MemberStatus.PENDING,
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
    interests = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    talents = Column(JSON, nullable=False, default=list, server_default="[]")
    talent_other = Column(String(255), nullable=True)
    phone = Column(String(32), nullable=True)
    social_handle = Column(String(255), nullable=True)
    email_visibility = Column(
        SqlEnum(
            ProfileFieldVisibility,
            values_callable=lambda values: [value.value for value in values],
        ),
        default=ProfileFieldVisibility.PUBLIC,
        server_default=ProfileFieldVisibility.PUBLIC.value,
        nullable=False,
    )
    phone_visibility = Column(
        SqlEnum(
            ProfileFieldVisibility,
            values_callable=lambda values: [value.value for value in values],
        ),
        default=ProfileFieldVisibility.BOARD_ONLY,
        server_default=ProfileFieldVisibility.BOARD_ONLY.value,
        nullable=False,
    )
    social_handle_visibility = Column(
        SqlEnum(
            ProfileFieldVisibility,
            values_callable=lambda values: [value.value for value in values],
        ),
        default=ProfileFieldVisibility.BOARD_ONLY,
        server_default=ProfileFieldVisibility.BOARD_ONLY.value,
        nullable=False,
    )
    notify_event_reminders = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    notify_rsvp_nudges = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    notify_task_reminders = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    notify_dues_reminders = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    notify_announcements = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    token_version = Column(Integer, nullable=False, default=1, server_default="1")
    custom_board_position_id = Column(
        Integer,
        ForeignKey(
            "custom_board_positions.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_members_custom_board_position_id",
        ),
        nullable=True,
        unique=True,
        index=True,
    )

    password_reset_tokens = relationship(
        "PasswordResetToken",
        back_populates="member",
        cascade="all, delete-orphan",
    )
    custom_board_position = relationship(
        "CustomBoardPosition",
        foreign_keys=[custom_board_position_id],
        back_populates="holder",
        uselist=False,
    )
    university = relationship("University", foreign_keys=[university_id])
    memberships = relationship(
        "OrganizationMembership",
        back_populates="user",
        foreign_keys="OrganizationMembership.user_id",
        cascade="all, delete-orphan",
    )

    @property
    def is_approved(self) -> bool:
        return self.status == MemberStatus.APPROVED

    @property
    def is_pending(self) -> bool:
        return self.status == MemberStatus.PENDING

    def has_role_at_least(self, required_role: MemberRole) -> bool:
        return self.role.is_at_least(required_role)

    def can_authenticate(self) -> bool:
        return self.is_approved


# Phase 1: `members` was renamed to `users` and the ORM class is being evolved
# in place. `User` is the forward-looking name for this same mapped class;
# new code should prefer importing `User` over `Member`.
User = Member
