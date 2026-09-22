"""Realistic FCIM-UTM-like demo institution (6 programs, 14 groups, 35 teachers, 25 rooms)."""

from __future__ import annotations

import re
import unicodedata

from app.schemas import (
    GeneralSettings,
    Group,
    InstitutionSetup,
    PinnedLesson,
    Program,
    Room,
    RoomUnavailability,
    Stream,
    Subject,
    Teacher,
    TeacherCapability,
)

PROGRAMS = [
    ("TI", "Tehnologia Informației"),
    ("SI", "Securitatea Informațională"),
    ("IA", "Informatica Aplicată"),
    ("CR", "Calculatoare și Rețele"),
    ("AI", "Automatica și Informatica"),
    ("RM", "Robotică și Mecatronică"),
]

# (name, program, year, students)
GROUPS = [
    ("TI-261", "TI", 1, 28), ("TI-262", "TI", 1, 27), ("TI-263", "TI", 1, 26),
    ("SI-261", "SI", 1, 25), ("SI-262", "SI", 1, 24), ("IA-261", "IA", 1, 26),
    ("CR-261", "CR", 1, 27), ("AI-261", "AI", 1, 24), ("RM-261", "RM", 1, 22),
    ("TI-251", "TI", 2, 27), ("TI-252", "TI", 2, 26), ("SI-251", "SI", 2, 25),
    ("IA-251", "IA", 2, 24), ("CR-251", "CR", 2, 26),
]

STREAMS = [
    ("TI-26 (1-3)", ["TI-261", "TI-262", "TI-263"]),
    ("SI-26 (1-2)", ["SI-261", "SI-262"]),
    ("TI-25 (1-2)", ["TI-251", "TI-252"]),
]

# (name, short, lecture, seminar, lab, lab tag, split labs)
YEAR1 = [
    ("Analiza matematică", "AM", 1, 1, 0, None, True),
    ("Programarea calculatoarelor", "PC", 1, 0, 2, "computers", True),
    ("Matematica discretă", "MD", 1, 1, 0, None, True),
    ("Limba engleză", "LE", 0, 1, 0, None, True),
    ("Educație fizică", "EF", 0, 0, 1, "sport", False),
    ("Etica și securitatea umană", "ESU", 0.5, 0.5, 0, None, True),
]
YEAR1_EXTRA = {
    "TI": ("Fizica", "FIZ", 1, 0, 1, "electronics", True),
    "CR": ("Fizica", "FIZ", 1, 0, 1, "electronics", True),
    "RM": ("Fizica", "FIZ", 1, 0, 1, "electronics", True),
    "SI": ("Arhitectura calculatoarelor", "AC", 1, 0, 1, "electronics", True),
    "IA": ("Arhitectura calculatoarelor", "AC", 1, 0, 1, "electronics", True),
    "AI": ("Arhitectura calculatoarelor", "AC", 1, 0, 1, "electronics", True),
}
YEAR2 = [
    ("Structuri de date și algoritmi", "SDA", 1, 0, 1.5, "computers", True),
    ("Baze de date", "BD", 1, 0, 1, "computers", True),
    ("Rețele de calculatoare", "RC", 1, 0, 1, "computers", True),
    ("Sisteme de operare", "SO", 1, 0, 1, "computers", True),
    ("Limba engleză", "LE", 0, 1, 0, None, True),
    ("Teoria probabilităților", "TP", 1, 1, 0, None, True),
]

