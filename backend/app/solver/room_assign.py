"""Phase 2: assign concrete rooms to already-timed sessions."""

from __future__ import annotations

from collections import defaultdict
from itertools import product

from ortools.sat.python import cp_model

from app.schemas import PinnedLesson

from .common import SetupIndex, group_units
from .model_time import NUM_WORKERS, pin_key
from .rooms import eligible_rooms
from .sessions import Session

ASSIGN_REWARD = 100_000  # placing a session in a room dominates everything else
BUILDING_CHANGE_COST = 40  # ~ 40 wasted seats


def _candidates(idx: SetupIndex, s: Session, day: int, slot: int, pin: PinnedLesson | None) -> list[str]:
    if pin is not None and pin.room_id in idx.rooms:
        return [pin.room_id]
    blocked = idx.room_unavailable.get((day, slot), frozenset())
    return sorted(r for r in eligible_rooms(s, idx.setup.rooms) if r not in blocked)


def assign_rooms(idx: SetupIndex, sessions: list[Session], placements: dict[int, tuple[int, int, str]],
                 pins: dict[tuple, PinnedLesson], time_limit_s: float) -> dict[int, str | None]:
    """Return session index -> room id (None when no room could be found)."""
    m = cp_model.CpModel()
    y: dict[int, dict[str, cp_model.IntVar]] = {}
    objective = []
    for i, (d, sl, _p) in placements.items():
        s = sessions[i]
        pin = pins.get(pin_key(s.assignment_id, s.session_index, s.subgroup))
        y[i] = {r: m.NewBoolVar(f"y{i}_{r}") for r in _candidates(idx, s, d, sl, pin)}
        if y[i]:
            m.AddAtMostOne(y[i].values())
        for r, v in y[i].items():
            waste = max(0, idx.rooms[r].capacity - s.seats)
            objective.append((ASSIGN_REWARD - waste) * v)
    _room_conflicts(m, y, placements)
    objective.extend(-BUILDING_CHANGE_COST * c for c in _building_changes(idx, m, y, sessions, placements))
    m.Maximize(sum(objective))
    solver = cp_model.CpSolver()
    solver.parameters.num_workers = NUM_WORKERS
    solver.parameters.max_time_in_seconds = max(0.5, float(time_limit_s))
    code = solver.Solve(m)
    result: dict[int, str | None] = {i: None for i in placements}
    if code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for i, rooms in y.items():
            result[i] = next((r for r, v in rooms.items() if solver.BooleanValue(v)), None)
    return result


def _room_conflicts(m: cp_model.CpModel, y: dict, placements: dict) -> None:
    """One lesson per room, cell and parity (odd/even biweekly lessons may share)."""
    by_room_cell: dict[tuple, list[tuple[str, cp_model.IntVar]]] = defaultdict(list)
    for i, rooms in y.items():
        d, sl, p = placements[i]
        for r, v in rooms.items():
            by_room_cell[(r, d, sl)].append((p, v))
    for terms in by_room_cell.values():
        if len(terms) < 2:
            continue
        odd = [v for p, v in terms if p != "even"]
        even = [v for p, v in terms if p != "odd"]
        if len(odd) > 1:
            m.Add(sum(odd) <= 1)
        if len(even) > 1 and any(p != "all" for p, _ in terms):
            m.Add(sum(even) <= 1)


def _building_changes(idx: SetupIndex, m: cp_model.CpModel, y: dict, sessions: list[Session],
                      placements: dict) -> list[cp_model.IntVar]:
    """Penalty vars: a group moves to another building between consecutive slots."""
    buildings = {r.id: r.building for r in idx.setup.rooms}
    if len(set(buildings.values())) < 2:
        return []
    at: dict[tuple, list[int]] = defaultdict(list)  # (unit, day, slot) -> sessions
    for i, (d, sl, _p) in placements.items():
        for unit in group_units(idx, sessions[i].group_ids, sessions[i].subgroup):
            at[(unit, d, sl)].append(i)
    pairs: set[tuple[int, int]] = set()
    for (unit, d, sl), here in at.items():
        for a, b in product(here, at.get((unit, d, sl + 1), ())):
            pairs.add((a, b))
    in_building: dict[tuple[int, str], object] = {}

    def b_expr(i: int, bld: str):
        key = (i, bld)
        if key not in in_building:
            in_building[key] = sum(v for r, v in y[i].items() if buildings[r] == bld)
        return in_building[key]

    changes = []
    for a, b in sorted(pairs):
        if not y[a] or not y[b]:
            continue
        blds = {buildings[r] for r in y[a]} | {buildings[r] for r in y[b]}
        if len(blds) < 2:
            continue
        c = m.NewBoolVar(f"bchg_{a}_{b}")
        for bld in blds:
            m.Add(c >= b_expr(a, bld) - b_expr(b, bld))
        changes.append(c)
    return changes
