"""Expand assignments into concrete weekly/biweekly sessions."""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.schemas import Assignment, InstitutionSetup, LessonKind, RoomKind, Subject

from .common import SetupIndex, build_index

ROOM_KINDS_FOR: dict[str, tuple[RoomKind, ...]] = {
    "lecture": ("lecture", "any"),
    "seminar": ("seminar", "lecture", "any"),
    "lab": ("lab", "any"),
}
TAGGED_LAB_KINDS: tuple[RoomKind, ...] = ("lab", "sport", "any")


@dataclass(frozen=True)
class Session:
    """One lesson occurrence to place: weekly, or every other week if biweekly."""

    id: str
    assignment_id: str
    session_index: int
    subject_id: str
    kind: LessonKind
    teacher_id: str
    group_ids: tuple[str, ...]
    subgroup: int | None
    biweekly: bool
    seats: int
    room_kinds: tuple[RoomKind, ...]
    room_tag: str | None

    @property
    def weight(self) -> float:
        """Pairs per week this session represents."""
        return 0.5 if self.biweekly else 1.0


def session_id(assignment_id: str, index: int, subgroup: int | None) -> str:
    return f"{assignment_id}#{index}" + (f"#s{subgroup}" if subgroup else "")


def assignment_hours(subject: Subject, a: Assignment) -> float:
    if a.per_week is not None:
        return a.per_week
    return {"lecture": subject.lecture_per_week, "seminar": subject.seminar_per_week,
            "lab": subject.lab_per_week}[a.kind]


def split_hours(hours: float) -> tuple[int, int]:
    """Return (weekly sessions, biweekly sessions) with hours rounded to halves."""
    halves = int(round(hours * 2))
    return halves // 2, halves % 2


def room_requirements(subject: Subject | None, kind: str) -> tuple[tuple[RoomKind, ...], str | None]:
    tag = subject.lab_room_tag if subject and kind == "lab" else None
    if tag:
        return TAGGED_LAB_KINDS, tag
    return ROOM_KINDS_FOR[kind], None


def seats_for(idx: SetupIndex, group_ids: tuple[str, ...] | list[str], subgroup: int | None) -> int:
    total = 0
    for gid in group_ids:
        g = idx.groups.get(gid)
        if g is None:
            continue
        if subgroup is None:
            total += g.students
        elif subgroup <= g.subgroups:
            total += math.ceil(g.students / g.subgroups)
    return total


def subgroup_count(idx: SetupIndex, subject: Subject, a: Assignment, group_ids: tuple[str, ...]) -> int:
    """Number of subgroup sessions per lab slot; 0 means the lab is not split."""
    if a.kind != "lab" or not subject.lab_split_subgroups:
        return 0
    most = max((idx.groups[g].subgroups for g in group_ids), default=1)
    return most if most > 1 else 0


def _assignment_sessions(idx: SetupIndex, a: Assignment) -> list[Session]:
    subject = idx.subjects.get(a.subject_id)
    group_ids = tuple(g for g in a.group_ids if g in idx.groups)
    if subject is None or not group_ids:
        return []
    weekly, biweekly = split_hours(assignment_hours(subject, a))
    kinds, tag = room_requirements(subject, a.kind)
    n_sub = subgroup_count(idx, subject, a, group_ids)
    subgroups: list[int | None] = list(range(1, n_sub + 1)) if n_sub else [None]
    out: list[Session] = []
    for i in range(weekly + biweekly):
        for sub in subgroups:
            out.append(Session(
                id=session_id(a.id, i, sub),
                assignment_id=a.id,
                session_index=i,
                subject_id=a.subject_id,
                kind=a.kind,
                teacher_id=a.teacher_id,
                group_ids=group_ids,
                subgroup=sub,
                biweekly=i >= weekly,
                seats=seats_for(idx, group_ids, sub),
                room_kinds=kinds,
                room_tag=tag,
            ))
    return out


def expand_index(idx: SetupIndex) -> list[Session]:
    out: list[Session] = []
    for a in idx.setup.assignments:
        out.extend(_assignment_sessions(idx, a))
    return out


def expand_sessions(setup: InstitutionSetup) -> list[Session]:
    """Every assignment → ⌊h⌋ weekly + (1 biweekly if h has .5) sessions, per subgroup for split labs."""
    return expand_index(build_index(setup))
