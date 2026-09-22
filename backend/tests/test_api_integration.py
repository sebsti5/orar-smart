"""End-to-end API flow with the REAL solver + demo data (skipped if absent)."""

import io
import time

import pytest

import api_support  # noqa: F401  (sys.path)
from api_support import register

solver = pytest.importorskip("app.solver")
demo = pytest.importorskip("app.demo")
if not all(hasattr(solver, n) for n in ("analyze", "solve", "validate", "auto_assign")):
    pytest.skip("app.solver incomplete", allow_module_level=True)
if not hasattr(demo, "demo_setup"):
    pytest.skip("app.demo incomplete", allow_module_level=True)


@pytest.fixture
def real_client(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    from app import auth
    from app.main import app

    monkeypatch.setenv("ORAR_DB", str(tmp_path / "it.db"))
    monkeypatch.setenv("ORAR_SECRET", "integration-secret-0123456789abcdef")
    auth.reset_rate_limits()
    with TestClient(app) as c:
        yield c


def test_full_flow_with_real_solver(real_client):
    import openpyxl

    c = real_client
    register(c)
    r = c.post("/api/setup/demo")
    assert r.status_code == 200, r.text
    assert r.json()["analysis"]["can_generate"] is True
    r = c.post("/api/setup/auto-assign")
    assert r.status_code == 200, r.text
    tid = c.post("/api/timetables", json={"time_limit_s": 30}).json()["id"]
    deadline = time.time() + 120
    while time.time() < deadline:
        d = c.get(f"/api/timetables/{tid}").json()
        if d["status"] in ("done", "failed"):
            break
        time.sleep(0.5)
    assert d["status"] == "done", d["progress"]
    assert d["result"]["status"] in ("optimal", "feasible")
    lesson = d["result"]["lessons"][0]
    r = c.post(f"/api/timetables/{tid}/move",
               json={"lesson_id": lesson["id"], "day": lesson["day"], "slot": lesson["slot"]})
    assert r.status_code == 200, r.text
    x = c.get(f"/api/timetables/{tid}/export.xlsx")
    assert x.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(x.content))
    assert wb.sheetnames
