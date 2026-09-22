from api_support import *  # noqa: F401,F403
from api_support import register, put_sample_setup, sample_setup


def test_setup_requires_auth(client):
    assert client.get("/api/setup").status_code == 401
    assert client.put("/api/setup", json={}).status_code == 401
    assert client.get("/api/analysis").status_code == 401
    assert client.post("/api/setup/demo").status_code == 401
    assert client.post("/api/setup/auto-assign").status_code == 401


def test_setup_roundtrip(client):
    register(client)
    body = put_sample_setup(client)
    assert body["analysis"]["total_sessions"] == 3
    assert body["setup"]["groups"][0]["name"] == "TI-241"
    got = client.get("/api/setup").json()
    assert got == sample_setup().model_dump()


def test_put_setup_validation_error(client):
    register(client)
    bad = sample_setup().model_dump()
    bad["groups"][0]["students"] = 0
    r = client.put("/api/setup", json=bad)
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], list)
    bad = sample_setup().model_dump()
    bad["general"]["min_lessons_per_day"] = 9
    bad["general"]["max_lessons_per_day"] = 3
    assert client.put("/api/setup", json=bad).status_code == 422
    # nothing saved
    assert client.get("/api/setup").json()["groups"] == []


def test_analysis_endpoint(client):
    register(client)
    a = client.get("/api/analysis").json()
    assert a["issues"][0]["code"] == "no_groups"
    put_sample_setup(client)
    a = client.get("/api/analysis").json()
    assert a["issues"] == []


def test_demo_replaces_setup(client):
    register(client)
    r = client.post("/api/setup/demo")
    assert r.status_code == 200
    assert r.json()["setup"]["general"]["name"] == "Universitatea Demo"
    assert client.get("/api/setup").json()["general"]["name"] == "Universitatea Demo"


def test_auto_assign_does_not_save(client):
    register(client)
    put_sample_setup(client)
    r = client.post("/api/setup/auto-assign")
    assert r.status_code == 200
    ids = [a["id"] for a in r.json()["assignments"]]
    assert "a_auto" in ids
    assert "analysis" in r.json()
    saved = [a["id"] for a in client.get("/api/setup").json()["assignments"]]
    assert "a_auto" not in saved


def test_solver_errors_become_503(client, monkeypatch):
    from app.api import setup as setup_api

    def boom(_):
        raise ImportError("no solver")

    register(client)
    monkeypatch.setattr(setup_api, "analyze", boom)
    r = client.get("/api/analysis")
    assert r.status_code == 503
    assert isinstance(r.json()["detail"], str)


def test_isolation_between_institutions(client, make_client):
    register(client, "a@utm.md", "UTM")
    put_sample_setup(client)
    tid = client.post("/api/timetables", json={}).json()["id"]

    other = make_client()
    register(other, "b@usm.md", "USM")
    s = other.get("/api/setup").json()
    assert s["groups"] == []
    assert s["general"]["name"] == "USM"
    assert other.get("/api/timetables").json() == []
    assert other.get(f"/api/timetables/{tid}").status_code == 404
    assert other.delete(f"/api/timetables/{tid}").status_code == 404
    assert other.post(f"/api/timetables/{tid}/publish", json={"published": True}).status_code == 404
    assert other.post(f"/api/timetables/{tid}/move",
                      json={"lesson_id": "x", "day": 0, "slot": 0}).status_code == 404
    assert other.get(f"/api/timetables/{tid}/export.xlsx").status_code == 404
    assert other.get("/api/share-token").json()["token"] != client.get("/api/share-token").json()["token"]
    # the first institution still sees its own data
    assert len(client.get("/api/setup").json()["groups"]) == 3