# teacher name -> (title, {subject short: kinds})
TEACHERS: dict[str, tuple[str, dict[str, tuple[str, ...]]]] = {
    "Stanciu L.": ("conf. univ., dr.", {"AM": ("lecture",), "TP": ("lecture",)}),
    "Russu P.": ("conf. univ., dr.", {"AM": ("lecture", "seminar")}),
    "Costaș A.": ("lect. univ.", {"AM": ("seminar",), "MD": ("lecture",)}),
    "Gîncu I.": ("asist. univ.", {"AM": ("seminar",), "TP": ("seminar",)}),
    "Kulev M.": ("conf. univ., dr.", {"PC": ("lecture",)}),
    "Bulai R.": ("lect. univ.", {"PC": ("lecture", "lab")}),
    "Cojuhari I.": ("lect. univ.", {"PC": ("lab",)}),
    "Scrob S.": ("asist. univ.", {"PC": ("lab",)}),
    "Turcanu D.": ("asist. univ.", {"PC": ("lab",)}),
    "Postovan D.": ("asist. univ.", {"PC": ("lab",)}),
    "Munteanu S.": ("conf. univ., dr.", {"MD": ("lecture", "seminar")}),
    "Guțu M.": ("lect. univ.", {"MD": ("seminar",), "TP": ("seminar",)}),
    "Balan M.": ("lect. univ.", {"MD": ("seminar",), "TP": ("lecture",)}),
    "Melnic R.": ("lect. univ.", {"LE": ("seminar",)}),
    "Rotaru L.": ("lect. univ.", {"LE": ("seminar",)}),
    "Sîrbu E.": ("asist. univ.", {"LE": ("seminar",)}),
    "Antohi I.": ("lect. univ.", {"EF": ("lab",)}),
    "Grosu V.": ("lect. univ.", {"EF": ("lab",)}),
    "Negru I.": ("conf. univ., dr.", {"ESU": ("lecture", "seminar")}),
    "Țurcan A.": ("asist. univ.", {"ESU": ("seminar",)}),
    "Nastas A.": ("conf. univ., dr.", {"FIZ": ("lecture", "lab")}),
    "Ciobanu D.": ("asist. univ.", {"FIZ": ("lab",)}),
    "Sudacevschi V.": ("conf. univ., dr.", {"AC": ("lecture", "lab")}),
    "Bîrnaz A.": ("asist. univ.", {"AC": ("lab",)}),
    "Andrievschi-Bagrin V.": ("conf. univ., dr.", {"SDA": ("lecture",)}),
    "Moraru V.": ("lect. univ.", {"SDA": ("lab",)}),
    "Lazu V.": ("asist. univ.", {"SDA": ("lab",)}),
    "Crudu A.": ("asist. univ.", {"SDA": ("lab",)}),
    "Bostan V.": ("prof. univ., dr. hab.", {"BD": ("lecture",)}),
    "Prodan L.": ("lect. univ.", {"BD": ("lab",)}),
    "Mocanu S.": ("asist. univ.", {"BD": ("lab",), "SO": ("lab",)}),
    "Ciorbă D.": ("conf. univ., dr.", {"RC": ("lecture", "lab")}),
    "Popovici A.": ("lect. univ.", {"RC": ("lab",), "SO": ("lab",)}),
    "Cojocaru S.": ("asist. univ.", {"RC": ("lab",)}),
    "Rusu V.": ("conf. univ., dr.", {"SO": ("lecture", "lab")}),
}

# (name, building, capacity, kind, tags)
ROOMS = [
    ("6-2", "6", 150, "lecture", []), ("6-3", "6", 120, "lecture", []),
    ("3-101", "3", 110, "lecture", []), ("1-104", "1", 100, "lecture", []),
    ("3-611", "3", 30, "seminar", []), ("3-612", "3", 30, "seminar", []),
    ("3-614", "3", 30, "seminar", []), ("6-104", "6", 30, "seminar", []),
    ("6-105", "6", 30, "seminar", []), ("6-106", "6", 32, "seminar", []),
    ("1-205", "1", 30, "seminar", []), ("1-206", "1", 28, "seminar", []),
    ("D01-03", "D", 16, "lab", ["computers"]), ("D01-04", "D", 16, "lab", ["computers"]),
    ("D01-05", "D", 16, "lab", ["computers"]), ("D01-06", "D", 18, "lab", ["computers"]),
    ("3-615", "3", 16, "lab", ["computers"]), ("3-616", "3", 16, "lab", ["computers"]),
    ("6-201", "6", 16, "lab", ["computers"]), ("6-202", "6", 16, "lab", ["computers"]),
    ("3-418", "3", 16, "lab", ["electronics"]), ("3-420", "3", 16, "lab", ["electronics"]),
    ("3-701", "3", 40, "any", []), ("1-301", "1", 60, "any", []),
    ("Sala sport", "S", 60, "sport", ["sport"]),
]

DAYS, SLOTS = 5, 7


