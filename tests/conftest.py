"""
Shared pytest fixtures for Insta-Track test suite.
Uses an in-memory SQLite DB via StaticPool so all sessions share one connection.
Carrier services are mocked to avoid real API calls during CI.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool


@pytest.fixture(name="client")
def client_fixture(monkeypatch):
    """
    TestClient with fully isolated in-memory SQLite DB.

    Uses StaticPool so all sessions share a single connection object,
    which means all sessions see the same in-memory DB instance.
    This is the standard SQLModel/SQLAlchemy testing pattern.
    """
    # 1. Create in-memory engine with StaticPool (all connections share same DB)
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # 2. Import model to register with SQLModel.metadata
    from app.models.shipment import Shipment  # noqa: F401

    # 3. Create tables before TestClient starts
    SQLModel.metadata.create_all(test_engine)

    # 4. Override session dependency
    from app.db.session import get_session
    from app.main import app

    def override_get_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    # 5. Replace lifespan with a no-op so create_all isn't called on the real engine
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def noop_lifespan(_app):
        yield  # Tables already created above

    original_lifespan = app.router.lifespan_context
    app.router.lifespan_context = noop_lifespan

    # 6. Mock carrier APIs — no live HTTP calls in tests
    mock_track_result = {
        "status": "In Transit",
        "origin": "New York, NY",
        "destination": "Los Angeles, CA",
        "eta": "2026-03-10",
        "progress": 40,
        "history": [
            {
                "description": "Package picked up",
                "location": "New York, NY",
                "status": "Picked Up",
                "date": "2026-03-02T10:00:00",
            }
        ],
    }
    monkeypatch.setattr(
        "app.services.fedex.FedExService.track", lambda self, tn: mock_track_result
    )
    monkeypatch.setattr(
        "app.services.dhl.DHLService.track", lambda self, tn: mock_track_result
    )

    with TestClient(app) as c:
        yield c

    # Cleanup
    app.router.lifespan_context = original_lifespan
    app.dependency_overrides.clear()
    SQLModel.metadata.drop_all(test_engine)
    test_engine.dispose()
