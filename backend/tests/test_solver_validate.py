from conftest import availability, tiny_setup

from app.schemas import PlacedLesson, RoomUnavailability
from app.solver import validate

SUBJECT_OF = {"a_am_c": ("s_am", "lecture", "t1"), "a_am_s": ("s_am", "seminar", "t1"),
              "a_pc_c": ("s_pc", "lecture", "t2"), "a_pc_l": ("s_pc", "lab", "t3")}
DEFAULT_ROOM = {"lecture": "r_hall", "seminar": "r_sem", "lab": "r_lab1"}


def L(aid, day, slot, *, sub=None, parity="all", room="default", idx=0, teacher=None):
    subj, kind, t = SUBJECT_OF[aid]
    lid = f"{aid}#{idx}" + (f"#s{sub}" if sub else "")
    return PlacedLesson(id=lid, assignment_id=aid, session_index=idx, subject_id=subj, kind=kind,
                        teacher_id=teacher or t, group_ids=["g1"], subgroup=sub, day=day, slot=slot,
                        parity=parity, room_id=DEFAULT_ROOM[kind] if room == "default" else room)


def clean_lessons():
    return [L("a_am_c", 0, 0), L("a_am_s", 0, 1), L("a_pc_c", 1, 0),
            L("a_pc_l", 1, 1, sub=1), L("a_pc_l", 1, 2, sub=2, room="r_lab2")]


def codes(vs):
    return {v.code for v in vs}


def test_clean_schedule_has_no_violations():
    assert validate(tiny_setup(), clean_lessons()) == []


def test_teacher_clash_detected_with_lesson_ids():
    ls = clean_lessons()
    ls[1] = L("a_am_s", 0, 0)
    vs = validate(tiny_setup(), ls)
    tc = [v for v in vs if v.code == "teacher_clash"]
    assert tc and set(tc[0].lesson_ids) == {"a_am_c#0", "a_am_s#0"}
    assert "Stanciu L." in tc[0].message and "Luni" in tc[0].message
    assert "group_clash" in codes(vs)


def test_parity_rules():
    s = tiny_setup()
    base = [L("a_am_c", 0, 0, parity="odd"), L("a_am_s", 0, 0, parity="even", room="r_hall")]
    assert "teacher_clash" not in codes(validate(s, base))
    assert "room_clash" not in codes(validate(s, base))
    same = [L("a_am_c", 0, 0, parity="odd"), L("a_am_s", 0, 0, parity="odd", room="r_hall")]
    assert {"teacher_clash", "room_clash", "group_clash"} <= codes(validate(s, same))
    mixed = [L("a_am_c", 0, 0, parity="all"), L("a_am_s", 0, 0, parity="even")]
    assert "teacher_clash" in codes(validate(s, mixed))


def test_subgroup_rules():
    s = tiny_setup()
    ok = [L("a_pc_l", 0, 0, sub=1, teacher="t2"), L("a_pc_l", 0, 0, sub=2, room="r_lab2")]
    assert validate(s, ok) == []
    same_sub = [L("a_pc_l", 0, 0, sub=1, teacher="t2"), L("a_pc_l", 0, 0, sub=1, room="r_lab2", idx=1)]
    assert "group_clash" in codes(validate(s, same_sub))
    whole = [L("a_am_c", 0, 0), L("a_pc_l", 0, 0, sub=2)]
    assert "group_clash" in codes(validate(s, whole))


def test_room_problems():
    s = tiny_setup()
    s.room_unavailability.append(RoomUnavailability(room_id="r_hall", day=0, slot=0))
    ls = [L("a_am_c", 0, 0), L("a_am_s", 0, 1, room="r_lab1"), L("a_pc_c", 1, 0, room="r_sem"),
          L("a_pc_l", 1, 1, sub=1, room=None), L("a_pc_l", 1, 2, sub=2, room="nowhere")]
    vs = codes(validate(s, ls))
    assert {"room_unavailable", "room_too_small", "room_wrong_kind", "no_room", "unknown_reference"} <= vs


def test_lab_room_needs_tag():
    s = tiny_setup()
    s.rooms[2].tags = []
    vs = validate(s, [L("a_pc_l", 0, 0, sub=1)])
    assert "room_wrong_kind" in codes(vs)


def test_room_clash_between_groups():
    s = tiny_setup()
    ls = [L("a_am_c", 0, 0), L("a_pc_c", 0, 0, room="r_hall")]
    vs = codes(validate(s, ls))
    assert "room_clash" in vs


def test_teacher_unavailable_and_out_of_range():
    s = tiny_setup()
    s.teachers[0].availability = availability(5, 4, {(2, 2)})
    vs = validate(s, [L("a_am_c", 0, 0), L("a_am_s", 5, 0), L("a_pc_c", 0, 7)])
    assert {"teacher_unavailable", "out_of_range"} <= codes(vs)


def test_max_lessons_per_day_counts_subgroup_slots():
    s = tiny_setup(max_day=2)
    ls = [L("a_am_c", 0, 0), L("a_pc_l", 0, 1, sub=1), L("a_pc_l", 0, 2, sub=2, room="r_lab2")]
    vs = [v for v in validate(s, ls) if v.code == "max_per_day"]
    assert vs and "TI-251" in vs[0].message and len(vs[0].lesson_ids) == 3
    # the same two subgroup labs in one slot occupy only 2 slots in total
    ls2 = [L("a_am_c", 0, 0), L("a_pc_l", 0, 1, sub=1, teacher="t2"),
           L("a_pc_l", 0, 1, sub=2, room="r_lab2")]
    assert "max_per_day" not in codes(validate(s, ls2))


def test_unknown_teacher_and_group():
    s = tiny_setup()
    bad = L("a_am_c", 0, 0, teacher="ghost").model_copy(update={"group_ids": ["g1", "nog"]})
    vs = codes(validate(s, [bad]))
    assert "unknown_reference" in vs
