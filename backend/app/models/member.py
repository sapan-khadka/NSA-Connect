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


class MemberStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


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
 