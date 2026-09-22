"""auto_assign(setup): fill missing subject×kind×group coverage with capable teachers."""

from __future__ import annotations

from collections import defaultdict

from app.schemas import Assignment, InstitutionSetup, LessonKind, Subject

from .common import SetupIndex, available_slot_count, build_index
from .sessions import assignment_hours, subgroup_count

KINDS: tuple[LessonKind, ...] = ("lecture", "seminar", "lab")


def _load(idx: SetupIndex, a: Assignment) -> float:
    subject = idx.subjects.get(a.subject_id)
    if subject is None:
        return 0.0
    groups = tuple(g for g in a.group_ids if g in idx.groups)
    return assignment_hours(subject, a) * max(1, subgroup_count(idx, subject, a, groups) if groups else 1)


class _Planner:
    def __init__(self, idx: SetupIndex):
        self.idx = idx
        self.assignments = list(idx.setup.assignments)
        self.load: dict[str, float] = defaultdict(float)
        self.covered: set[tuple[str, str, str]] = set()
        self.ids = {a.id for a in self.assignments}
        for a in self.assignments:
            self.load[a.teacher_id] += _load(idx, a)
            self.covered.update((a.subject_id, a.kind, g) for g in a.group_ids)
        self.capacity = {t.id: float(t.max_pairs_per_week or available_slot_count(idx, t))
                         for t in idx.setup.teachers}

    def _new_id(self, subject: Subject, kind: str) -> str:
        base = f"auto_{subject.id}_{kind}"
        n = 1
        while f"{base}_{n}" in self.ids:
            n += 1
        self.ids.add(f"{base}_{n}")
        return f"{base}_{n}"

    def _pick_teacher(self, subject: Subject, kind: str, extra: float) -> str | None:
        capable = [t for t in self.idx.setup.teachers
                   if any(c.subject_id == subject.id and kind in c.kinds for c in t.capabilities)]
        if not capable:
            return None
        return min(capable, key=lambda t: (self.load[t.id] + extra) / max(self.capacity[t.id], 1.0)).id

    def _units(self, subject: Subject, kind: str, missing: list[str]) -> list[list[str]]:
        """Lectures go to whole streams (restricted to missing groups), the rest per group."""
        if kind != "lecture":
            return [[g] for g in missing]
        units, taken = [], set()
        for gid in missing:
            if gid in taken:
                continue
            stream = next((st for st in self.idx.setup.streams if gid in st.group_ids), None)
            unit = [g for g in stream.group_ids if g in missing and g not in taken] if stream else [gid]
            taken.update(unit)
            units.append(unit)
        return units

    def fill(self, subject: Subject) -> None:
        groups = [g.id for g in self.idx.setup.groups
                  if g.program_id == subject.program_id and g.year == subject.year]
        for kind in KINDS:
            if getattr(subject, f"{kind}_per_week") <= 0:
                continue
            missing = [g for g in groups if (subject.id, kind, g) not in self.covered]
            for unit in self._units(subject, kind, missing):
                draft = Assignment(id="draft", subject_id=subject.id, kind=kind, teacher_id="", group_ids=unit)
                extra = _load(self.idx, draft)
                teacher = self._pick_teacher(subject, kind, extra)
                if teacher is None:
                    continue
                self.assignments.append(draft.model_copy(update={
                    "id": self._new_id(subject, kind), "teacher_id": teacher}))
                self.load[teacher] += extra
                self.covered.update((subject.id, kind, g) for g in unit)


def auto_assign(setup: InstitutionSetup) -> list[Assignment]:
    """Return existing assignments plus new ones covering every missing subject×kind×group."""
    planner = _Planner(build_index(setup))
    for subject in setup.subjects:
        planner.fill(subject)
    return planner.assignments
