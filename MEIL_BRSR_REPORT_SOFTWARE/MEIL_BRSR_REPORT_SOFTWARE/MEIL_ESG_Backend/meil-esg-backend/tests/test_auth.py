from tests.conftest import auth_header


def test_login_success(client):
    resp = client.post("/api/v1/auth/login", json={"email": "r.kumar@meil.in", "password": "Password123"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert "accessToken" in body
    assert body["user"]["email"] == "r.kumar@meil.in"
    assert "GROUP_ADMIN" in body["user"]["roles"]


def test_login_wrong_password(client):
    resp = client.post("/api/v1/auth/login", json={"email": "r.kumar@meil.in", "password": "wrong"})
    assert resp.status_code == 401
    assert resp.get_json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_me_requires_token(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_with_token(client, admin_token):
    resp = client.get("/api/v1/auth/me", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert resp.get_json()["email"] == "r.kumar@meil.in"


def test_register_new_user_gets_scoped_automatically(client):
    resp = client.post("/api/v1/auth/register", json={
        "email": "new.operator@meil.in", "password": "Password123",
        "firstName": "New", "lastName": "Operator", "role": "SITE_OPERATOR",
    })
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["user"]["roles"] == ["SITE_OPERATOR"]
    assert len(body["user"]["scopes"]) == 1
    assert body["user"]["scopes"][0]["type"] == "PROJECT"


def test_register_duplicate_email_rejected(client):
    client.post("/api/v1/auth/register", json={
        "email": "dupe@meil.in", "password": "Password123", "firstName": "A", "role": "SITE_OPERATOR",
    })
    resp = client.post("/api/v1/auth/register", json={
        "email": "dupe@meil.in", "password": "Password123", "firstName": "B", "role": "SITE_OPERATOR",
    })
    assert resp.status_code == 409
    assert resp.get_json()["error"]["code"] == "EMAIL_TAKEN"
