from enum import Enum

from sqlalchemy import Column
from sqlalchemy import Enum as SqlEnum
from sqlalchemy import Integer
from sqlalchemy import String

from app.models.base import Base


class MemberRole(str, Enum):
    PRESIDENT = "president"
    TREASURER = "treasurer"
    BOARD = "board"
    GENERAL = "general"

    @property
    def level(self) -> int:
        return _ROLE_LEVELS[self]

    def is_at_least(self, required: "MemberRole") -> bool:
        return self.level >= required.level


class MemberStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


_ROLE_LEVELS: dict[MemberRole, int] = {
    MemberRole.GENERAL: 1,
    MemberRole.BOARD: 2,
    MemberRole.TREASURER: 3,
    MemberRole.PRESIDENT: 4,
}


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(
        SqlEnum(MemberRole, values_callable=lambda roles: [r.value for r in roles]),
        default=MemberRole.GENERAL,
        nullable=False,
    )
    status = Column(
        SqlEnum(MemberStatus, values_callable=lambda statuses: [s.value for s in statuses]),
        default=MemberStatus.PENDING,
        nullable=False,
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
