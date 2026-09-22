from conftest import tiny_setup

from app.schemas import Assignment, Group, Subject
from app.solver import expand_sessions


def _by_id(setup):
    return {s.id: s for s in expand_sessions(setup)}


def test_basic_expansion_counts_and_ids():
    ss = _by_id(tiny_setup())
    # 1 AM lecture + 1 AM seminar + 1 PC lecture + 1 PC lab x 2 subgroups
    assert set(ss) == {"a_am_c#0", "a_am_s#0", "a_pc_c#0", "a_pc_l#0#s1", "a_pc_l#0#s2"}
    lab = ss["a_pc_l#0#s1"]
    assert lab.subgroup == 1
    assert lab.seats == 13  # ceil(26 / 2)
    assert lab.room_tag == "computers"
    assert lab.room_kinds == ("lab", "sport", "any")
    assert ss["a_am_c#0"].seats == 26
    assert ss["a_am_c#0"].room_kinds == ("lecture", "any")
    assert ss["a_am_s#0"].room_kinds == ("seminar", "lecture", "any")
    assert not any(s.biweekly for s in ss.values())


def test_half_hours_become_biweekly_sessions():
    setup = tiny_setup()
    setup.subjects[0].lecture_per_week = 1.5
    ss = _by_id(setup)
    assert not ss["a_am_c#0"].biweekly
    assert ss["a_am_c#1"].biweekly
    assert ss["a_am_c#1"].session_index == 1


def test_per_week_override_and_zero_hours():
    setup = tiny_setup()
    setup.assignments[1].per_week = 0.5
    setup.assignments[0].per_week = 0
    ss = _by_id(setup)
    assert "a_am_c#0" not in ss
    assert ss["a_am_s#0"].biweekly


def test_lab_without_split_is_whole_group():
    setup = tiny_setup()
    setup.subjects[1].lab_split_subgroups = False
    setup.subjects[1].lab_per_week = 2
    ss = _by_id(setup)
    assert {"a_pc_l#0", "a_pc_l#1"} <= set(ss)
    assert ss["a_pc_l#0"].subgroup is None
    assert ss["a_pc_l#0"].seats == 26


def test_untagged_lab_needs_lab_room():
    setup = tiny_setup()
    setup.subjects[1].lab_room_tag = None
    lab = _by_id(setup)["a_pc_l#0#s1"]
    assert lab.room_kinds == ("lab", "any")
    assert lab.room_tag is None


def test_stream_lecture_sums_students_and_multi_group_subgroups():
    setup = tiny_setup()
    setup.groups.append(Group(id="g2", name="TI-252", program_id="p_ti", year=1, students=21, subgroups=3))
    setup.assignments[0].group_ids = ["g1", "g2"]
    setup.assignments[3].group_ids = ["g1", "g2"]
    ss = _by_id(setup)
    assert ss["a_am_c#0"].seats == 47
    assert ss["a_am_c#0"].group_ids == ("g1", "g2")
    # subgroups up to max(2, 3); subgroup 3 only exists in g2
    assert ss["a_pc_l#0#s1"].seats == 13 + 7
    assert ss["a_pc_l#0#s3"].seats == 7


def test_dangling_references_are_skipped():
    setup = tiny_setup()
    setup.assignments.append(Assignment(id="bad", subject_id="nope", kind="lecture",
                                        teacher_id="t1", group_ids=["g1"]))
    setup.assignments.append(Assignment(id="bad2", subject_id="s_am", kind="lecture",
                                        teacher_id="t1", group_ids=["ghost"]))
    ids = set(_by_id(setup))
    assert not any(i.startswith("bad") for i in ids)


def test_group_with_one_subgroup_is_not_split():
    setup = tiny_setup()
    setup.groups[0].subgroups = 1
    ss = _by_id(setup)
    assert "a_pc_l#0" in ss and ss["a_pc_l#0"].subgroup is None


def test_extra_subject_kind_zero_hours_gives_nothing():
    setup = tiny_setup()
    setup.subjects.append(Subject(id="s_x", program_id="p_ti", year=1, name="X"))
    setup.assignments.append(Assignment(id="ax", subject_id="s_x", kind="seminar",
                                        teacher_id="t1", group_ids=["g1"]))
    assert not any(s.assignment_id == "ax" for s in expand_sessions(setup))
