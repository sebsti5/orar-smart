"""validate(setup, lessons): list every hard-constraint violation of a timetable."""

from __future__ import annotations

from collections import defaultdict
from itertools import combinations

from app.schemas import InstitutionSetup, PlacedLesson, Violation

from .common import (
    KIND_NAMES,
    SetupIndex,
    build_index,
    day_name,
    group_units,
    names,
    parities_overlap,
    slot_label,
    subject_name,
    teacher_available,
    teacher_name,
)
from .rooms import room_problems
from .sessions import room_requirements, seats_for


def _v(code: str, message: str, lesson_ids: list[str], severity: str = "error") -> Violation:
    return Violation(severity=severity, code=code, message=message, lesson_ids=lesson_ids)


def describe(idx: SetupIndex, l: PlacedLesson) -> str:
    sub = f" subgrupa {l.subgroup}" if l.subgroup else ""
    return f"{subject_name(idx, l.subject_id)} ({KIND_NAMES.get(l.kind, l.kind)}, {names(idx.groups, l.group_ids)}{sub})"


def _in_grid(idx: SetupIndex, l: PlacedLesson) -> bool:
    return 0 <= l.day < idx.n_days and 0 <= l.slot < idx.n_slots


def _check_refs(idx: SetupIndex, l: PlacedLesson) -> list[Violation]:
    missing = []
    if l.teacher_id not in idx.teachers:
        missing.append(f"profesorul «{l.teacher_id}»")
    if l.subject_id not in idx.subjects:
        missing.append(f"disciplina «{l.subject_id}»")
    missing += [f"grupa «{g}»" for g in l.group_ids if g not in idx.groups]
    if l.room_id is not None and l.room_id not in idx.rooms:
        missing.append(f"sala «{l.room_id}»")
    if not missing:
        return []
    return [_v("unknown_reference", f"Lecția {describe(idx, l)} folosește {', '.join(missing)}, "
               "care nu mai există. Mutați sau regenerați lecția.", [l.id])]


def _check_placement(idx: SetupIndex, l: PlacedLesson) -> list[Violation]:
    if not _in_grid(idx, l):
        return [_v("out_of_range", f"Lecția {describe(idx, l)} este în afara grilei orare "
                   f"(ziua {l.day + 1}, perechea {l.slot + 1}).", [l.id])]
    out: list[Violation] = []
    where = slot_label(idx, l.day, l.slot)
    if l.teacher_id in idx.teachers and not teacher_available(idx.teachers[l.teacher_id], l.day, l.slot):
        out.append(_v("teacher_unavailable", f"Profesorul {teacher_name(idx, l.teacher_id)} nu este disponibil "
                      f"{where} ({describe(idx, l)}).", [l.id]))
    out.extend(_check_room(idx, l, where))
    return out


def _check_room(idx: SetupIndex, l: PlacedLesson, where: str) -> list[Violation]:
    if l.room_id is None:
        return [_v("no_room", f"Lecția {describe(idx, l)} din {where} nu are sală. Alegeți o sală liberă "
                   "potrivită sau adăugați săli.", [l.id])]
    room = idx.rooms.get(l.room_id)
    if room is None:
        return []
    out: list[Violation] = []
    if l.room_id in idx.room_unavailable.get((l.day, l.slot), frozenset()):
        out.append(_v("room_unavailable", f"Sala {room.name} nu este disponibilă {where} ({describe(idx, l)}).",
                      [l.id]))
    kinds, tag = room_requirements(idx.subjects.get(l.subject_id), l.kind)
    seats = seats_for(idx, l.group_ids, l.subgroup)
    problems = room_problems(room, kinds, tag, seats)
    if "room_wrong_kind" in problems:
        need = f" cu eticheta «{tag}»" if tag else ""
        out.append(_v("room_wrong_kind", f"Sala {room.name} nu este potrivită pentru {describe(idx, l)}: e nevoie de o "
                      f"sală de tip {KIND_NAMES.get(l.kind, l.kind)}{need}.", [l.id]))
    if "room_too_small" in problems:
        out.append(_v("room_too_small", f"Sala {room.name} are {room.capacity} locuri, dar {describe(idx, l)} "
                      f"are nevoie de {seats}.", [l.id]))
    return out


def _check_pair(idx: SetupIndex, a: PlacedLesson, b: PlacedLesson) -> list[Violation]:
    if not parities_overlap(a.parity, b.parity):
        return []
    where = slot_label(idx, a.day, a.slot)
    both = f"{describe(idx, a)}; {describe(idx, b)}"
    ids = [a.id, b.id]
    out: list[Violation] = []
    if a.teacher_id == b.teacher_id:
        out.append(_v("teacher_clash", f"Profesorul {teacher_name(idx, a.teacher_id)} are două lecții "
                      f"simultan: {where} ({both}).", ids))
    shared = group_units(idx, a.group_ids, a.subgroup) & group_units(idx, b.group_ids, b.subgroup)
    if shared:
        gnames = names(idx.groups, sorted({g for g, _ in shared}))
        out.append(_v("group_clash", f"Grupa {gnames} are două lecții simultan: {where} ({both}).", ids))
    if a.room_id is not None and a.room_id == b.room_id:
        room = idx.rooms.get(a.room_id)
        out.append(_v("room_clash", f"Sala {room.name if room else a.room_id} este ocupată de două lecții: "
                      f"{where} ({both}).", ids))
    return out


def _check_max_per_day(idx: SetupIndex, lessons: list[PlacedLesson]) -> list[Violation]:
    max_day = idx.setup.general.max_lessons_per_day
    by_group_day: dict[tuple[str, int], list[PlacedLesson]] = defaultdict(list)
    for l in lessons:
        for gid in l.group_ids:
            if gid in idx.groups:
                by_group_day[(gid, l.day)].append(l)
    out: list[Violation] = []
    for (gid, day), ls in sorted(by_group_day.items()):
        used = len({l.slot for l in ls})
        if used > max_day:
            out.append(_v("max_per_day", f"Grupa {idx.groups[gid].name} are {used} perechi {day_name(day)}, peste "
                          f"maximul de {max_day} pe zi.", [l.id for l in ls]))
    return out


def validate_index(idx: SetupIndex, lessons: list[PlacedLesson]) -> list[Violation]:
    out: list[Violation] = []
    by_slot: dict[tuple[int, int], list[PlacedLesson]] = defaultdict(list)
    for l in lessons:
        out.extend(_check_refs(idx, l))
        out.extend(_check_placement(idx, l))
        by_slot[(l.day, l.slot)].append(l)
    for (day, slot), ls in sorted(by_slot.items()):
        for a, b in combinations(ls, 2):
            out.extend(_check_pair(idx, a, b))
    out.extend(_check_max_per_day(idx, lessons))
    return out


def validate(setup: InstitutionSetup, lessons: list[PlacedLesson]) -> list[Violation]:
    """Detect every hard-constraint violation; messages are Romanian and name the lessons."""
    return validate_index(build_index(setup), lessons)
