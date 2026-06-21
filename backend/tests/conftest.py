from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import engine, get_db
from app.main import app
from app.models.base import Base


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
