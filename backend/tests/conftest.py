from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import engine, get_db
from app.main import app
from app.models.base import Base
from app.models.member import Member, MemberStatus

VALID_PASSWORD = "securepass123"
VALID_EMAIL = "sapan@semo.edu"
VALID_STUDENT_ID = "12345678"
VALID_MAJOR = "Computer Science"
VALID_GRADUATION_YEAR = 2028
BAD_DOMAIN_EMAIL = "sapan@gmail.com"


@pytest.fixture(autouse=True)
def block_external_integrations():
    """Never hit Redis, Celery brokers, or SendGrid during tests."""
    sendgrid_response = MagicMock(status_code=202, body="accepted")

    with (
        patch("app.integrations.sendgrid_client.SendGridAPIClient") as sendgrid_client,
        patch("celery.app.task.Task.delay") as celery_delay,
        patch("celery.app.task.Task.apply_async") as celery_apply_async,
        patch("app.services.email_service.settings.EMAIL_ENABLED", False),
    ):
        sendgrid_client.return_value.send.return_value = sendgrid_response
        yield {
            "sendgrid_client": sendgrid_client,
            "celery_delay": celery_delay,
            "celery_apply_async": celery_apply_async,
        }


def register_payload(
    email=VALID_EMAIL,
    password=VALID_PASSWORD,
    student_id=VALID_STUDENT_ID,
):
    return {
        "full_name": "Sapan Khadka",
        "email": email,
        "password": password,
        "student_id": student_id,
        "major": VALID_MAJOR,
        "graduation_year": VALID_GRADUATION_YEAR,
    }


def register_member(
    client,
    email=VALID_EMAIL,
    password=VALID_PASSWORD,
    student_id=VALID_STUDENT_ID,
):
    return client.post(
        "/api/v1/auth/register",
        json=register_payload(
            email=email,
            password=password,
            student_id=student_id,
        ),
    )


def set_member_approved(db_session: Session, email=VALID_EMAIL):
    member = db_session.scalar(select(Member).where(Member.email == email))
    member.status = MemberStatus.APPROVED
    db_session.commit()


def create_board_member(
    db_session: Session,
    email="board@semo.edu",
    password=VALID_PASSWORD,
):
    from app.core.security import hash_password
    from app.models.member import MemberRole

    member = Member(
        full_name="Board Member",
        email=email,
        student_id="87654321",
        major="Administration",
        graduation_year=VALID_GRADUATION_YEAR,
        hashed_password=hash_password(password),
        role=MemberRole.BOARD,
        status=MemberStatus.APPROVED,
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def create_president_member(
    db_session: Session,
    email="president@semo.edu",
    password=VALID_PASSWORD,
    student_id="99887766",
):
    from app.core.security import hash_password
    from app.models.member import MemberRole

    member = Member(
        full_name="President",
        email=email,
        student_id=student_id,
        major="Administration",
        graduation_year=VALID_GRADUATION_YEAR,
        hashed_password=hash_password(password),
        role=MemberRole.PRESIDENT,
        status=MemberStatus.APPROVED,
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def create_treasurer_member(
    db_session: Session,
    email="treasurer@semo.edu",
    password=VALID_PASSWORD,
    student_id="55443322",
):
    from app.core.security import hash_password
    from app.models.member import MemberRole

    member = Member(
        full_name="Treasurer",
        email=email,
        student_id=student_id,
        major="Administration",
        graduation_year=VALID_GRADUATION_YEAR,
        hashed_password=hash_password(password),
        role=MemberRole.TREASURER,
        status=MemberStatus.APPROVED,
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def auth_header(client, email=VALID_EMAIL, password=VALID_PASSWORD):
    response = login_member(client, email=email, password=password)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def login_member(client, email=VALID_EMAIL, password=VALID_PASSWORD):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )


@pytest.fixture
def db_session() -> Session:
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    session = sessionmaker(bind=test_engine)()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


@pytest.fixture
def client(db_session: Session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    mock_connection = MagicMock()
    mock_connection.execute = MagicMock()

    with (
        patch.object(
            engine,
            "connect",
            return_value=MagicMock(
                __enter__=MagicMock(return_value=mock_connection),
                __exit__=MagicMock(return_value=False),
            ),
        ),
        patch.object(engine, "dispose"),
        TestClient(app) as test_client,
    ):
        yield test_client

    app.dependency_overrides.clear()
