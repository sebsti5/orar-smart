"""solve(setup): analysis → phase 1 (time) → phase 2 (rooms) → validation and score."""

from __future__ import annotations

import time
from typing import Callable

from app.schemas import InstitutionSetup, PlacedLesson, SolveResult, Violation

from .analysis import analyze_index
from .common import KIND_NAMES, SetupIndex, build_index, names, slot_label, subject_name
from .model_soft import add_soft_objectives
from .model_time import TimeModel, pin_key, pins_by_session
from .room_assign import assign_rooms
from .scoring import compute_score
from .sessions import Session, expand_index
from .validate import validate_index

ProgressCb = Callable[[dict], None] | None

TIME_PHASE_SHARE = 0.85
MIN_ROOM_SECONDS = 2.0
DIAGNOSIS_SECONDS = 5.0
RELAX_HINTS = {
    "availability": "disponibilitatea profesorilor este prea restrânsă — extindeți intervalele în care "
                    "profesorii pot preda",
    "pins": "lecțiile fixate manual se blochează reciproc — eliberați câteva fixări",
    "max_per_day": "limita de perechi pe zi este prea strictă — măriți «Maxim perechi pe zi»",
    "rooms": "nu sunt destule săli potrivite în aceleași intervale — adăugați săli sau reduceți "
             "indisponibilitățile",
}


def _emit(progress_cb: ProgressCb, phase: str, message: str, best_penalty: int | None = None) -> None:
    if progress_cb is None:
        return
    event: dict = {"phase": phase, "message": message}
    if best_penalty is not None:
        event["best_penalty"] = best_penalty
    progress_cb(event)


def _filter(sessions: list[Session], group_ids: list[str] | None) -> list[Session]:
    if not group_ids:
        return sessions
    wanted = set(group_ids)
    return [s for s in sessions if wanted.intersection(s.group_ids)]


def _diagnose(idx: SetupIndex, sessions: list[Session], pins: dict) -> str:
    """Find which constraint family, once relaxed, makes the problem feasible."""
    culprits = []
    for family, hint in RELAX_HINTS.items():
        if family == "pins" and not pins:
            continue
        tm = TimeModel(idx, sessions, pins, relax=frozenset({family}))
        if tm.solve(DIAGNOSIS_SECONDS, optimize=False).status in ("optimal", "feasible"):
            culprits.append(hint)
    if culprits:
        return "Cauza probabilă: " + "; ".join(culprits) + "."
    return ("Combinația de constrângeri (profesori, grupe, subgrupe, săli, limite pe zi) nu are soluție. "
            "Verificați grupele și profesorii cei mai încărcați din pasul «Verificare».")


def _infeasible(started: float, sessions: list[Session], message: str) -> SolveResult:
    return SolveResult(status="infeasible", unplaced=[s.id for s in sessions], message=message,
                       solve_seconds=round(time.monotonic() - started, 3))


def _lessons(sessions: list[Session], placements: dict, rooms: dict, pins: dict) -> list[PlacedLesson]:
    out = []
    for i, (d, sl, p) in sorted(placements.items()):
        s = sessions[i]
        out.append(PlacedLesson(
            id=s.id, assignment_id=s.assignment_id, session_index=s.session_index, subject_id=s.subject_id,
            kind=s.kind, teacher_id=s.teacher_id, group_ids=list(s.group_ids), subgroup=s.subgroup,
            day=d, slot=sl, parity=p, room_id=rooms.get(i),
            pinned=pin_key(s.assignment_id, s.session_index, s.subgroup) in pins,
        ))
    return out


def _no_room_violation(idx: SetupIndex, l: PlacedLesson) -> Violation:
    sub = f" subgrupa {l.subgroup}" if l.subgroup else ""
    return Violation(severity="error", code="no_room", lesson_ids=[l.id],
                     message=f"Nu s-a găsit o sală liberă potrivită pentru {subject_name(idx, l.subject_id)} "
                     f"({KIND_NAMES[l.kind]}, {names(idx.groups, l.group_ids)}{sub}), "
                     f"{slot_label(idx, l.day, l.slot)}. Alegeți manual o sală sau adăugați săli.")


def solve(setup: InstitutionSetup, time_limit_s: float = 30, progress_cb: ProgressCb = None, *,
          group_ids: list[str] | None = None) -> SolveResult:
    """Two-phase CP-SAT timetable. `group_ids` optionally restricts to lessons of those groups."""
    started = time.monotonic()
    idx = build_index(setup)
    all_sessions = expand_index(idx)
    sessions = _filter(all_sessions, group_ids)
    analysis = analyze_index(idx, all_sessions)
    errors = [i.message for i in analysis.issues if i.severity == "error"]
    if errors:
        return _infeasible(started, sessions, "Datele au erori care fac orarul imposibil:\n- " + "\n- ".join(errors))
    if not sessions:
        return SolveResult(status="optimal", message="Nu există lecții de planificat.",
                           solve_seconds=round(time.monotonic() - started, 3))
    pins = {k: p for k, p in pins_by_session(setup.pinned).items()
            if any(pin_key(s.assignment_id, s.session_index, s.subgroup) == k for s in sessions)}

    _emit(progress_cb, "time", f"Construiesc modelul pentru {len(sessions)} lecții…")
    tm = TimeModel(idx, sessions, pins)
    add_soft_objectives(tm)
    time_budget = max(1.0, time_limit_s * TIME_PHASE_SHARE)

    def on_solution(n: int, penalty: int) -> None:
        _emit(progress_cb, "time", f"Soluția #{n} găsită, penalizare {penalty}", penalty)

    res = tm.solve(time_budget, on_solution)
    if res.status == "unknown":
        return _infeasible(started, sessions, f"Nu s-a găsit niciun orar în {time_budget:.0f} s. Măriți limita "
                           "de timp sau relaxați constrângerile (disponibilități, maxim perechi pe zi).")
    if res.status == "infeasible":
        _emit(progress_cb, "time", "Nu există soluție; caut cauza…")
        return _infeasible(started, sessions, "Nu există niciun orar care să respecte toate constrângerile. "
                           + _diagnose(idx, sessions, pins))

    _emit(progress_cb, "rooms", "Aloc sălile…", res.objective)
    room_budget = max(MIN_ROOM_SECONDS, time_limit_s - (time.monotonic() - started))
    rooms = assign_rooms(idx, sessions, res.placements, pins, room_budget)
    lessons = _lessons(sessions, res.placements, rooms, pins)
    violations = [v for v in validate_index(idx, lessons) if v.code != "no_room"]
    violations += [_no_room_violation(idx, l) for l in lessons if l.room_id is None]
    score = compute_score(setup, lessons, idx)
    missing = sum(1 for l in lessons if l.room_id is None)
    msg = f"Orar generat: {len(lessons)} lecții, penalizare {score.total_penalty}."
    if missing:
        msg += f" {missing} lecții nu au primit sală."
    _emit(progress_cb, "rooms", msg, score.total_penalty)
    return SolveResult(status=res.status, lessons=lessons, violations=violations, score=score, message=msg,
                       solve_seconds=round(time.monotonic() - started, 3))
