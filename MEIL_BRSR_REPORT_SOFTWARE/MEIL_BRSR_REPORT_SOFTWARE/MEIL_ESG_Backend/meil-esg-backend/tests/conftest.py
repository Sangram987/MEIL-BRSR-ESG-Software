import pytest
from app import create_app
from app.extensions import db as _db


@pytest.fixture()
def app():
    application = create_app("testing")
    with application.app_context():
        _db.create_all()
        from seeds import seed_brsr, seed_org, seed_demo
        seed_brsr.run()
        seed_org.run()
        seed_org.seed_reporting_periods()
        seed_demo.run()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def admin_token(client):
    resp = client.post("/api/v1/auth/login", json={"email": "r.kumar@meil.in", "password": "Password123"})
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()["accessToken"]


@pytest.fixture()
def operator_token(client):
    resp = client.post("/api/v1/auth/login", json={"email": "s.naik@meil.in", "password": "Password123"})
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()["accessToken"]


@pytest.fixture()
def manager_token(client):
    resp = client.post("/api/v1/auth/login", json={"email": "v.singh@meil.in", "password": "Password123"})
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()["accessToken"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}
