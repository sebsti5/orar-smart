from conftest import tiny_setup

from app.schemas import Group, Stream, Teacher, TeacherCapability
from app.solver import analyze, auto_assign


def _coverage(assignments):
    cov = {}
    for a in assignments:
        for g in a.group_ids:
            cov.setdefault((a.subject_id, a.kind, g), []).append(a)
    return cov


def _two_group_setup():
    s = tiny_setup()
    s.groups.append(Group(id="g2", name="TI-252", program_id="p_ti", year=1, students=24, subgroups=2))
    s.groups.append(Group(id="g3", name="TI-253", program_id="p_ti", year=1, students=22))
    s.streams.append(Stream(id="st1", name="TI-25 (1-2)", group_ids=["g1", "g2"]))
    return s


def test_fills_missing_coverage_keeping_existing():
    s = _two_group_setup()
    existing = list(s.assignments)
    out = auto_assign(s)
    assert out[: len(existing)] == existing
    cov = _coverage(out)
    for g in ("g1", "g2", "g3"):
        for key in (("s_am", "lecture"), ("s_am", "seminar"), ("s_pc", "lecture"), ("s_pc", "lab")):
            assert len(cov[(*key, g)]) == 1, (key, g)
    assert len({a.id for a in out}) == len(out)
    assert not any(i.code == "missing_coverage" for i in analyze(s.model_copy(update={"assignments": out})).issues)


def test_lectures_follow_stream_seminars_per_group():
    s = _two_group_setup()
    s.assignments = []
    out = auto_assign(s)
    lectures = [a for a in out if a.kind == "lecture" and a.subject_id == "s_am"]
    assert sorted(sorted(a.group_ids) for a in lectures) == [["g1", "g2"], ["g3"]]
    seminars = [a for a in out if a.kind == "seminar"]
    assert all(len(a.group_ids) == 1 for a in seminars)
    labs = [a for a in out if a.kind == "lab"]
    assert all(len(a.group_ids) == 1 for a in labs) and len(labs) == 3


def test_teacher_choice_balances_load():
    s = _two_group_setup()
    s.assignments = []
    s.teachers[1].capabilities = [TeacherCapability(subject_id="s_pc", kinds=["lecture"])]
    s.teachers.append(Teacher(id="t5", name="Popovici A.", max_pairs_per_week=20,
                              capabilities=[TeacherCapability(subject_id="s_pc", kinds=["lab"])]))
    out = auto_assign(s)
    lab_teachers = [a.teacher_id for a in out if a.kind == "lab"]
    assert set(lab_teachers) == {"t3", "t5"}


def test_capability_required():
    s = tiny_setup()
    s.assignments = []
    s.teachers[0].capabilities = []  # nobody can teach AM
    out = auto_assign(s)
    assert not any(a.subject_id == "s_am" for a in out)
    assert any(a.subject_id == "s_pc" for a in out)


def test_ignores_groups_of_other_years():
    s = tiny_setup()
    s.groups.append(Group(id="g2", name="TI-241", program_id="p_ti", year=2, students=20))
    out = auto_assign(s)
    assert not any("g2" in a.group_ids for a in out)
