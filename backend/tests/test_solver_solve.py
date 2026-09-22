from conftest import availability, tiny_setup

from app.schemas import (
    Assignment,
    Group,
    PinnedLesson,
    Room,
    RoomUnavailability,
    Subject,
    Teacher,
    TeacherCapability,
)
from app.solver import solve, validate

LIMIT = 10


def _errors(setup, result):
    return [v for v in validate(setup, result.lessons) if v.severity == "error"]


def _lesson(result, lesson_id):
    return next(l for l in result.lessons if l.id == lesson_id)


def test_small_setup_solves_clean():
    setup = tiny_setup()
    r = solve(setup, time_limit_s=LIMIT)
    assert r.status in ("optimal", "feasible"), r.message
    assert len(r.lessons) == 5
    assert not r.unplaced
    assert not _errors(setup, r)
    assert all(l.room_id for l in r.lessons)
    assert r.solve_seconds > 0
    assert r.score.total_penalty >= 0


def test_progress_callback_receives_phases():
    events = []
    r = solve(tiny_setup(), time_limit_s=LIMIT, progress_cb=events.append)
    assert r.status in ("optimal", "feasible")
    phases = {e["phase"] for e in events}
    assert {"time", "rooms"} <= phases
    assert all("message" in e for e in events)
    assert any(isinstance(e.get("best_penalty"), int) for e in events if e["phase"] == "time")


def _parity_setup(n_sessions_half: int, n_weekly: int = 0):
    """Teacher t1 with exactly one available slot and several short subjects."""
    setup = tiny_setup(days=1, n_slots=2, max_day=2)
    setup.subjects = []
    setup.assignments = []
    for i in range(n_sessions_half + n_weekly):
        sid = f"s{i}"
        setup.subjects.append(Subject(id=sid, program_id="p_ti", year=1, name=f"Materia {i}",
                                      seminar_per_week=0.5 if i < n_sessions_half else 1))
        setup.assignments.append(Assignment(id=f"a{i}", subject_id=sid, kind="seminar",
                                            teacher_id="t1", group_ids=["g1"]))
    setup.teachers[0].availability = availability(1, 2, {(0, 1)})
    return setup


def test_two_biweekly_sessions_share_a_slot_with_different_parity():
    setup = _parity_setup(2)
    r = solve(setup, time_limit_s=LIMIT)
    assert r.status in ("optimal", "feasible"), r.message
    a, b = r.lessons
    assert (a.day, a.slot) == (b.day, b.slot) == (0, 1)
    assert {a.parity, b.parity} == {"odd", "even"}
    assert a.room_id and b.room_id  # may even share the seminar room
    assert not _errors(setup, r)


def test_weekly_plus_biweekly_in_one_slot_is_infeasible():
    setup = _parity_setup(1, n_weekly=1)
    r = solve(setup, time_limit_s=LIMIT)
    assert r.status == "infeasible"
    assert "Stanciu L." in r.message


def _subgroup_setup(with_lecture: bool):
    setup = tiny_setup(days=1, n_slots=2, max_day=2)
    setup.teachers.append(Teacher(id="t4", name="Bostan V."))
    setup.subjects = [
        Subject(id="sx", program_id="p_ti", year=1, name="Baze de date", lab_per_week=1,
                lab_room_tag="computers", lecture_per_week=1 if with_lecture else 0),
        Subject(id="sy", program_id="p_ti", year=1, name="Sisteme de operare", lab_per_week=1,
                lab_room_tag="computers"),
    ]
    setup.assignments = [
        Assignment(id="ax", subject_id="sx", kind="lab", teacher_id="t3", group_ids=["g1"]),
        Assignment(id="ay", subject_id="sy", kind="lab", teacher_id="t4", group_ids=["g1"]),
    ]
    if with_lecture:
        setup.assignments.append(Assignment(id="axc", subject_id="sx", kind="lecture",
                                            teacher_id="t2", group_ids=["g1"]))
    return setup


def test_different_subgroups_run_in_parallel():
    setup = _subgroup_setup(with_lecture=False)
    r = solve(setup, time_limit_s=LIMIT)
    assert r.status in ("optimal", "feasible"), r.message
    by_slot = {}
    for l in r.lessons:
        by_slot.setdefault(l.slot, []).append(l)
    for group in by_slot.values():
        assert len({l.subgroup for l in group}) == len(group)  # no subgroup twice in a slot
    assert not _errors(setup, r)


def test_whole_group_lesson_clashes_with_subgroups():
    setup = _subgroup_setup(with_lecture=True)
    r = solve(setup, time_limit_s=LIMIT)
    assert r.status == "infeasible"
    assert r.message


def test_teacher_availability_respected():
    setup = tiny_setup()
    setup.teachers[1].availability = availability(5, 4, {(3, 2)})
    r = solve(setup, time_limit_s=LIMIT)
    pc = _lesson(r, "a_pc_c#0")
    assert (pc.day, pc.slot) == (3, 2)


