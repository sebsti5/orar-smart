import time

import pytest

from app.demo import demo_setup
from app.schemas import InstitutionSetup
from app.solver import analyze, expand_sessions, solve, validate


@pytest.fixture(scope="module")
def demo():
    return demo_setup()


@pytest.fixture(scope="module")
def demo_result(demo):
    t0 = time.monotonic()
    result = solve(demo, time_limit_s=30)
    return result, time.monotonic() - t0


def test_demo_shape(demo):
    InstitutionSetup.model_validate(demo.model_dump())  # round-trips through the contract
    assert demo.general.week_parity
    assert {p.abbreviation for p in demo.programs} == {"TI", "SI", "IA", "CR", "AI", "RM"}
    assert 12 <= len(demo.groups) <= 16
    assert {g.year for g in demo.groups} == {1, 2}
    assert 30 <= len(demo.teachers) <= 40
    assert 20 <= len(demo.rooms) <= 30
    assert any(r.kind == "sport" for r in demo.rooms)
    assert any("computers" in r.tags for r in demo.rooms)
    assert any("electronics" in r.tags for r in demo.rooms)
    assert demo.streams
    names = {s.name for s in demo.subjects}
    assert {"Analiza matematică", "Baze de date", "Structuri de date și algoritmi"} <= names
    assert any(s.biweekly for s in expand_sessions(demo))
    assert any(t.availability for t in demo.teachers)


def test_demo_analysis_is_clean(demo):
    a = analyze(demo)
    assert a.can_generate, [i.message for i in a.issues if i.severity == "error"]
    assert not [i for i in a.issues if i.code == "missing_coverage"]
    assert a.total_sessions > 150


def test_demo_solves_clean_and_fast(demo, demo_result):
    result, seconds = demo_result
    assert result.status in ("optimal", "feasible"), result.message
    assert seconds < 45
    assert not result.unplaced
    assert len(result.lessons) == len(expand_sessions(demo))
    errors = [v for v in validate(demo, result.lessons) if v.severity == "error" and v.code != "no_room"]
    assert errors == [], errors[:5]
    print(f"\nDEMO: {len(result.lessons)} lessons, {seconds:.1f}s, score={result.score}")


def test_demo_rooms_mostly_assigned(demo_result):
    result, _ = demo_result
    missing = [l for l in result.lessons if l.room_id is None]
    assert len(missing) <= len(result.lessons) * 0.02
