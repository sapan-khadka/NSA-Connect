from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.member import Member, MemberRole, MemberStatus
from app.schemas.member import MemberCreateRequest


class MemberAlreadyExistsError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class MemberNotApprovedError(Exception):
    pass


def create_member(db: Session, data: MemberCreateRequest) -> Member:
    existing = db.scalar(select(Member).where(Member.email == data.email))
    if existing:
        raise MemberAlreadyExistsError

    member = Member(
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=MemberRole.GENERAL,
        status=MemberStatus.PENDING,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def authenticate_member(db: Session, email: str, password: str) -> Member:
    member = db.scalar(select(Member).where(Member.email == email))

    if member is None or not verify_password(password, member.hashed_password):
        raise InvalidCredentialsError

    if not member.can_authenticate():
        raise MemberNotApprovedError

    return member
