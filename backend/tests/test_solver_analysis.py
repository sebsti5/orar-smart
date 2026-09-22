from conftest import availability, tiny_setup

from app.schemas import (
    Assignment,
    Group,
    PinnedLesson,
    Program,
    Room,
    RoomUnavailability,
    Stream,
    Teacher,
)
from app.solver import analyze


def _codes(analysis, severity=None):
    return {i.code for i in analysis.issues if severity is None or i.severity == severity}


def test_clean_setup_can_generate_and_has_loads():
    a = analyze(tiny_setup())
    assert a.can_generate, a.issues
    assert not _codes(a, "error")
    assert a.total_sessions == 5
    ents = {(l.entity, l.entity_id) for l in a.loads}
    assert {("teacher", "t1"), ("teacher", "t2"), ("teacher", "t3"), ("group", "g1")} <= ents
    assert any(l.entity == "room_kind" for l in a.loads)
    g = next(l for l in a.loads if l.entity == "group")
    assert g.required == 5  # 3 whole-group + 2 serial subgroup labs (same teacher)
    assert g.capacity == 20


def test_teacher_availability_overload_is_error_with_romanian_message():
    setup = tiny_setup()
    setup.subjects[0].lecture_per_week = 3
    setup.subjects[0].seminar_per_week = 2
    setup.teachers[0].availability = availability(5, 4, {(0, 0), (1, 0), (2, 0)})
    a = analyze(setup)
    assert not a.can_generate
    issue = next(i for i in a.issues if i.code == "teacher_overloaded")
    assert issue.severity == "error"
    assert "Stanciu L." in issue.message
    assert "5 perechi/săptămână" in issue.message
    assert "3 sloturi" in issue.message
    assert issue.entity == "teacher" and issue.entity_id == "t1"


def test_max_pairs_exceeded_is_warning():
    setup = tiny_setup()
    setup.teachers[0].max_pairs_per_week = 1
    a = analyze(setup)
    assert "teacher_over_max_pairs" in _codes(a, "warning")
    assert a.can_generate


def test_half_hours_without_parity_is_error():
    setup = tiny_setup(parity=False)
    setup.subjects[0].lecture_per_week = 1.5
    a = analyze(setup)
    assert "half_hours_without_parity" in _codes(a, "error")
    assert not a.can_generate


def test_dangling_ids_are_errors():
    setup = tiny_setup()
    setup.assignments.append(Assignment(id="x", subject_id="s_am", kind="lecture",
                                        teacher_id="ghost", group_ids=["g1", "nog"]))
    setup.groups.append(Group(id="g9", name="XX-251", program_id="nop", year=1, students=10))
    setup.room_unavailability.append(RoomUnavailability(room_id="nor", day=0, slot=0))
    a = analyze(setup)
    assert "dangling_reference" in _codes(a, "error")
    msgs = " ".join(i.message for i in a.issues)
    assert "ghost" in msgs and "nog" in msgs and "nop" in msgs and "nor" in msgs


def test_duplicate_ids_are_errors():
    setup = tiny_setup()
    setup.rooms.append(Room(id="r_sem", name="dup", capacity=10))
    assert "duplicate_id" in _codes(analyze(setup), "error")


def test_group_overload_is_error():
    setup = tiny_setup(days=1, max_day=3)
    a = analyze(setup)
    issue = next(i for i in a.issues if i.code == "group_overloaded")
    assert issue.severity == "error"
    assert "TI-251" in issue.message


def test_room_shortage_is_error():
    setup = tiny_setup(days=1, n_slots=2, max_day=2)
    setup.subjects[0].seminar_per_week = 0
    setup.subjects[1].lecture_per_week = 0
    setup.rooms = [r for r in setup.rooms if r.id != "r_hall"]  # no lecture hall at all
    a = analyze(setup)
    assert "no_room_fits" in _codes(a, "error")


def test_room_capacity_threshold_shortage():
    setup = tiny_setup(days=1, n_slots=2, max_day=2)
    setup.subjects[1].lab_per_week = 2  # 4 lab sessions, 2 labs x 2 slots = 4 ok
    assert "rooms_insufficient" not in _codes(analyze(setup))
    setup.room_unavailability.append(RoomUnavailability(room_id="r_lab1", day=0, slot=0))
    a = analyze(setup)
    assert "rooms_insufficient" in _codes(a, "error")


def test_warnings_for_streams_capabilities_and_coverage():
    setup = tiny_setup()
    setup.programs.append(Program(id="p_si", name="Securitate", abbreviation="SI"))
    setup.groups.append(Group(id="g2", name="SI-241", program_id="p_si", year=2, students=20))
    setup.streams.append(Stream(id="st", name="mix", group_ids=["g1", "g2"]))
    setup.teachers.append(Teacher(id="t4", name="Bostan V."))
    setup.assignments[1].teacher_id = "t4"  # not capable of AM seminar
    setup.assignments.pop(2)  # PC lecture now uncovered
    a = analyze(setup)
    w = _codes(a, "warning")
    assert {"stream_mixed", "teacher_not_capable", "missing_coverage"} <= w
    assert a.can_generate


def test_subject_without_any_assignment_warns():
    setup = tiny_setup()
    setup.assignments = [x for x in setup.assignments if x.subject_id != "s_pc"]
    assert "subject_unassigned" in _codes(analyze(setup), "warning")


def test_invalid_pin_is_error():
    setup = tiny_setup()
    setup.pinned.append(PinnedLesson(assignment_id="a_am_c", session_index=3, day=0, slot=0))
    setup.pinned.append(PinnedLesson(assignment_id="a_am_s", day=9, slot=0))
    a = analyze(setup)
    assert len([i for i in a.issues if i.code == "pin_invalid"]) == 2


def test_pin_on_unavailable_teacher_slot_is_error():
    setup = tiny_setup()
    setup.teachers[0].availability = availability(5, 4, {(1, 1), (2, 2)})
    setup.pinned.append(PinnedLesson(assignment_id="a_am_c", day=0, slot=0))
    assert "pin_invalid" in _codes(analyze(setup), "error")


def test_group_bound_counts_same_teacher_subgroup_labs_serially():
    # 3 whole-group sessions + 2 subgroup labs of ONE teacher = 5 slots > 4
    setup = tiny_setup(days=1, max_day=4)
    a = analyze(setup)
    g = next(l for l in a.loads if l.entity == "group")
    assert g.required == 5
    assert "group_overloaded" in _codes(a, "error")
