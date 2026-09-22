from api_support import *  # noqa: F401,F403
from api_support import PASSWORD, register


def test_register_sets_cookie_and_me(client):
    body = register(client, "Admin@UTM.md", "Universitatea Tehnică")
    assert body == {"email": "admin@utm.md", "institution_name": "Universitatea Tehnică"}
    assert "session" in client.cookies
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "admin@utm.md"


def test_register_creates_default_setup_with_institution_name(client):
    register(client, inst="UTM FCIM")
    s = client.get("/api/setup").json()
    assert s["general"]["name"] == "UTM FCIM"
    assert s["groups"] == []
    assert len(s["general"]["slots"]) == 7


def test_register_duplicate_email(client):
    register(client)
    r = client.post("/api/auth/register",
                    json={"email": "admin@utm.md", "password": PASSWORD, "institution_name": "X"})
    assert r.status_code == 409
    assert isinstance(r.json()["detail"], str)


def test_register_rejects_short_password_and_bad_email(client):
    r = client.post("/api/auth/register",
                    json={"email": "a@b.md", "password": "short", "institution_name": "X"})
    assert r.status_code == 422
    r = client.post("/api/auth/register",
                    json={"email": "not-an-email", "password": PASSWORD, "institution_name": "X"})
    assert r.status_code == 422
    r = client.post("/api/auth/register",
                    json={"email": "a@b.md", "password": PASSWORD, "institution_name": "  "})
    assert r.status_code == 422


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.set("session", "garbage")
    assert client.get("/api/auth/me").status_code == 401


def test_logout_clears_cookie(client):
    register(client)
    r = client.post("/api/auth/logout")
    assert r.json() == {"ok": True}
    assert client.get("/api/auth/me").status_code == 401


def test_login_ok_and_bad_password(client, make_client):
    register(client)
    c2 = make_client()
    r = c2.post("/api/auth/login", json={"email": "admin@utm.md", "password": "wrong-password"})
    assert r.status_code == 401
    assert "detail" in r.json()
    r = c2.post("/api/auth/login", json={"email": "ADMIN@utm.md", "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["institution_name"] == "UTM"
    assert c2.get("/api/auth/me").status_code == 200


def test_login_unknown_email(client):
    r = client.post("/api/auth/login", json={"email": "nobody@x.md", "password": PASSWORD})
    assert r.status_code == 401


def test_login_rate_limit(client, make_client):
    register(client)
    c2 = make_client()
    for _ in range(10):
        r = c2.post("/api/auth/login", json={"email": "admin@utm.md", "password": "wrong-pass"})
        assert r.status_code == 401
    r = c2.post("/api/auth/login", json={"email": "admin@utm.md", "password": PASSWORD})
    assert r.status_code == 429
    # other emails are not affected
    r = c2.post("/api/auth/login", json={"email": "other@utm.md", "password": "wrong-pass"})
    assert r.status_code == 401


def test_rate_limit_window_expires(client, make_client, monkeypatch):
    from app import auth

    register(client)
    c2 = make_client()
    now = [1000.0]
    monkeypatch.setattr(auth, "_now", lambda: now[0])
    for _ in range(10):
        c2.post("/api/auth/login", json={"email": "admin@utm.md", "password": "wrong-pass"})
    assert c2.post("/api/auth/login",
                   json={"email": "admin@utm.md", "password": PASSWORD}).status_code == 429
    now[0] += 15 * 60 + 1
    assert c2.post("/api/auth/login",
                   json={"email": "admin@utm.md", "password": PASSWORD}).status_code == 200


def test_expired_token_rejected(client, monkeypatch):
    from app import auth

    register(client)
    token = auth.create_token(1, ttl_seconds=-10)
    client.cookies.set("session", token)
    assert client.get("/api/auth/me").status_code == 401


def test_secret_fallback_warns(monkeypatch, caplog):
    from app import auth

    monkeypatch.delenv("ORAR_SECRET", raising=False)
    auth._warned.clear()
    with caplog.at_level("WARNING"):
        s = auth.get_secret()
    assert s
    assert "ORAR_SECRET" in caplog.text
