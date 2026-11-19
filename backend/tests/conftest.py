import re

import mongomock
import pytest
from fastapi.testclient import TestClient
from mongomock.gridfs import enable_gridfs_integration

from app.config import Settings
from app.main import create_app

enable_gridfs_integration()

ADMIN_EMAIL = "admin@example.com"
PASSWORD = "correct-horse-battery"


@pytest.fixture
def db():
    return mongomock.MongoClient().fluentday_test


@pytest.fixture
def settings():
    return Settings(_env_file=None, environment="test", jwt_secret="t" * 40, admin_emails=ADMIN_EMAIL)


@pytest.fixture
def client(db, settings):
    with TestClient(create_app(settings=settings, db=db)) as c:
        yield c


def last_token(db, email: str) -> str:
    mail = db.email_outbox.find_one({"to": email}, sort=[("created_at", -1), ("_id", -1)])
    return re.search(r"token=([\w-]+)", mail["body"]).group(1)


def sign_up(client, db, email: str, name: str = "Test Learner") -> None:
    """Registers and leaves the client logged in as that account."""
    r = client.post("/api/auth/register", json={"email": email, "password": PASSWORD, "full_name": name})
    assert r.status_code == 201, r.text


@pytest.fixture
def admin_client(client, db):
    sign_up(client, db, ADMIN_EMAIL, "Admin")
    return client
