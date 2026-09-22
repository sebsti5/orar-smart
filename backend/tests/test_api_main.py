from fastapi.testclient import TestClient

from api_support import *  # noqa: F401,F403


def test_spa_fallback(app_env, tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>orar</html>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    from app import main

    app = main.create_app(frontend_dist=dist)
    with TestClient(app) as c:
        assert "orar" in c.get("/").text
        assert "orar" in c.get("/app/timetables/3").text
        assert c.get("/assets/app.js").text == "console.log(1)"
        assert "orar" in c.get("/../../etc/passwd").text
        r = c.get("/api/does-not-exist")
        assert r.status_code == 404
        assert r.json()["detail"]


def test_no_dist(app_env, tmp_path):
    from app import main

    app = main.create_app(frontend_dist=tmp_path / "missing")
    with TestClient(app) as c:
        assert c.get("/").status_code == 404
        assert c.get("/api/health").json() == {"ok": True}


def test_cors(client):
    r = client.options("/api/auth/me", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert r.headers["access-control-allow-credentials"] == "true"
