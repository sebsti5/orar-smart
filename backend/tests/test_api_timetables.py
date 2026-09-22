import io
import threading
import time

import openpyxl

from api_support import *  # noqa: F401,F403
from api_support import create_done_timetable, put_sample_setup, register, wait_done


def test_timetables_require_auth(client):
    assert client.get("/api/timetables").status_code == 401
    assert client.post("/api/timetables", json={}).status_code == 401
    assert client.get("/api/share-token").status_code == 401


def test_create_poll_done(client):
    register(client)
    put_sample_setup(client)
    r = client.post("/api/timetables", json={"time_limit_s": 5})
    assert r.status_code == 200
    s = r.json()
    assert s["status"] in ("queued", "running", "done")
    assert s["name"].startswith("Orar ")
    assert s["published"] is False
    assert "phase" in s["progress"]
    d = wait_done(client, s["id"])
    assert d["status"] == "done"
    assert d["result"]["status"] == "optimal"
    assert len(d["result"]["lessons"]) == 3
    assert len(d["setup_snapshot"]["groups"]) == 3
    assert d["progress"]["phase"] == "done"
    lst = client.get("/api/timetables").json()
    assert [t["id"] for t in lst] == [s["id"]]
    assert "result" not in lst[0]


def test_create_named_and_time_limit_bounds(client):
    register(client)
    put_sample_setup(client)
    assert client.post("/api/timetables", json={"time_limit_s": 2}).status_code == 422
    assert client.post("/api/timetables", json={"time_limit_s": 500}).status_code == 422
    d = create_done_timetable(client, name="Semestrul 1")
    assert d["name"] == "Semestrul 1"


def test_group_filter(client):
    register(client)
    put_sample_setup(client)
    d = create_done_timetable(client, group_ids=["g3"])
    snap = d["setup_snapshot"]
    assert [a["id"] for a in snap["assignments"]] == ["a_sem3"]
    assert len(snap["groups"]) == 3  # other entities kept
    d = create_done_timetable(client, group_ids=["g2"])
    assert [a["id"] for a in d["setup_snapshot"]["assignments"]] == ["a_lec"]
    r = client.post("/api/timetables", json={"group_ids": ["nope"]})
    assert r.status_code == 422


def test_progress_is_stored_while_running(client, monkeypatch):
    from app import jobs
    from api_support import fake_solve

    gate = threading.Event()

    def slow_solve(setup, time_limit_s=30, progress_cb=None):
        progress_cb({"phase": "time", "message": "Caut", "best_penalty": 7})
        gate.wait(5)
        return fake_solve(setup, time_limit_s, None)

    monkeypatch.setattr(jobs, "solve", slow_solve)
    monkeypatch.setattr(jobs, "PROGRESS_MIN_INTERVAL_S", 0.0)
    register(client)
    put_sample_setup(client)
    tid = client.post("/api/timetables", json={}).json()["id"]
    deadline = time.time() + 5
    seen = None
    while time.time() < deadline:
        d = client.get(f"/api/timetables/{tid}").json()
        if d["progress"].get("best_penalty") == 7:
            seen = d
            break
        time.sleep(0.02)
    gate.set()
    assert seen is not None and seen["status"] == "running"
    assert wait_done(client, tid)["status"] == "done"


def test_progress_throttle():
    from app import jobs

    writes = []
    rec = jobs.ProgressRecorder(lambda p: writes.append(p), min_interval_s=10.0)
    for i in range(50):
        rec({"phase": "time", "message": f"m{i}", "best_penalty": i})
    assert len(writes) == 1
    rec.flush()
    assert writes[-1]["best_penalty"] == 49
    # positional / object forms are normalised
    assert jobs.normalize_progress("time", "msg", 3) == {"phase": "time", "message": "msg", "best_penalty": 3}

    class P:
        def model_dump(self):
            return {"phase": "x", "message": "y"}

    assert jobs.normalize_progress(P()) == {"phase": "x", "message": "y"}
    assert jobs.normalize_progress("just text") == {"phase": "running", "message": "just text"}


def test_solver_crash_marks_failed(client, monkeypatch):
    from app import jobs

    def crash(*a, **k):
        raise RuntimeError("kaboom")

    monkeypatch.setattr(jobs, "solve", crash)
    register(client)
    put_sample_setup(client)
    d = create_done_timetable(client)
    assert d["status"] == "failed"
    assert d["result"] is None
    assert d["progress"]["phase"] == "failed"


def test_infeasible_result_still_done(client, monkeypatch):
    from app import jobs
    from app.schemas import SolveResult

    monkeypatch.setattr(jobs, "solve", lambda s, t, cb=None: SolveResult(status="infeasible", message="nu"))
    register(client)
    put_sample_setup(client)
    d = create_done_timetable(client)
    assert d["status"] == "done"
    assert d["result"]["status"] == "infeasible"


def test_restart_marks_running_jobs_failed(client):
    from app import db, jobs
    from app.models import Timetable

    register(client)
    with db.session_scope() as s:
        t = Timetable(institution_id=1, name="x", status="running", progress_json="{}",
                      setup_snapshot_json="{}")
        s.add(t)
        s.flush()
        tid = t.id
    jobs.recover_interrupted()
    d = client.get(f"/api/timetables/{tid}").json()
    assert d["status"] == "failed"
    assert d["progress"]["phase"] == "failed"


