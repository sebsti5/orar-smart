"""Phase 1: CP-SAT model placing every session on a (day, slot[, parity])."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable

from ortools.sat.python import cp_model

from app.schemas import PinnedLesson

from .common import SetupIndex, Unit, group_units, teacher_available
from .rooms import room_sets
from .sessions import Session

Cell = tuple[int, int]
RELAXABLE = ("availability", "pins", "max_per_day", "rooms")
NUM_WORKERS = 8


@dataclass
class TimeResult:
    status: str  # "optimal" | "feasible" | "infeasible" | "unknown"
    placements: dict[int, tuple[int, int, str]] = field(default_factory=dict)  # i -> (day, slot, parity)
    objective: int | None = None


def pin_key(assignment_id: str, index: int, subgroup: int | None) -> tuple[str, int, int | None]:
    return assignment_id, index, subgroup


def pins_by_session(pins: list[PinnedLesson]) -> dict[tuple, PinnedLesson]:
    return {pin_key(p.assignment_id, p.session_index, p.subgroup): p for p in pins}


class TimeModel:
    """Builds the time-assignment model. Soft terms are added by model_soft."""

    def __init__(self, idx: SetupIndex, sessions: list[Session], pins: dict[tuple, PinnedLesson],
                 relax: frozenset[str] = frozenset()):
        self.idx, self.sessions, self.pins, self.relax = idx, sessions, pins, relax
        self.m = cp_model.CpModel()
        # cells[i][(d, s)] -> list of (parity, var); parity "all" for weekly sessions
        self.cells: list[dict[Cell, list[tuple[str, cp_model.IntVar]]]] = []
        self.objective: list = []
        self.group_occ: dict[str, dict[Cell, cp_model.IntVar]] = {}
        self._build_vars()
        self._hard_constraints()

    # ------------------------------------------------------------------ vars
    def allowed_cells(self, s: Session) -> list[Cell]:
        pin = self.pins.get(pin_key(s.assignment_id, s.session_index, s.subgroup))
        if pin is not None and "pins" not in self.relax:
            return [(pin.day, pin.slot)]
        teacher = self.idx.teachers.get(s.teacher_id)
        return [(d, sl) for d, sl in self.idx.slots_grid()
                if "availability" in self.relax or teacher_available(teacher, d, sl)]

    def _build_vars(self) -> None:
        for i, s in enumerate(self.sessions):
            cells: dict[Cell, list] = {}
            parities = ("odd", "even") if s.biweekly else ("all",)
            for d, sl in self.allowed_cells(s):
                cells[(d, sl)] = [(p, self.m.NewBoolVar(f"x{i}_{d}_{sl}_{p}")) for p in parities]
            self.cells.append(cells)
            self.m.AddExactlyOne(v for lst in cells.values() for _, v in lst)

    def all_vars(self, i: int) -> list[tuple[Cell, str, cp_model.IntVar]]:
        return [(c, p, v) for c, lst in self.cells[i].items() for p, v in lst]

    def vars_at(self, members: list[int], cell: Cell) -> list[cp_model.IntVar]:
        return [v for i in members for _, v in self.cells[i].get(cell, ())]

    def parity_terms(self, members: list[int], cell: Cell) -> tuple[list, list, bool]:
        """(odd-week vars, even-week vars, any biweekly?) of members at a cell."""
        odd, even, bi = [], [], False
        for i in members:
            for p, v in self.cells[i].get(cell, ()):
                if p != "even":
                    odd.append(v)
                if p != "odd":
                    even.append(v)
                bi = bi or p != "all"
        return odd, even, bi

    def at_most(self, members: list[int], cell: Cell, cap: int) -> None:
        odd, even, bi = self.parity_terms(members, cell)
        if len(odd) > cap:
            self.m.Add(sum(odd) <= cap)
        if bi and len(even) > cap:
            self.m.Add(sum(even) <= cap)

    # ------------------------------------------------------------------ hard
    def resources(self) -> tuple[dict[str, list[int]], dict[Unit, list[int]], dict[str, list[int]]]:
        teachers: dict[str, list[int]] = defaultdict(list)
        units: dict[Unit, list[int]] = defaultdict(list)
        groups: dict[str, list[int]] = defaultdict(list)
        for i, s in enumerate(self.sessions):
            teachers[s.teacher_id].append(i)
            for u in group_units(self.idx, s.group_ids, s.subgroup):
                units[u].append(i)
            for g in s.group_ids:
                groups[g].append(i)
        return teachers, units, groups

    def _hard_constraints(self) -> None:
        teachers, units, groups = self.resources()
        grid = self.idx.slots_grid()
        for members in list(teachers.values()) + list(units.values()):
            if len(members) > 1:
                for cell in grid:
                    self.at_most(members, cell, 1)
        for gid, members in groups.items():
            self.group_occ[gid] = {c: self.occupancy(members, c, f"g{gid}") for c in grid}
        if "max_per_day" not in self.relax:
            cap = self.idx.setup.general.max_lessons_per_day
            for occ in self.group_occ.values():
                for d in range(self.idx.n_days):
                    day = [occ[(d, s)] for s in range(self.idx.n_slots) if occ[(d, s)] is not None]
                    if len(day) > cap:
                        self.m.Add(sum(day) <= cap)
        if "rooms" not in self.relax:
            self._room_capacity()
        self._symmetry()

    def occupancy(self, members: list[int], cell: Cell, tag: str) -> cp_model.IntVar | None:
        """Bool that is 1 iff any member occupies the cell (any parity); None if impossible."""
        vs = self.vars_at(members, cell)
        if not vs:
            return None
        if len(vs) == 1:
            return vs[0]
        occ = self.m.NewBoolVar(f"occ_{tag}_{cell[0]}_{cell[1]}")
        self.m.AddMaxEquality(occ, vs)
        return occ

    def _room_capacity(self) -> None:
        """Hall condition per eligible-room set, cell and parity."""
        sets, _homeless = room_sets(self.sessions, self.idx.setup.rooms)
        for rs in sets:
            members = list(rs.members)
            for cell in self.idx.slots_grid():
                free = self.idx.free_rooms(rs.rooms, *cell)
                if sum(1 for i in members if cell in self.cells[i]) > free:
                    self.at_most(members, cell, free)

    def _symmetry(self) -> None:
        """Interchangeable sessions of one assignment/subgroup are placed in time order."""
        chains: dict[tuple, list[int]] = defaultdict(list)
        for i, s in enumerate(self.sessions):
            chains[(s.assignment_id, s.subgroup, s.biweekly)].append(i)
        n_slots = self.idx.n_slots
        for members in chains.values():
            if len(members) < 2 or any(len(self.cells[i]) == 1 for i in members):
                continue
            times = [sum((d * n_slots + s) * v for (d, s), _, v in self.all_vars(i)) for i in members]
            for a, b in zip(times, times[1:]):
                self.m.Add(a < b)

    # ------------------------------------------------------------------ solve
    def solve(self, time_limit_s: float, on_solution: Callable[[int, int], None] | None = None,
              optimize: bool = True) -> TimeResult:
        if optimize and self.objective:
            self.m.Minimize(sum(self.objective))
        solver = cp_model.CpSolver()
        solver.parameters.num_workers = NUM_WORKERS
        solver.parameters.max_time_in_seconds = max(0.5, float(time_limit_s))
        callback = _Callback(on_solution) if on_solution else None
        code = solver.Solve(self.m, callback)
        if code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            placements = {}
            for i in range(len(self.sessions)):
                for (d, s), p, v in self.all_vars(i):
                    if solver.BooleanValue(v):
                        placements[i] = (d, s, p)
            status = "optimal" if code == cp_model.OPTIMAL else "feasible"
            obj = int(round(solver.ObjectiveValue())) if optimize and self.objective else 0
            return TimeResult(status=status, placements=placements, objective=obj)
        return TimeResult(status="infeasible" if code == cp_model.INFEASIBLE else "unknown")


class _Callback(cp_model.CpSolverSolutionCallback):
    def __init__(self, fn: Callable[[int, int], None]):
        super().__init__()
        self.fn, self.count = fn, 0

    def on_solution_callback(self) -> None:
        self.count += 1
        self.fn(self.count, int(round(self.ObjectiveValue())))
