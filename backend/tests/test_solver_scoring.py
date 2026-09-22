from conftest import tiny_setup
from test_solver_validate import L

from app.solver.scoring import WEIGHTS, compute_score


def test_empty_schedule_scores_zero():
    assert compute_score(tiny_setup(), []).total_penalty == 0


def test_gaps_late_short_days_and_repeats():
    s = tiny_setup(n_slots=6, min_day=2, max_day=6)
    ls = [
        L("a_am_c", 0, 0), L("a_am_s", 0, 2),  # group gap 1, teacher (t1) gap 1
        L("a_pc_c", 1, 5),                     # late (last two) + lecture after slot 4, short day
        L("a_pc_l", 2, 0, sub=1), L("a_pc_l", 2, 1, sub=1, idx=1),  # same subject twice for s1
    ]
    sc = compute_score(s, ls)
    assert sc.group_gaps == 1
    assert sc.teacher_gaps == 1
    assert sc.late_lessons == 1
    assert sc.days_over_min_violations == 1
    assert sc.same_subject_same_day == 1
    expected_min = (10 * 1 + 3 * 1 + 2 * 1 + 8 * 1 + 5 * 1 + 1)  # + lecture late
    assert sc.total_penalty >= expected_min
    assert WEIGHTS["group_gap"] == 10


def test_biweekly_pair_in_one_slot_counts_once():
    s = tiny_setup(min_day=0)
    ls = [L("a_am_c", 0, 0, parity="odd"), L("a_am_s", 0, 0, parity="even"), L("a_pc_c", 0, 1)]
    sc = compute_score(s, ls)
    assert sc.group_gaps == 0 and sc.teacher_gaps == 0
