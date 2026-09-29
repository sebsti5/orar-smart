import base64

from fastapi.testclient import TestClient

from api_support import *  # noqa: F401,F403


def _basic(user: str, password: str) -> dict:
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def _gated_client(monkeypatch, tmp_path):
    monkeypatch.setenv("ORAR_SITE_PASSWORD", "secret-2026")
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>orar</html>")
    from app import main

    return TestClient(main.create_app(frontend_dist=dist))


def test_gate_off_without_env(client):
    assert client.get("/api/health").status_code == 200


def test_gate_blocks_without_credentials(app_env, monkeypatch, tmp_path):
    with _gated_client(monkeypatch, tmp_path) as c:
        r = c.get("/")
        assert r.status_code == 401
        assert r.headers["www-authenticate"].startswith("Basic")
        assert c.get("/api/auth/me").status_code == 401


def test_gate_rejects_wrong_password(app_env, monkeypatch, tmp_path):
    with _gated_client(monkeypatch, tmp_path) as c:
        assert c.get("/", headers=_basic("x", "nope")).status_code == 401
        assert c.get("/", headers={"Authorization": "Basic !!!"}).status_code == 401
        assert c.get("/", headers={"Authorization": "Bearer x"}).status_code == 401


def test_gate_accepts_any_user_with_right_password(app_env, monkeypatch, tmp_path):
    with _gated_client(monkeypatch, tmp_path) as c:
        r = c.get("/", headers=_basic("utm", "secret-2026"))
        assert r.status_code == 200
        assert "orar" in r.text


def test_health_stays_open_for_monitoring(app_env, monkeypatch, tmp_path):
    with _gated_client(monkeypatch, tmp_path) as c:
        assert c.get("/api/health").json() == {"ok": True}


def test_solver_workers_from_env(monkeypatch):
    from app.solver import model_time

    monkeypatch.setenv("ORAR_SOLVER_WORKERS", "2")
    assert model_time.solver_workers() == 2
    monkeypatch.setenv("ORAR_SOLVER_WORKERS", "garbage")
    assert model_time.solver_workers() == model_time.NUM_WORKERS
    monkeypatch.delenv("ORAR_SOLVER_WORKERS")
    assert model_time.solver_workers() == model_time.NUM_WORKERS
