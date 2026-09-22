"""Turn raw.json (parsed FCIM PDFs) into an InstitutionSetup + the official timetable."""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from app.schemas import (Assignment, GeneralSettings, Group, InstitutionSetup, PlacedLesson,  # noqa: E402
                         Program, Room, Slot, Stream, Subject, Teacher, TeacherCapability)

PROGRAM_NAMES = {
    "TI": "Tehnologia Informației", "SI": "Securitate Informațională", "IA": "Informatică Aplicată",
    "SD": "Știința Datelor", "AI": "Automatică și Informatică", "R": "Robotică",
    "RM": "Robotică și Mecatronică", "CR": "Calculatoare și Rețele", "EA": "Electronică Aplicată",
    "MN": "Microelectronică și Nanotehnologii", "IBM": "Inginerie Biomedicală",
    "FAF": "Filiera Anglofonă (FAF)", "FI": "Filiera Francofonă (FI)",
}
STUDENTS_PER_GROUP = 25
STOP = {"și", "si", "de", "a", "în", "in", "pe", "la", "cu", "al", "ale", "din", "pentru", "și/sau"}
TEACHER_RE = re.compile(
    r"([A-ZȘȚĂÂÎ][a-zșțăâîéöü]+(?:[-\s][A-ZȘȚĂÂÎ][a-zșțăâîéöü]+)?\s+[A-ZȘȚĂÂÎ][a-zșțăâî]{0,2}\.)"
    r"|([A-ZȘȚĂÂÎ][a-zșțăâî]{0,2}\.\s?[A-ZȘȚĂÂÎ][a-zșțăâîéöü]+)")
ROOM_RE = re.compile(r"^(?:[A-Z]?\d{1,3}[a-z]?(?:\s?[-/]\s?[A-Z]?\d{1,3}[a-z]?)*(?:\s+\w+)?|Sala sport\w*|sala sport\w*)$")


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")[:40]


def initials(name: str) -> str:
    words = re.findall(r"[\wăâîșț]+", name)
    return "".join(w[0] for w in words if w.lower() not in STOP).upper()


def parse_cell(text: str):
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    kind, subject, teachers, room = "seminar", None, [], None
    for ln in lines:
        low = ln.lower()
        if re.match(r"^(lab\.?\s*)?0[,.]5\s*gr\.?$", low):
            kind = "lab"
            continue
        found = [a or b for a, b in TEACHER_RE.findall(ln)]
        is_room = bool(ROOM_RE.match(ln)) or low.startswith("sala sport")
        if subject is None and not is_room and not (found and len(" ".join(found)) >= len(ln) - 3):
            s = ln
            if re.match(r"^c\.\s*", s):
                kind, s = "lecture", re.sub(r"^c\.\s*", "", s)
            elif re.match(r"^(lab|Lab|LAB)\.?\s*", s):
                kind, s = "lab", re.sub(r"^(lab|Lab|LAB)\.?\s*", "", s)
            elif re.match(r"^(sem|s)\.\s+", s):
                s = re.sub(r"^(sem|s)\.\s+", "", s)
            s = re.sub(r"\(.*?\)?$", "", s).strip(" .,")
            subject = s or None
            continue
        if is_room and room is None:
            room = ln
            continue
        teachers += found
    return kind, subject, [t.strip() for t in teachers], room


def canon_subject(abbr_or_name: str, full_names: list[str]) -> tuple[str, str]:
    """Map 'ALGA' → 'Algebra Liniară și Geometria Analitică' when initials match."""
    s = abbr_or_name.strip()
    if re.fullmatch(r"[A-ZȘȚĂÂÎ]{2,6}\d?", s.replace(" ", "")):
        key = s.replace(" ", "")
        for full in full_names:
            if initials(full) == key.upper():
                return full, key
        return key, key
    short = initials(s) if len(s) > 12 else s
    return s[0].upper() + s[1:], short


