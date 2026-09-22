"""Lookup index and small helpers shared by every solver module."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from app.schemas import Assignment, Group, InstitutionSetup, Program, Room, Subject, Teacher

DAY_NAMES = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"]
KIND_NAMES = {"lecture": "curs", "seminar": "seminar", "lab": "laborator"}
KIND_PLURAL = {"lecture": "cursuri", "seminar": "seminare", "lab": "laboratoare"}

Unit = tuple[str, int]  # (group_id, subgroup number 1..n)


@dataclass(frozen=True)
class SetupIndex:
    """Read-only id → entity maps plus the time grid size."""

    setup: InstitutionSetup
    groups: dict[str, Group]
    rooms: dict[str, Room]
    teachers: dict[str, Teacher]
    subjects: dict[str, Subject]
    programs: dict[str, Program]
    assignments: dict[str, Assignment]
    n_days: int
    n_slots: int
    room_unavailable: dict[tuple[int, int], frozenset[str]] = field(default_factory=dict)

    def slots_grid(self) -> list[tuple[int, int]]:
        return [(d, s) for d in range(self.n_days) for s in range(self.n_slots)]

    def free_rooms(self, room_ids: Iterable[str], day: int, slot: int) -> int:
        blocked = self.room_unavailable.get((day, slot), frozenset())
        return sum(1 for r in room_ids if r not in blocked)


def build_index(setup: InstitutionSetup) -> SetupIndex:
    blocked: dict[tuple[int, int], set[str]] = {}
    for u in setup.room_unavailability:
        blocked.setdefault((u.day, u.slot), set()).add(u.room_id)
    return SetupIndex(
        setup=setup,
        groups={g.id: g for g in setup.groups},
        rooms={r.id: r for r in setup.rooms},
        teachers={t.id: t for t in setup.teachers},
        subjects={s.id: s for s in setup.subjects},
        programs={p.id: p for p in setup.programs},
        assignments={a.id: a for a in setup.assignments},
        n_days=setup.general.days_per_week,
        n_slots=len(setup.general.slots),
        room_unavailable={k: frozenset(v) for k, v in blocked.items()},
    )


def teacher_available(teacher: Teacher | None, day: int, slot: int) -> bool:
    """Empty availability = always available; missing cells count as available."""
    if teacher is None or not teacher.availability:
        return True
    if day >= len(teacher.availability):
        return True
    row = teacher.availability[day]
    return slot >= len(row) or bool(row[slot])


def available_slot_count(idx: SetupIndex, teacher: Teacher) -> int:
    return sum(1 for d, s in idx.slots_grid() if teacher_available(teacher, d, s))


def group_units(idx: SetupIndex, group_ids: Iterable[str], subgroup: int | None) -> frozenset[Unit]:
    """Resource units a lesson occupies: whole group = all its subgroups."""
    units: set[Unit] = set()
    for gid in group_ids:
        g = idx.groups.get(gid)
        if g is None:
            continue
        if subgroup is None:
            units.update((gid, k) for k in range(1, g.subgroups + 1))
        elif subgroup <= g.subgroups:
            units.add((gid, subgroup))
    return frozenset(units)


def parities_overlap(a: str, b: str) -> bool:
    return a == "all" or b == "all" or a == b


def fmt_num(x: float) -> str:
    """Romanian number formatting: 14 → "14", 14.5 → "14,5"."""
    if abs(x - round(x)) < 1e-9:
        return str(int(round(x)))
    return f"{x:.1f}".replace(".", ",")


def day_name(day: int) -> str:
    return DAY_NAMES[day] if 0 <= day < len(DAY_NAMES) else f"ziua {day + 1}"


def slot_label(idx: SetupIndex, day: int, slot: int) -> str:
    slots = idx.setup.general.slots
    start = f" ({slots[slot].start})" if 0 <= slot < len(slots) else ""
    return f"{day_name(day)}, perechea {slot + 1}{start}"


def names(entities: dict, ids: Iterable[str]) -> str:
    return ", ".join(getattr(entities.get(i), "name", i) for i in ids)


def teacher_name(idx: SetupIndex, teacher_id: str) -> str:
    t = idx.teachers.get(teacher_id)
    return t.name if t else teacher_id


def subject_name(idx: SetupIndex, subject_id: str) -> str:
    s = idx.subjects.get(subject_id)
    return s.name if s else subject_id
