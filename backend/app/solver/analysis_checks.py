"""Structural pre-checks: ids, references, pins, coverage, streams, capabilities."""

from __future__ import annotations

from collections import Counter

from app.schemas import Issue

from .common import KIND_NAMES, SetupIndex, slot_label, teacher_available
from .sessions import assignment_hours, split_hours, subgroup_count


def _err(code: str, message: str, entity: str | None = None, entity_id: str | None = None) -> Issue:
    return Issue(severity="error", code=code, message=message, entity=entity, entity_id=entity_id)


def _warn(code: str, message: str, entity: str | None = None, entity_id: str | None = None) -> Issue:
    return Issue(severity="warning", code=code, message=message, entity=entity, entity_id=entity_id)


ENTITY_LABELS = {
    "programs": ("program", "programul"), "groups": ("group", "grupa"), "rooms": ("room", "sala"),
    "teachers": ("teacher", "profesorul"), "subjects": ("subject", "disciplina"),
    "streams": ("stream", "seria"), "assignments": ("assignment", "repartizarea"),
}


def check_duplicates(idx: SetupIndex) -> list[Issue]:
    out: list[Issue] = []
    for attr, (entity, label) in ENTITY_LABELS.items():
        counts = Counter(x.id for x in getattr(idx.setup, attr))
        for dup, n in counts.items():
            if n > 1:
                out.append(_err("duplicate_id", f"Id-ul «{dup}» este folosit de {n} ori pentru {label}. "
                                "Fiecare element trebuie să aibă un id unic.", entity, dup))
    return out


def _missing(kind_label: str, ref: str, owner: str, entity: str, entity_id: str) -> Issue:
    return _err("dangling_reference", f"{owner} face referire la {kind_label} inexistent(ă) «{ref}». "
                "Corectați sau ștergeți referința.", entity, entity_id)


def check_references(idx: SetupIndex) -> list[Issue]:
    s = idx.setup
    out: list[Issue] = []
    for g in s.groups:
        if g.program_id not in idx.programs:
            out.append(_missing("programul", g.program_id, f"Grupa {g.name}", "group", g.id))
    for sub in s.subjects:
        if sub.program_id not in idx.programs:
            out.append(_missing("programul", sub.program_id, f"Disciplina {sub.name}", "subject", sub.id))
    for st in s.streams:
        for gid in st.group_ids:
            if gid not in idx.groups:
                out.append(_missing("grupa", gid, f"Seria {st.name}", "stream", st.id))
    for u in s.room_unavailability:
        if u.room_id not in idx.rooms:
            out.append(_missing("sala", u.room_id, "O indisponibilitate de sală", "room", u.room_id))
    for t in s.teachers:
        for cap in t.capabilities:
            if cap.subject_id not in idx.subjects:
                out.append(_warn("dangling_capability", f"Profesorul {t.name} are o competență pentru "
                                 f"disciplina inexistentă «{cap.subject_id}».", "teacher", t.id))
    for a in s.assignments:
        owner = f"Repartizarea {a.id}"
        if a.subject_id not in idx.subjects:
            out.append(_missing("disciplina", a.subject_id, owner, "assignment", a.id))
        if a.teacher_id not in idx.teachers:
            out.append(_missing("profesorul", a.teacher_id, owner, "assignment", a.id))
        if not a.group_ids:
            out.append(_err("dangling_reference", f"{owner} nu are nicio grupă.", "assignment", a.id))
        for gid in a.group_ids:
            if gid not in idx.groups:
                out.append(_missing("grupa", gid, owner, "assignment", a.id))
    return out


def check_parity(idx: SetupIndex) -> list[Issue]:
    if idx.setup.general.week_parity:
        return []
    out: list[Issue] = []
    for a in idx.setup.assignments:
        subject = idx.subjects.get(a.subject_id)
        if subject and split_hours(assignment_hours(subject, a))[1]:
            out.append(_err("half_hours_without_parity",
                            f"{subject.name} ({KIND_NAMES[a.kind]}) are {assignment_hours(subject, a)} "
                            "perechi/săptămână, dar săptămânile pară/impară sunt dezactivate. Activați "
                            "«Săptămâni pare/impare» sau folosiți ore întregi.", "assignment", a.id))
    return out