def build(raw):
    all_groups = []  # (name, year)
    for y in raw:
        for g in y["groups"]:
            if (g, y["year"]) not in all_groups and not any(g == n for n, _ in all_groups):
                all_groups.append((g, y["year"]))
    lecture_names = defaultdict(set)
    parsed = []
    for y in raw:
        for l in y["lessons"]:
            kind, subj, teachers, room = parse_cell(l["text"])
            if not subj:
                continue
            parsed.append((l, kind, subj, teachers, room))
            if kind == "lecture" and len(subj) > 6:
                lecture_names[y["year"]].add(subj)
    # --- programs / groups
    prog_of = {g: g.split("-")[0] for g, _ in all_groups}
    programs = [Program(id=f"p_{a.lower()}", name=PROGRAM_NAMES.get(a, a), abbreviation=a)
                for a in sorted(set(prog_of.values()))]
    groups = [Group(id=f"g_{slug(g)}", name=g, program_id=f"p_{prog_of[g].lower()}", year=yr,
                    students=STUDENTS_PER_GROUP, subgroups=1) for g, yr in all_groups]
    gid = {g.name: g.id for g in groups}
    gyear = {g.name: g.year for g in groups}

    teachers, rooms = {}, {}
    room_uses = defaultdict(list)
    subjects = {}
    agg = defaultdict(float)  # (subject_id, kind, teacher_id, groups tuple) -> per week
    placements = []
    unknown_teacher_n = 0
    for l, kind, subj, tnames, room in parsed:
        yr = l["year"]
        name, short = canon_subject(subj, sorted(lecture_names[yr], key=len))
        grs = tuple(sorted(set(l["groups"])))
        prog = prog_of[grs[0]]
        sid = f"s_{prog.lower()}{yr}_{slug(short or name)}"
        subjects.setdefault(sid, {"program": prog, "year": yr, "name": name, "short": short,
                                  "hours": Counter()})
        if tnames:
            tname = tnames[0]
        else:
            unknown_teacher_n += 1
            tname = f"Nespecificat ({short or name}, {grs[0]})"
        tid = f"t_{slug(tname)}"
        teachers.setdefault(tid, {"name": tname, "caps": defaultdict(set)})
        teachers[tid]["caps"][sid].add(kind)
        rid = None
        if room:
            rid = f"r_{slug(room)}"
            rooms.setdefault(rid, room)
            room_uses[rid].append((kind, len(grs)))
        weight = (1.0 if l["parity"] == "all" else 0.5) * max(1, l.get("rows", 1))
        agg[(sid, kind, tid, grs)] += weight
        placements.append((sid, kind, tid, grs, l, rid))

    subj_models = []
    for sid, s in subjects.items():
        per = defaultdict(float)
        for (sid2, kind, _t, grs), h in agg.items():
            if sid2 == sid:
                per[kind] = max(per[kind], h)
        subj_models.append(Subject(id=sid, program_id=f"p_{s['program'].lower()}", year=s["year"],
                                   name=s["name"], short=s["short"][:12],
                                   lecture_per_week=min(10, per["lecture"]),
                                   seminar_per_week=min(10, per["seminar"]),
                                   lab_per_week=min(10, per["lab"]), lab_split_subgroups=False))
    assignments = []
    aid_of = {}
    for i, ((sid, kind, tid, grs), h) in enumerate(sorted(agg.items())):
        aid = f"a{i:04d}"
        aid_of[(sid, kind, tid, grs)] = aid
        assignments.append(Assignment(id=aid, subject_id=sid, kind=kind, teacher_id=tid,
                                      group_ids=[gid[g] for g in grs], per_week=min(10, h)))
    room_models = []
    for rid, rname in sorted(rooms.items()):
        uses = room_uses[rid]
        seats = max(n for _, n in uses) * STUDENTS_PER_GROUP
        sport = "sport" in rname.lower()
        lecture_hall = any(k == "lecture" for k, _ in uses) and seats >= 60
        m = re.match(r"^(\d)-", rname)
        room_models.append(Room(id=rid, name=rname, building=f"Blocul {m.group(1)}" if m else "",
                                capacity=max(30, seats + 5), tags=["sport"] if sport else [],
                                kind="sport" if sport else ("lecture" if lecture_hall else "any")))
    teacher_models = [Teacher(id=tid, name=t["name"], max_pairs_per_week=None,
                              capabilities=[TeacherCapability(subject_id=s, kinds=sorted(k))
                                            for s, k in t["caps"].items()])
                      for tid, t in sorted(teachers.items(), key=lambda kv: kv[1]["name"])]
    # streams = group sets that attend a lecture together
    stream_sets = Counter(grs for (sid, kind, tid, grs) in agg if kind == "lecture" and len(grs) > 1)
    streams = [Stream(id=f"st{i:03d}", name=" + ".join(grs) if len(grs) <= 3 else f"{grs[0]} … {grs[-1]} ({len(grs)} grupe)",
                      group_ids=[gid[g] for g in grs])
               for i, (grs, _) in enumerate(stream_sets.most_common())]

    general = GeneralSettings(
        institution_type="university",
        name="FCIM — Facultatea Calculatoare, Informatică și Microelectronică (UTM)",
        week_parity=True, days_per_week=5, min_lessons_per_day=2, max_lessons_per_day=6,
        slots=[Slot(start=k[:5], end=k[6:]) for k in raw[0]["slots"]],
        break_minutes=15, big_break_after_slot=3, big_break_minutes=30,
        academic_year="2026/2027", semester=1)
    setup = InstitutionSetup(general=general, programs=programs, groups=groups, rooms=room_models,
                             teachers=teacher_models, subjects=subj_models, streams=streams,
                             assignments=assignments)
    # official timetable as placed lessons
    counters = Counter()
    lessons = []
    for sid, kind, tid, grs, l, rid in placements:
        aid = aid_of[(sid, kind, tid, grs)]
        idx = counters[aid]
        counters[aid] += 1
        lessons.append(PlacedLesson(id=f"{aid}#{idx}", assignment_id=aid, session_index=idx,
                                    subject_id=sid, kind=kind, teacher_id=tid,
                                    group_ids=[gid[g] for g in grs], day=l["day"], slot=l["slot"],
                                    parity=l["parity"], room_id=rid))
    return setup, lessons, unknown_teacher_n


if __name__ == "__main__":
    raw = json.load(open("raw.json"))
    setup, lessons, unknown = build(raw)
    json.dump(setup.model_dump(), open("utm_setup.json", "w"), ensure_ascii=False)
    json.dump([l.model_dump() for l in lessons], open("utm_official_lessons.json", "w"), ensure_ascii=False)
    print("programs", len(setup.programs), "groups", len(setup.groups), "rooms", len(setup.rooms),
          "teachers", len(setup.teachers), "subjects", len(setup.subjects), "streams", len(setup.streams),
          "assignments", len(setup.assignments), "lessons", len(lessons), "unknown teachers", unknown)
