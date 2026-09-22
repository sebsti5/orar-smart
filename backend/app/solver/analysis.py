"""analyze(setup): pre-flight checks and load statistics before solving."""

from __future__ import annotations

from collections import defaultdict

from app.schemas import Analysis, InstitutionSetup, Issue, LoadStat

from . import analysis_checks as checks
from .common import KIND_NAMES, SetupIndex, available_slot_count, build_index, fmt_num, names
from .rooms import room_sets, weekly_room_capacity
from .sessions import Session, expand_index


def _teacher_loads(idx: SetupIndex, sessions: list[Session]) -> tuple[list[LoadStat], list[Issue]]:
    load: dict[str, float] = defaultdict(float)
    for s in sessions:
        load[s.teacher_id] += s.weight
    stats, issues = [], []
    for t in idx.setup.teachers:
        req, avail = load.get(t.id, 0.0), available_slot_count(idx, t)
        cap = min(avail, t.max_pairs_per_week) if t.max_pairs_per_week else avail
        stats.append(LoadStat(entity="teacher", entity_id=t.id, name=t.name, required=req, capacity=cap))
        if req > avail:
            issues.append(Issue(severity="error", code="teacher_overloaded", entity="teacher", entity_id=t.id,
                                message=f"Profesorul {t.name} are {fmt_num(req)} perechi/săptămână dar e "
                                f"disponibil doar {avail} sloturi. Extindeți disponibilitatea sau mutați "
                                "o parte din ore la alt profesor."))
        elif t.max_pairs_per_week and req > t.max_pairs_per_week:
            issues.append(Issue(severity="warning", code="teacher_over_max_pairs", entity="teacher",
                                entity_id=t.id, message=f"Profesorul {t.name} are {fmt_num(req)} perechi/"
                                f"săptămână, peste maximul declarat de {t.max_pairs_per_week}."))
    return stats, issues


def group_requirement(idx: SetupIndex, gid: str, sessions: list[Session]) -> float:
    """Lower bound on the slots a group needs.

    Whole-group sessions + subgroup sessions, which can run in parallel only if
    they are in different subgroups AND taught by different teachers.
    """
    whole, per_sub, per_teacher = 0.0, defaultdict(float), defaultdict(float)
    for s in sessions:
        if gid not in s.group_ids:
            continue
        if s.subgroup is None:
            whole += s.weight
        else:
            per_sub[s.subgroup] += s.weight
            per_teacher[s.teacher_id] += s.weight
    return whole + max([*per_sub.values(), *per_teacher.values()], default=0.0)


def _group_loads(idx: SetupIndex, sessions: list[Session]) -> tuple[list[LoadStat], list[Issue]]:
    g_set = idx.setup.general
    per_day = min(g_set.max_lessons_per_day, idx.n_slots)
    cap = idx.n_days * per_day
    stats, issues = [], []
    for g in idx.setup.groups:
        req = group_requirement(idx, g.id, sessions)
        stats.append(LoadStat(entity="group", entity_id=g.id, name=g.name, required=req, capacity=cap))
        if req > cap:
            issues.append(Issue(severity="error", code="group_overloaded", entity="group", entity_id=g.id,
                                message=f"Grupa {g.name} are {fmt_num(req)} perechi/săptămână, dar încap "
                                f"maxim {cap} ({idx.n_days} zile × {per_day} perechi/zi). Reduceți orele "
                                "sau măriți numărul maxim de perechi pe zi."))
    return stats, issues


def _room_loads(idx: SetupIndex, sessions: list[Session]) -> tuple[list[LoadStat], list[Issue]]:
    sets, homeless = room_sets(sessions, idx.setup.rooms)
    issues: list[Issue] = []
    reported: set[tuple] = set()
    for i in homeless:
        s = sessions[i]
        key = (s.subject_id, s.kind, s.seats, s.room_tag)
        if key in reported:
            continue
        reported.add(key)
        subj = idx.subjects[s.subject_id].name
        tag = f" cu eticheta «{s.room_tag}»" if s.room_tag else ""
        issues.append(Issue(severity="error", code="no_room_fits", entity="subject", entity_id=s.subject_id,
                            message=f"Nicio sală{tag} nu poate găzdui {KIND_NAMES[s.kind]} de {subj} "
                            f"({names(idx.groups, s.group_ids)}, {s.seats} locuri). Adăugați o sală "
                            "potrivită sau corectați capacitatea/tipul sălilor."))
    for rs in sets:
        need = sum(sessions[i].weight for i in rs.members)
        have = weekly_room_capacity(idx, rs.rooms)
        if need > have:
            issues.append(Issue(severity="error", code="rooms_insufficient", entity="room",
                                message=f"Pentru {rs.label} sunt necesare {fmt_num(need)} perechi/săptămână, "
                                f"dar sălile potrivite ({len(rs.rooms)}) oferă doar {have} perechi-sală. "
                                "Adăugați săli sau reduceți indisponibilitățile."))
    return _room_kind_stats(idx, sessions), issues


def _room_kind_stats(idx: SetupIndex, sessions: list[Session]) -> list[LoadStat]:
    """One LoadStat per requirement class (lecture/seminar/lab[:tag])."""
    required: dict[str, float] = defaultdict(float)
    for s in sessions:
        required[s.kind + (f":{s.room_tag}" if s.room_tag else "")] += s.weight
    stats = []
    for key in sorted(required):
        kind, _, tag = key.partition(":")
        sample = next(s for s in sessions if s.kind == kind and (s.room_tag or "") == tag)
        rooms = frozenset(r.id for r in idx.setup.rooms
                          if r.kind in sample.room_kinds and (not tag or tag in r.tags))
        label = KIND_NAMES[kind] + (f" ({tag})" if tag else "")
        stats.append(LoadStat(entity="room_kind", entity_id=key, name=label, required=required[key],
                              capacity=weekly_room_capacity(idx, rooms)))
    return stats


def analyze_index(idx: SetupIndex, sessions: list[Session]) -> Analysis:
    issues: list[Issue] = []
    for check in (checks.check_duplicates, checks.check_references, checks.check_parity, checks.check_pins,
                  checks.check_coverage, checks.check_streams, checks.check_assignment_fit):
        issues.extend(check(idx))
    loads: list[LoadStat] = []
    for fn in (_teacher_loads, _group_loads, _room_loads):
        stats, found = fn(idx, sessions)
        loads.extend(stats)
        issues.extend(found)
    order = {"error": 0, "warning": 1, "info": 2}
    issues.sort(key=lambda i: order[i.severity])
    return Analysis(issues=issues, loads=loads, total_sessions=len(sessions),
                    can_generate=not any(i.severity == "error" for i in issues))


def analyze(setup: InstitutionSetup) -> Analysis:
    """Pre-check the setup; can_generate is False iff any error was found."""
    idx = build_index(setup)
    return analyze_index(idx, expand_index(idx))