def test_pinned_lesson_kept_with_room():
    setup = tiny_setup()
    setup.pinned.append(PinnedLesson(assignment_id="a_pc_l", session_index=0, subgroup=2,
                                     day=4, slot=3, room_id="r_lab2"))
    r = solve(setup, time_limit_s=LIMIT)
    lab = _lesson(r, "a_pc_l#0#s2")
    assert (lab.day, lab.slot, lab.room_id, lab.pinned) == (4, 3, "r_lab2", True)
    assert not _lesson(r, "a_am_c#0").pinned


def test_max_lessons_per_day_respected():
    # 5 slots needed (both subgroup labs share teacher t3) → 3 days x 2 = 6
    setup = tiny_setup(days=3, n_slots=3, max_day=2)
    r = solve(setup, time_limit_s=LIMIT)
    assert r.status in ("optimal", "feasible"), r.message
    per_day = {}
    for l in r.lessons:
        per_day.setdefault(l.day, set()).add(l.slot)
    assert all(len(s) <= 2 for s in per_day.values())


def test_room_capacity_forces_different_slots():
    setup = tiny_setup(days=1, n_slots=2, max_day=2)
    setup.groups = [
        Group(id="g1", name="TI-251", program_id="p_ti", year=1, students=100),
        Group(id="g2", name="TI-252", program_id="p_ti", year=1, students=100),
    ]
    setup.rooms = [
        Room(id="big", name="3-611", capacity=120, kind="lecture"),
        Room(id="small", name="3-501", capacity=50, kind="lecture"),
    ]
    setup.subjects = [Subject(id="s1", program_id="p_ti", year=1, name="Fizica", lecture_per_week=1)]
    setup.teachers.append(Teacher(id="t9", name="Nastas A."))
    setup.assignments = [
        Assignment(id="a1", subject_id="s1", kind="lecture", teacher_id="t1", group_ids=["g1"]),
        Assignment(id="a2", subject_id="s1", kind="lecture", teacher_id="t9", group_ids=["g2"]),
    ]
    r = solve(setup, time_limit_s=LIMIT)
    assert r.status in ("optimal", "feasible"), r.message
    assert {l.slot for l in r.lessons} == {0, 1}
    assert {l.room_id for l in r.lessons} == {"big"}


def test_room_unavailability_respected():
    setup = tiny_setup(days=1, n_slots=4, max_day=4)
    for s in range(3):
        setup.room_unavailability.append(RoomUnavailability(room_id="r_hall", day=0, slot=s))
    setup.subjects[0].seminar_per_week = 0
    setup.subjects[1].lab_per_week = 0
    setup.subjects[1].lecture_per_week = 0
    r = solve(setup, time_limit_s=LIMIT)
    lec = _lesson(r, "a_am_c#0")
    assert (lec.slot, lec.room_id) == (3, "r_hall")


def test_infeasible_teacher_detected_before_solving():
    setup = tiny_setup()
    setup.subjects[0].lecture_per_week = 3
    setup.subjects[0].seminar_per_week = 2
    setup.teachers[0].availability = availability(5, 4, {(0, 0), (1, 0), (2, 0)})
    r = solve(setup, time_limit_s=LIMIT)
    assert r.status == "infeasible"
    assert "Stanciu L." in r.message
    assert not r.lessons
    assert len(r.unplaced) == 8


def test_group_filter_limits_sessions():
    setup = tiny_setup()
    setup.groups.append(Group(id="g2", name="TI-252", program_id="p_ti", year=1, students=20))
    setup.assignments.append(Assignment(id="a2", subject_id="s_am", kind="seminar",
                                        teacher_id="t1", group_ids=["g2"]))
    r = solve(setup, time_limit_s=LIMIT, group_ids=["g2"])
    assert [l.id for l in r.lessons] == ["a2#0"]


def test_prefers_compact_days_without_gaps():
    setup = tiny_setup(days=1, n_slots=6, max_day=6)
    setup.subjects[1].lab_per_week = 0
    r = solve(setup, time_limit_s=LIMIT)
    assert r.status == "optimal"
    assert r.score.group_gaps == 0
    assert r.score.teacher_gaps == 0
    assert r.score.late_lessons == 0  # 3 lessons fit before the last two slots


def test_teacher_capability_unused_but_shared_teacher_clash_avoided():
    setup = tiny_setup()
    setup.groups.append(Group(id="g2", name="TI-252", program_id="p_ti", year=1, students=20))
    setup.teachers[0].capabilities.append(TeacherCapability(subject_id="s_pc", kinds=["lab"]))
    setup.assignments.append(Assignment(id="a2", subject_id="s_am", kind="seminar",
                                        teacher_id="t1", group_ids=["g2"]))
    r = solve(setup, time_limit_s=LIMIT)
    assert not _errors(setup, r)


def test_infeasible_found_by_model_gets_diagnosis():
    """Analysis passes (loads fit) but both teachers are only free in the same slot."""
    setup = tiny_setup(days=1, n_slots=2, max_day=2)
    setup.subjects[1].lecture_per_week = 0
    setup.subjects[1].lab_per_week = 0
    setup.subjects[0].seminar_per_week = 1
    setup.assignments[1].teacher_id = "t2"
    only_first = availability(1, 2, {(0, 0)})
    setup.teachers[0].availability = only_first
    setup.teachers[1].availability = only_first
    r = solve(setup, time_limit_s=LIMIT)
    assert r.status == "infeasible"
    assert "disponibilit" in r.message.lower()