def _pin_error(idx: SetupIndex, pin) -> str | None:
    a = idx.assignments.get(pin.assignment_id)
    if a is None or a.subject_id not in idx.subjects:
        return f"Lecția fixată face referire la repartizarea inexistentă «{pin.assignment_id}»."
    subject = idx.subjects[a.subject_id]
    name = f"{subject.name} ({KIND_NAMES[a.kind]})"
    n = sum(split_hours(assignment_hours(subject, a)))
    if not 0 <= pin.session_index < n:
        return f"Lecția fixată {name} are indicele {pin.session_index}, dar există doar {n} ședințe."
    groups = tuple(g for g in a.group_ids if g in idx.groups)
    n_sub = subgroup_count(idx, subject, a, groups) if groups else 0
    if (pin.subgroup is None) != (n_sub == 0) or (pin.subgroup and pin.subgroup > n_sub):
        return f"Lecția fixată {name} are o subgrupă greșită ({pin.subgroup})."
    if not (0 <= pin.day < idx.n_days and 0 <= pin.slot < idx.n_slots):
        return f"Lecția fixată {name} este în afara grilei orare (ziua {pin.day + 1}, perechea {pin.slot + 1})."
    if not teacher_available(idx.teachers.get(a.teacher_id), pin.day, pin.slot):
        return (f"Lecția fixată {name} este pusă {slot_label(idx, pin.day, pin.slot)}, când profesorul "
                "nu este disponibil.")
    if pin.room_id is not None and pin.room_id not in idx.rooms:
        return f"Lecția fixată {name} folosește sala inexistentă «{pin.room_id}»."
    return None


def check_pins(idx: SetupIndex) -> list[Issue]:
    out: list[Issue] = []
    seen: Counter = Counter()
    for pin in idx.setup.pinned:
        msg = _pin_error(idx, pin)
        if msg:
            out.append(_err("pin_invalid", msg + " Mutați sau eliminați fixarea.", "assignment", pin.assignment_id))
        seen[(pin.assignment_id, pin.session_index, pin.subgroup)] += 1
    for key, n in seen.items():
        if n > 1:
            out.append(_err("pin_invalid", f"Aceeași lecție ({key[0]}) este fixată de {n} ori.",
                            "assignment", key[0]))
    return out


def check_coverage(idx: SetupIndex) -> list[Issue]:
    """Subjects nobody teaches and groups missing a subject×kind."""
    covered: Counter = Counter()
    assigned_subjects = set()
    for a in idx.setup.assignments:
        assigned_subjects.add(a.subject_id)
        for gid in a.group_ids:
            covered[(a.subject_id, a.kind, gid)] += 1
    out: list[Issue] = []
    for sub in idx.setup.subjects:
        kinds = [k for k in ("lecture", "seminar", "lab") if getattr(sub, f"{k}_per_week") > 0]
        groups = [g for g in idx.setup.groups if g.program_id == sub.program_id and g.year == sub.year]
        if not kinds or not groups:
            continue
        if sub.id not in assigned_subjects:
            out.append(_warn("subject_unassigned", f"Disciplina {sub.name} (anul {sub.year}) nu are niciun "
                             "profesor repartizat. Folosiți «Completează automat» la Repartizare.",
                             "subject", sub.id))
            continue
        for g in groups:
            for k in kinds:
                n = covered[(sub.id, k, g.id)]
                if n == 0:
                    out.append(_warn("missing_coverage", f"Grupa {g.name} nu are {KIND_NAMES[k]} la "
                                     f"{sub.name}. Adăugați o repartizare sau folosiți «Completează automat».",
                                     "group", g.id))
                elif n > 1:
                    out.append(_warn("duplicate_coverage", f"Grupa {g.name} are {n} repartizări de "
                                     f"{KIND_NAMES[k]} la {sub.name}; orele se vor dubla.", "group", g.id))
    return out


def check_streams(idx: SetupIndex) -> list[Issue]:
    out: list[Issue] = []
    for st in idx.setup.streams:
        groups = [idx.groups[g] for g in st.group_ids if g in idx.groups]
        if len({(g.program_id, g.year) for g in groups}) > 1:
            out.append(_warn("stream_mixed", f"Seria {st.name} conține grupe din programe sau ani diferiți "
                             f"({', '.join(g.name for g in groups)}). Verificați dacă e intenționat.",
                             "stream", st.id))
    return out


def check_assignment_fit(idx: SetupIndex) -> list[Issue]:
    out: list[Issue] = []
    for a in idx.setup.assignments:
        t, sub = idx.teachers.get(a.teacher_id), idx.subjects.get(a.subject_id)
        if t is None or sub is None:
            continue
        caps = {(c.subject_id, k) for c in t.capabilities for k in c.kinds}
        if (a.subject_id, a.kind) not in caps:
            out.append(_warn("teacher_not_capable", f"Profesorul {t.name} predă {KIND_NAMES[a.kind]} la "
                             f"{sub.name}, dar nu are această competență bifată.", "teacher", t.id))
        if assignment_hours(sub, a) <= 0:
            out.append(_warn("assignment_no_hours", f"Repartizarea de {KIND_NAMES[a.kind]} la {sub.name} "
                             "are 0 ore pe săptămână și va fi ignorată.", "assignment", a.id))
        for gid in a.group_ids:
            g = idx.groups.get(gid)
            if g and (g.program_id, g.year) != (sub.program_id, sub.year):
                out.append(_warn("assignment_group_mismatch", f"Grupa {g.name} primește {sub.name}, "
                                 "disciplină din alt program sau an.", "assignment", a.id))
    return out