def test_move_updates_and_validates(client):
    register(client)
    put_sample_setup(client)
    d = create_done_timetable(client)
    tid = d["id"]
    lessons = {l["id"]: l for l in d["result"]["lessons"]}
    # a_sem1 (t2) at day1 slot0, a_sem3 (t2) at day2 slot0: move sem3 onto sem1 -> clash
    target = lessons["a_sem1#0"]
    r = client.post(f"/api/timetables/{tid}/move",
                    json={"lesson_id": "a_sem3#0", "day": target["day"], "slot": target["slot"]})
    assert r.status_code == 200, r.text
    body = r.json()
    moved = next(l for l in body["lessons"] if l["id"] == "a_sem3#0")
    assert moved["pinned"] is True
    assert (moved["day"], moved["slot"]) == (target["day"], target["slot"])
    assert moved["room_id"] == "r1"  # kept when not given
    assert body["violations"][0]["code"] == "teacher_clash"
    # saved
    d2 = client.get(f"/api/timetables/{tid}").json()
    saved = next(l for l in d2["result"]["lessons"] if l["id"] == "a_sem3#0")
    assert saved["pinned"] and saved["day"] == target["day"]
    assert d2["result"]["violations"][0]["code"] == "teacher_clash"


def test_move_room_explicit_and_null(client):
    register(client)
    put_sample_setup(client)
    tid = create_done_timetable(client)["id"]
    r = client.post(f"/api/timetables/{tid}/move",
                    json={"lesson_id": "a_lec#0", "day": 4, "slot": 6, "room_id": "r2"})
    assert next(l for l in r.json()["lessons"] if l["id"] == "a_lec#0")["room_id"] == "r2"
    r = client.post(f"/api/timetables/{tid}/move",
                    json={"lesson_id": "a_lec#0", "day": 4, "slot": 6, "room_id": None})
    assert next(l for l in r.json()["lessons"] if l["id"] == "a_lec#0")["room_id"] is None
    r = client.post(f"/api/timetables/{tid}/move",
                    json={"lesson_id": "a_lec#0", "day": 4, "slot": 6, "room_id": "ghost"})
    assert r.status_code == 422


def test_move_rejects_bad_input(client):
    register(client)
    put_sample_setup(client)
    tid = create_done_timetable(client)["id"]
    for day, slot in [(5, 0), (-1, 0), (0, 7), (0, -1)]:
        r = client.post(f"/api/timetables/{tid}/move",
                        json={"lesson_id": "a_lec#0", "day": day, "slot": slot})
        assert r.status_code == 422, (day, slot)
    r = client.post(f"/api/timetables/{tid}/move", json={"lesson_id": "nope", "day": 0, "slot": 0})
    assert r.status_code == 404
    assert client.post("/api/timetables/999/move",
                       json={"lesson_id": "a", "day": 0, "slot": 0}).status_code == 404


def test_move_on_unfinished_timetable(client, monkeypatch):
    from app import jobs

    gate = threading.Event()
    monkeypatch.setattr(jobs, "solve", lambda *a, **k: gate.wait(5))
    register(client)
    put_sample_setup(client)
    tid = client.post("/api/timetables", json={}).json()["id"]
    r = client.post(f"/api/timetables/{tid}/move", json={"lesson_id": "a", "day": 0, "slot": 0})
    assert r.status_code == 409
    r = client.get(f"/api/timetables/{tid}/export.xlsx")
    assert r.status_code == 409
    gate.set()
    wait_done(client, tid)


def test_publish_and_public(client, make_client):
    register(client)
    put_sample_setup(client)
    token = client.get("/api/share-token").json()["token"]
    anon = make_client()
    assert anon.get(f"/api/public/{token}").status_code == 404
    assert anon.get("/api/public/not-a-token").status_code == 404

    t1 = create_done_timetable(client, name="Primul")
    t2 = create_done_timetable(client, name="Al doilea")
    r = client.post(f"/api/timetables/{t1['id']}/publish", json={"published": True})
    assert r.status_code == 200 and r.json()["published"] is True
    pub = anon.get(f"/api/public/{token}").json()
    assert pub["institution_name"] == "UTM"
    assert pub["timetable"]["name"] == "Primul"
    assert pub["timetable"]["result"]["lessons"]
    assert "setup" in pub and pub["setup"]["groups"]

    client.post(f"/api/timetables/{t2['id']}/publish", json={"published": True})
    assert anon.get(f"/api/public/{token}").json()["timetable"]["name"] == "Al doilea"
    client.post(f"/api/timetables/{t2['id']}/publish", json={"published": False})
    assert anon.get(f"/api/public/{token}").json()["timetable"]["name"] == "Primul"
    client.post(f"/api/timetables/{t1['id']}/publish", json={"published": False})
    assert anon.get(f"/api/public/{token}").status_code == 404


def test_cannot_publish_unfinished(client, monkeypatch):
    from app import jobs

    monkeypatch.setattr(jobs, "solve", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("x")))
    register(client)
    put_sample_setup(client)
    tid = create_done_timetable(client)["id"]  # failed
    r = client.post(f"/api/timetables/{tid}/publish", json={"published": True})
    assert r.status_code == 409


def test_export_endpoint(client):
    register(client)
    put_sample_setup(client)
    tid = create_done_timetable(client)["id"]
    r = client.get(f"/api/timetables/{tid}/export.xlsx")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    assert "attachment" in r.headers["content-disposition"]
    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == ["Anul I", "Anul II"]


def test_delete(client):
    register(client)
    put_sample_setup(client)
    tid = create_done_timetable(client)["id"]
    assert client.delete(f"/api/timetables/{tid}").json() == {"ok": True}
    assert client.get(f"/api/timetables/{tid}").status_code == 404
    assert client.delete(f"/api/timetables/{tid}").status_code == 404
    assert client.get("/api/timetables").json() == []
