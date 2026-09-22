"""Soft-constraint weights and the score of a finished lesson list."""

from __future__ import annotations

from collections import defaultdict
from typing import Iterable

from app.schemas import InstitutionSetup, PlacedLesson, Score

from .common import SetupIndex, build_index, group_units

WEIGHTS = {
    "group_gap": 10,
    "teacher_gap": 3,
    "short_day": 8,  # group day with 1..min-1 lessons
    "same_subject_day": 5,
    "late": 2,  # each lesson in the last two slots
    "lecture_late": 1,  # lectures after slot 4
    "unbalanced": 1,  # per group: busiest active day - lightest active day
}
LECTURE_LATE_FROM = 4  # 0-based slot index: slot 5 onwards


def late_slots(n_slots: int) -> set[int]:
    return {s for s in range(max(0, n_slots - 2), n_slots)}


def placement_cost(kind: str, slot: int, n_slots: int) -> int:
    """Per-lesson penalty that depends only on where the lesson sits."""
    cost = WEIGHTS["late"] if slot in late_slots(n_slots) else 0
    if kind == "lecture" and slot >= LECTURE_LATE_FROM:
        cost += WEIGHTS["lecture_late"]
    return cost


def gaps(slots: Iterable[int]) -> int:
    occ = sorted(set(slots))
    return (occ[-1] - occ[0] + 1 - len(occ)) if occ else 0


def _group_days(idx: SetupIndex, lessons: list[PlacedLesson]) -> dict[str, dict[int, set[int]]]:
    out: dict[str, dict[int, set[int]]] = defaultdict(lambda: defaultdict(set))
    for l in lessons:
        for gid in l.group_ids:
            if gid in idx.groups:
                out[gid][l.day].add(l.slot)
    return out


def _same_subject_penalty(idx: SetupIndex, lessons: list[PlacedLesson]) -> int:
    counts: dict[tuple, int] = defaultdict(int)
    for l in lessons:
        for gid, unit in group_units(idx, l.group_ids, l.subgroup):
            counts[(gid, l.subject_id, l.kind, l.day, unit)] += 1
    worst: dict[tuple, int] = defaultdict(int)
    for (gid, subj, kind, day, _unit), n in counts.items():
        key = (gid, subj, kind, day)
        worst[key] = max(worst[key], n - 1)
    return sum(worst.values())


def compute_score(setup: InstitutionSetup, lessons: list[PlacedLesson], idx: SetupIndex | None = None) -> Score:
    idx = idx or build_index(setup)
    min_day = setup.general.min_lessons_per_day
    group_days = _group_days(idx, lessons)
    teacher_days: dict[str, dict[int, set[int]]] = defaultdict(lambda: defaultdict(set))
    for l in lessons:
        teacher_days[l.teacher_id][l.day].add(l.slot)

    group_gaps = sum(gaps(sl) for days in group_days.values() for sl in days.values())
    teacher_gaps = sum(gaps(sl) for days in teacher_days.values() for sl in days.values())
    short = sum(1 for days in group_days.values() for sl in days.values() if 0 < len(sl) < min_day)
    unbalanced = sum(max(len(s) for s in days.values()) - min(len(s) for s in days.values())
                     for days in group_days.values() if days)
    late = sum(1 for l in lessons if l.slot in late_slots(idx.n_slots))
    placement = sum(placement_cost(l.kind, l.slot, idx.n_slots) for l in lessons)
    same = _same_subject_penalty(idx, lessons)
    total = (WEIGHTS["group_gap"] * group_gaps + WEIGHTS["teacher_gap"] * teacher_gaps
             + WEIGHTS["short_day"] * short + WEIGHTS["same_subject_day"] * same
             + placement + WEIGHTS["unbalanced"] * unbalanced)
    return Score(group_gaps=group_gaps, teacher_gaps=teacher_gaps, late_lessons=late,
                 days_over_min_violations=short, same_subject_same_day=same, total_penalty=total)
