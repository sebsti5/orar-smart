"""Shared fixtures/helpers for the HTTP API tests.

The solver is replaced by deterministic fakes so these tests never depend on
`app.solver` (written separately). Import with `from api_support import *`.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient  # noqa: E402

from app import auth as auth_module  # noqa: E402
from app import jobs  # noqa: E402
from app.api import setup as setup_api  # noqa: E402
from app.api import timetables as timetables_api  # noqa: E402
from app.schemas import (  # noqa: E402
    Analysis,
    Assignment,
    Group,
    InstitutionSetup,
    Issue,
    PlacedLesson,
    Program,
    Room,
    SolveResult,
    Stream,
    Subject,
    Teacher,
    Violation,
)

PASSWORD = "parola-sigura-1"


# ------------------------------------------------------------------ fakes


def fake_analyze(setup: InstitutionSetup) -> Analysis:
    issues = []
    if not setup.groups:
        issues.append(Issue(severity="warning", code="no_groups", message="Nu există grupe."))
    return Analysis(
        issues=issues,
        loads=[],
        total_sessions=len(setup.assignments),
        can_generate=True,
    )


def fake_auto_assign(setup: InstitutionSetup) -> list[Assignment]:
    existing = list(setup.assignments)
    if not setup.subjects or not setup.teachers or not setup.groups:
        return existing
    subj = setup.subjects[0]
    return existing + [
        Assignment(
            id="a_auto",
            subject_id=subj.id,
            kind="seminar",
            teacher_id=setup.teachers[0].id,
            group_ids=[setup.groups[0].id],
        )
    ]


def fake_demo_setup() -> InstitutionSetup:
    s = sample_setup()
    s.general.name = "Universitatea Demo"
    return s


def lessons_for(setup: InstitutionSetup) -> list[PlacedLesson]:
    """One lesson per assignment, placed deterministically without clashes."""
    days = setup.general.days_per_week
    lessons = []
    for i, a in enumerate(setup.assignments):
        lessons.append(
            PlacedLesson(
                id=f"{a.id}#0",
                assignment_id=a.id,
                session_index=0,
                subject_id=a.subject_id,
                kind=a.kind,
                teacher_id=a.teacher_id,
                group_ids=list(a.group_ids),
                day=i % days,
                slot=i // days,
                room_id=setup.rooms[0].id if setup.rooms else None,
            )
        )
    return lessons


def fake_solve(setup: InstitutionSetup, time_limit_s: int = 30, progress_cb=None) -> SolveResult:
    if progress_cb:
        progress_cb({"phase": "time", "message": "Caut soluții", "best_penalty": 42})
        progress_cb({"phase": "rooms", "message": "Aloc sălile"})
    return SolveResult(status="optimal", lessons=lessons_for(setup), message="ok")


def fake_validate(setup: InstitutionSetup, lessons: list[PlacedLesson]) -> list[Violation]:
    seen: dict[tuple, str] = {}
    out = []
    for l in lessons:
        key = (l.teacher_id, l.day, l.slot)
        if key in seen:
            out.append(
                Violation(
                    severity="error",
                    code="teacher_clash",
                    message="Profesorul are două lecții simultan.",
                    lesson_ids=[seen[key], l.id],
                )
            )
        else:
            seen[key] = l.id
    return out


# ------------------------------------------------------------------ data


def sample_setup() -> InstitutionSetup:
    return InstitutionSetup(
        programs=[Program(id="p_ti", name="Tehnologia Informației", abbreviation="TI")],
        groups=[
            Group(id="g1", name="TI-241", program_id="p_ti", year=1, students=25, subgroups=2),
            Group(id="g2", name="TI-242", program_id="p_ti", year=1, students=25, subgroups=2),
            Group(id="g3", name="TI-231", program_id="p_ti", year=2, students=20),
        ],
        rooms=[
            Room(id="r1", name="3-611", capacity=150, kind="lecture"),
            Room(id="r2", name="3-301", capacity=30, kind="seminar"),
        ],
        teachers=[
            Teacher(id="t1", name="Stanciu L.", title="conf. univ., dr."),
            Teacher(id="t2", name="Popescu A."),
        ],
        subjects=[
            Subject(id="s_am", program_id="p_ti", year=1, name="Analiza Matematică", short="AM",
                    lecture_per_week=1, seminar_per_week=1),
            Subject(id="s_pc", program_id="p_ti", year=2, name="Programarea Calculatoarelor",
                    short="PC", seminar_per_week=1),
        ],
        streams=[Stream(id="st1", name="TI-24", group_ids=["g1", "g2"])],
        assignments=[
            Assignment(id="a_lec", subject_id="s_am", kind="lecture", teacher_id="t1",
                       group_ids=["g1", "g2"]),
            Assignment(id="a_sem1", subject_id="s_am", kind="seminar", teacher_id="t2",
                       group_ids=["g1"]),
            Assignment(id="a_sem3", subject_id="s_pc", kind="seminar", teacher_id="t2",
                       group_ids=["g3"]),
        ],
    )


# ------------------------------------------------------------------ fixtures


@pytest.fixture
def app_env(tmp_path, monkeypatch):
    monkeypatch.setenv("ORAR_DB", str(tmp_path / "test.db"))
    monkeypatch.setenv("ORAR_SECRET", "test-secret-for-pytest-0123456789abcdef")
    monkeypatch.setattr(setup_api, "analyze", fake_analyze)
    monkeypatch.setattr(setup_api, "auto_assign", fake_auto_assign)
    monkeypatch.setattr(setup_api, "demo_setup", fake_demo_setup)
    monkeypatch.setattr(jobs, "solve", fake_solve)
    monkeypatch.setattr(timetables_api, "validate", fake_validate)
    auth_module.reset_rate_limits()
    return tmp_path


@pytest.fixture
def client(app_env):
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def make_client(client):
    """Extra clients (separate cookie jars) sharing the same app + DB."""
    from app.main import app

    def _make() -> TestClient:
        return TestClient(app)

    return _make


def register(c: TestClient, email: str = "admin@utm.md", inst: str = "UTM") -> dict:
    r = c.post(
        "/api/auth/register",
        json={"email": email, "password": PASSWORD, "institution_name": inst},
    )
    assert r.status_code == 200, r.text
    return r.json()


def put_sample_setup(c: TestClient) -> dict:
    r = c.put("/api/setup", json=sample_setup().model_dump())
    assert r.status_code == 200, r.text
    return r.json()


def wait_done(c: TestClient, tid: int, timeout: float = 10.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        d = c.get(f"/api/timetables/{tid}").json()
        if d["status"] in ("done", "failed"):
            return d
        time.sleep(0.05)
    raise AssertionError("timetable did not finish")


def create_done_timetable(c: TestClient, **body) -> dict:
    r = c.post("/api/timetables", json=body)
    assert r.status_code == 200, r.text
    return wait_done(c, r.json()["id"])