def slug(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", ascii_text.lower()).strip("_")


def _grid(allowed) -> list[list[bool]]:
    return [[bool(allowed(d, s)) for s in range(SLOTS)] for d in range(DAYS)]


AVAILABILITY = {
    "Stanciu L.": _grid(lambda d, s: d != 4),  # no Fridays
    "Kulev M.": _grid(lambda d, s: s <= 3),  # mornings only
    "Melnic R.": _grid(lambda d, s: d <= 2),  # Mon-Wed
    "Bostan V.": _grid(lambda d, s: d in (1, 3)),  # Tue & Thu
    "Andrievschi-Bagrin V.": _grid(lambda d, s: s >= 1),  # not at 08:00
}


def _curriculum() -> list[Subject]:
    subjects = []
    lines = [(p, 1, row) for p, _ in PROGRAMS for row in YEAR1 + [YEAR1_EXTRA[p]]]
    years2 = {prog for _, prog, year, _ in GROUPS if year == 2}
    lines += [(p, 2, row) for p, _ in PROGRAMS if p in years2 for row in YEAR2]
    for prog, year, (name, short, lec, sem, lab, tag, split) in lines:
        subjects.append(Subject(
            id=f"s_{prog.lower()}{year}_{short.lower()}", program_id=f"p_{prog.lower()}", year=year,
            name=name, short=short, lecture_per_week=lec, seminar_per_week=sem, lab_per_week=lab,
            lab_room_tag=tag, lab_split_subgroups=split,
        ))
    return subjects


def _teachers(subjects: list[Subject]) -> list[Teacher]:
    by_short: dict[str, list[str]] = {}
    for s in subjects:
        by_short.setdefault(s.short, []).append(s.id)
    out = []
    for name, (title, skills) in TEACHERS.items():
        caps = [TeacherCapability(subject_id=sid, kinds=list(kinds))
                for short, kinds in skills.items() for sid in by_short.get(short, [])]
        out.append(Teacher(id=f"t_{slug(name)}", name=name, title=title, max_pairs_per_week=18,
                           capabilities=caps, availability=AVAILABILITY.get(name, [])))
    return out


def _base_setup() -> InstitutionSetup:
    subjects = _curriculum()
    group_id = {name: f"g_{slug(name)}" for name, *_ in GROUPS}
    return InstitutionSetup(
        general=GeneralSettings(
            name="FCIM — Facultatea Calculatoare, Informatică și Microelectronică (demo)",
            week_parity=True, days_per_week=DAYS, min_lessons_per_day=2, max_lessons_per_day=4,
        ),
        programs=[Program(id=f"p_{a.lower()}", name=n, abbreviation=a) for a, n in PROGRAMS],
        groups=[Group(id=group_id[n], name=n, program_id=f"p_{p.lower()}", year=y, students=st, subgroups=2)
                for n, p, y, st in GROUPS],
        rooms=[Room(id=f"r_{slug(n)}", name=n, building=b, capacity=c, kind=k, tags=t)
               for n, b, c, k, t in ROOMS],
        teachers=_teachers(subjects),
        subjects=subjects,
        streams=[Stream(id=f"st_{slug(n)}", name=n, group_ids=[group_id[g] for g in gs]) for n, gs in STREAMS],
        room_unavailability=[
            RoomUnavailability(room_id="r_6_2", day=2, slot=0),  # Wednesday: senate meeting
            RoomUnavailability(room_id="r_6_2", day=2, slot=1),
            *[RoomUnavailability(room_id="r_sala_sport", day=4, slot=s) for s in (4, 5, 6)],
        ],
    )


def demo_setup() -> InstitutionSetup:
    """Complete demo: data + assignments (via auto_assign) + one pinned PE lesson."""
    from app.solver import auto_assign  # local import: demo data does not depend on the solver otherwise

    setup = _base_setup()
    assignments = auto_assign(setup)
    pe = next(a for a in assignments if a.subject_id == "s_ti1_ef" and a.group_ids == ["g_ti_261"])
    pin = PinnedLesson(assignment_id=pe.id, session_index=0, day=1, slot=2, room_id="r_sala_sport")
    return setup.model_copy(update={"assignments": assignments, "pinned": [pin]})
