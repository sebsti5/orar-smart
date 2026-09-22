"""Soft objectives for the time model (weights live in scoring.WEIGHTS)."""

from __future__ import annotations

from collections import defaultdict

from .common import group_units
from .model_time import TimeModel
from .scoring import WEIGHTS, placement_cost


def add_soft_objectives(tm: TimeModel) -> None:
    _placement(tm)
    teachers, _units, _groups = tm.resources()
    for tid, members in teachers.items():
        occ = {c: tm.occupancy(members, c, f"t{tid}") for c in tm.idx.slots_grid()}
        _gaps(tm, occ, WEIGHTS["teacher_gap"], f"t{tid}")
    for gid, occ in tm.group_occ.items():
        _gaps(tm, occ, WEIGHTS["group_gap"], f"g{gid}")
        _day_shape(tm, occ, gid)
    _same_subject(tm)


def _placement(tm: TimeModel) -> None:
    n_slots = tm.idx.n_slots
    for i, s in enumerate(tm.sessions):
        for (_d, sl), _p, v in tm.all_vars(i):
            cost = placement_cost(s.kind, sl, n_slots)
            if cost:
                tm.objective.append(cost * v)


def _gaps(tm: TimeModel, occ: dict, weight: int, tag: str) -> None:
    """gap[s] >= (something before s) + (something after s) - 1 - occ[s]."""
    m, n = tm.m, tm.idx.n_slots
    for d in range(tm.idx.n_days):
        row = [occ[(d, s)] for s in range(n)]
        if sum(1 for o in row if o is not None) < 2:
            continue
        before: list = [None] * n  # before[s] = any lesson in slots < s
        for s in range(1, n):
            prev = [x for x in (before[s - 1], row[s - 1]) if x is not None]
            if prev:
                b = m.NewBoolVar(f"pre_{tag}_{d}_{s}")
                for x in prev:
                    m.Add(b >= x)
                before[s] = b
        after: list = [None] * n  # after[s] = any lesson in slots > s
        for s in range(n - 2, -1, -1):
            nxt = [x for x in (after[s + 1], row[s + 1]) if x is not None]
            if nxt:
                a = m.NewBoolVar(f"suf_{tag}_{d}_{s}")
                for x in nxt:
                    m.Add(a >= x)
                after[s] = a
        for s in range(1, n - 1):
            if before[s] is None or after[s] is None:
                continue
            gap = m.NewBoolVar(f"gap_{tag}_{d}_{s}")
            here = row[s] if row[s] is not None else 0
            m.Add(gap >= before[s] + after[s] - 1 - here)
            tm.objective.append(weight * gap)


def _day_shape(tm: TimeModel, occ: dict, gid: str) -> None:
    """Short days (1..min-1 lessons) and max-min spread over active days."""
    m, n = tm.m, tm.idx.n_slots
    min_day = tm.idx.setup.general.min_lessons_per_day
    counts, actives = [], []
    for d in range(tm.idx.n_days):
        row = [occ[(d, s)] for s in range(n) if occ[(d, s)] is not None]
        if not row:
            continue
        active = m.NewBoolVar(f"act_{gid}_{d}")
        for x in row:
            m.Add(active >= x)
        cnt = sum(row)
        counts.append(cnt)
        actives.append(active)
        if min_day >= 2:
            short = m.NewBoolVar(f"short_{gid}_{d}")
            m.Add(cnt + min_day * short >= min_day * active)
            tm.objective.append(WEIGHTS["short_day"] * short)
    if len(counts) < 2:
        return
    hi, lo = m.NewIntVar(0, n, f"hi_{gid}"), m.NewIntVar(0, n, f"lo_{gid}")
    for cnt, active in zip(counts, actives):
        m.Add(hi >= cnt)
        m.Add(lo <= cnt + n * (1 - active))
    m.Add(lo <= hi)
    tm.objective.append(WEIGHTS["unbalanced"] * (hi - lo))


def _same_subject(tm: TimeModel) -> None:
    """Same subject+kind twice on a day for one group (per subgroup unit)."""
    per_unit: dict[tuple, list[int]] = defaultdict(list)
    for i, s in enumerate(tm.sessions):
        for gid, unit in group_units(tm.idx, s.group_ids, s.subgroup):
            per_unit[(gid, s.subject_id, s.kind, unit)].append(i)
    by_key: dict[tuple, list[list[int]]] = defaultdict(list)
    for (gid, subj, kind, _unit), members in per_unit.items():
        if len(members) > 1:
            by_key[(gid, subj, kind)].append(members)
    for key, unit_lists in by_key.items():
        for d in range(tm.idx.n_days):
            day_sums = []
            for members in unit_lists:
                vs = [v for i in members for (dd, _s), _p, v in tm.all_vars(i) if dd == d]
                if len({id(v) for v in vs}) > 1:
                    day_sums.append((sum(vs), len(members)))
            if not day_sums:
                continue
            ub = max(n for _, n in day_sums)
            pen = tm.m.NewIntVar(0, ub, f"same_{'_'.join(map(str, key))}_{d}")
            for expr, _n in day_sums:
                tm.m.Add(pen >= expr - 1)
            tm.objective.append(WEIGHTS["same_subject_day"] * pen)
