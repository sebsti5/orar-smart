"""Shared pytest setup: make `app` importable and offer tiny setup builders."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest  # noqa: E402

from app.schemas import (  # noqa: E402
    Assignment,
    GeneralSettings,
    Group,
    InstitutionSetup,
    Program,
    Room,
    Slot,
    Subject,
    Teacher,
    TeacherCapability,
)


def slots(n: int) -> list[Slot]:
    """n consecutive 90-minute slots starting 08:00 (labels only matter for text)."""
    out = []
    for i in range(n):
        h = 8 + 2 * i
        out.append(Slot(start=f"{h:02d}:00", end=f"{h + 1:02d}:30"))
    return out


def tiny_setup(
    *,
    days: int = 5,
    n_slots: int = 4,
    parity: bool = True,
    min_day: int = 0,
    max_day: int = 4,
) -> InstitutionSetup:
    """One program, one group of 26 students (2 subgroups), generous rooms."""
    return InstitutionSetup(
        general=GeneralSettings(
            week_parity=parity,
            days_per_week=days,
            min_lessons_per_day=min_day,
            max_lessons_per_day=max_day,
            slots=slots(n_slots),
        ),
        programs=[Program(id="p_ti", name="Tehnologia Informației", abbreviation="TI")],
        groups=[Group(id="g1", name="TI-251", program_id="p_ti", year=1, students=26, subgroups=2)],
        rooms=[
            Room(id="r_hall", name="3-611", building="3", capacity=120, kind="lecture"),
            Room(id="r_sem", name="3-501", building="3", capacity=30, kind="seminar"),
            Room(id="r_lab1", name="3-114", building="3", capacity=16, kind="lab", tags=["computers"]),
            Room(id="r_lab2", name="3-115", building="3", capacity=16, kind="lab", tags=["computers"]),
        ],
        teachers=[
            Teacher(id="t1", name="Stanciu L.", capabilities=[
                TeacherCapability(subject_id="s_am", kinds=["lecture", "seminar"])]),
            Teacher(id="t2", name="Costaș A.", capabilities=[
                TeacherCapability(subject_id="s_pc", kinds=["lecture", "lab"])]),
            Teacher(id="t3", name="Russu P.", capabilities=[
                TeacherCapability(subject_id="s_pc", kinds=["lab"])]),
        ],
        subjects=[
            Subject(id="s_am", program_id="p_ti", year=1, name="Analiza matematică",
                    lecture_per_week=1, seminar_per_week=1),
            Subject(id="s_pc", program_id="p_ti", year=1, name="Programarea calculatoarelor",
                    lecture_per_week=1, lab_per_week=1, lab_room_tag="computers"),
        ],
        assignments=[
            Assignment(id="a_am_c", subject_id="s_am", kind="lecture", teacher_id="t1", group_ids=["g1"]),
            Assignment(id="a_am_s", subject_id="s_am", kind="seminar", teacher_id="t1", group_ids=["g1"]),
            Assignment(id="a_pc_c", subject_id="s_pc", kind="lecture", teacher_id="t2", group_ids=["g1"]),
            Assignment(id="a_pc_l", subject_id="s_pc", kind="lab", teacher_id="t3", group_ids=["g1"]),
        ],
    )


def availability(days: int, n_slots: int, allowed: set[tuple[int, int]]) -> list[list[bool]]:
    return [[(d, s) in allowed for s in range(n_slots)] for d in range(days)]


@pytest.fixture
def setup_small() -> InstitutionSetup:
    return tiny_setup()
