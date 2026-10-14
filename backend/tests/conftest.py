"""Tests run against a throwaway SQLite database - no MySQL/Redis needed."""
import os
import shutil
import tempfile

_tmp = tempfile.mkdtemp(prefix="formbuilder_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["STORAGE_DIR"] = f"{_tmp}/storage"
os.environ["SECRET_KEY"] = "test-secret-key-with-enough-length-1234567890"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.init_db import seed  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402

API = "/api/v1"


@pytest.fixture(scope="session", autouse=True)
def _database():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield
    engine.dispose()
    shutil.rmtree(_tmp, ignore_errors=True)


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email, password):
    r = client.post(f"{API}/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin_headers(client):
    return login(client, "admin@formbuilder.com", "Admin@123")


@pytest.fixture(scope="session")
def user_headers(client):
    client.post(f"{API}/auth/register", json={"full_name": "Form Owner", "email": "owner@formbuilder.com", "password": "Password@123"})
    return login(client, "owner@formbuilder.com", "Password@123")


@pytest.fixture(scope="session")
def other_headers(client):
    client.post(f"{API}/auth/register", json={"full_name": "Other User", "email": "other@formbuilder.com", "password": "Password@123"})
    return login(client, "other@formbuilder.com", "Password@123")
