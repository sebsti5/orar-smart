"""Shared data contract for Orar Smart.

The whole configuration of one institution is a single `InstitutionSetup`
document. The wizard edits it, the solver reads it, the API stores it as JSON.
Every id is a short client-generated string (e.g. "g_ti261"), unique per kind.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

LessonKind = Literal["lecture", "seminar", "lab"]
RoomKind = Literal["lecture", "seminar", "lab", "sport", "any"]
Parity = Literal["all", "odd", "even"]


class Slot(BaseModel):
    start: str = Field(pattern=r"^\d{2}:\d{2}$")  # "08:00"
    end: str = Field(pattern=r"^\d{2}:\d{2}$")  # "09:30"


DEFAULT_SLOTS = [
    Slot(start="08:00", end="09:30"),
    Slot(start="09:45", end="11:15"),
    Slot(start="11:30", end="13:00"),
    Slot(start="13:30", end="15:00"),
    Slot(start="15:15", end="16:45"),
    Slot(start="17:00", end="18:30"),
    Slot(start="18:45", end="20:15"),
]


class GeneralSettings(BaseModel):
    institution_type: Literal["university", "college", "school"] = "university"
    name: str = ""
    week_parity: bool = False  # odd/even weeks matter
    days_per_week: int = Field(default=5, ge=1, le=7)
    min_lessons_per_day: int = Field(default=2, ge=0, le=12)
    max_lessons_per_day: int = Field(default=4, ge=1, le=12)
    slots: list[Slot] = Field(default_factory=lambda: list(DEFAULT_SLOTS))
    break_minutes: int = Field(default=15, ge=0, le=120)
    big_break_after_slot: int | None = 3  # 1-based slot number, None = no big break
    big_break_minutes: int = Field(default=30, ge=0, le=180)
    academic_year: str = "2026/2027"
    semester: int = Field(default=1, ge=1, le=12)


class Program(BaseModel):
    id: str
    name: str  # "Tehnologia Informației"
    abbreviation: str  # "TI"


class Group(BaseModel):
    id: str
    name: str  # "TI-241"
    program_id: str
    year: int = Field(ge=1, le=8)  # study year
    students: int = Field(ge=1, le=1000)
    subgroups: int = Field(default=1, ge=1, le=4)  # labs may split the group


class Room(BaseModel):
    id: str
    name: str  # "3-611"
    building: str = ""
    capacity: int = Field(ge=1, le=2000)
    kind: RoomKind = "any"
    tags: list[str] = Field(default_factory=list)  # e.g. ["computers"]


class Subject(BaseModel):
    """One curriculum line: a subject for a program + study year.

    Hours are *pairs per week* (one pair = one slot). 0.5 means every other
    week and is only valid when week_parity is on.
    """

    id: str
    program_id: str
    year: int = Field(ge=1, le=8)
    name: str  # "Analiza Matematică"
    short: str = ""  # "AM"
    lecture_per_week: float = Field(default=0, ge=0, le=10)
    seminar_per_week: float = Field(default=0, ge=0, le=10)
    lab_per_week: float = Field(default=0, ge=0, le=10)
    lab_room_tag: str | None = None  # labs need a room with this tag
    lab_split_subgroups: bool = True  # labs held per subgroup


class TeacherCapability(BaseModel):
    subject_id: str
    kinds: list[LessonKind]


class Teacher(BaseModel):
    id: str
    name: str  # "Stanciu L."
    title: str = ""  # "conf. univ., dr."
    max_pairs_per_week: int | None = Field(default=None, ge=1, le=60)
    capabilities: list[TeacherCapability] = Field(default_factory=list)
    # availability[day][slot] -> True if available. Empty list = always available.
    availability: list[list[bool]] = Field(default_factory=list)


class Stream(BaseModel):
    """Groups that attend lectures together (UTM "serie"/"torent")."""

    id: str
    name: str  # "TI-24 (1-3)"
    group_ids: list[str]


class RoomUnavailability(BaseModel):
    room_id: str
    day: int = Field(ge=0, le=6)
    slot: int = Field(ge=0, le=15)  # 0-based slot index


class Assignment(BaseModel):
    """Who teaches which lesson type of a subject to which groups.

    Lectures usually go to a whole stream (several groups at once);
    seminars/labs go to a single group. Labs with lab_split_subgroups run once
    per subgroup of the group.
    """

    id: str
    subject_id: str
    kind: LessonKind
    teacher_id: str
    group_ids: list[str]
    per_week: float | None = None  # override; None = take from subject


class PinnedLesson(BaseModel):
    """A lesson the user fixed by hand; the solver must keep it."""

    assignment_id: str
    session_index: int = 0  # which of the assignment's sessions
    subgroup: int | None = None
    day: int
    slot: int
    room_id: str | None = None


class InstitutionSetup(BaseModel):
    general: GeneralSettings = Field(default_factory=GeneralSettings)
    programs: list[Program] = Field(default_factory=list)
    groups: list[Group] = Field(default_factory=list)
    rooms: list[Room] = Field(default_factory=list)
    teachers: list[Teacher] = Field(default_factory=list)
    subjects: list[Subject] = Field(default_factory=list)
    streams: list[Stream] = Field(default_factory=list)
    room_unavailability: list[RoomUnavailability] = Field(default_factory=list)
    assignments: list[Assignment] = Field(default_factory=list)
    pinned: list[PinnedLesson] = Field(default_factory=list)

    @model_validator(mode="after")
    def _min_le_max(self) -> "InstitutionSetup":
        g = self.general
        if g.min_lessons_per_day > g.max_lessons_per_day:
            raise ValueError("min_lessons_per_day must be <= max_lessons_per_day")
        return self


# ---------------------------------------------------------------- analysis

Severity = Literal["error", "warning", "info"]


class Issue(BaseModel):
    severity: Severity
    code: str  # machine code, e.g. "teacher_overloaded"
    message: str  # human, Romanian, actionable
    entity: str | None = None  # "teacher" | "group" | "room" | "subject" | ...
    entity_id: str | None = None


class LoadStat(BaseModel):
    entity: Literal["teacher", "group", "room_kind"]
    entity_id: str
    name: str
    required: float  # pairs per week needed
    capacity: float  # pairs per week available


class Analysis(BaseModel):
    issues: list[Issue]
    loads: list[LoadStat]
    total_sessions: int
    can_generate: bool  # False if any "error"


# ---------------------------------------------------------------- timetable


class PlacedLesson(BaseModel):
    id: str  # "<assignment_id>#<session_index>[#s<subgroup>]"
    assignment_id: str
    session_index: int
    subject_id: str
    kind: LessonKind
    teacher_id: str
    group_ids: list[str]
    subgroup: int | None = None  # 1-based subgroup, None = whole group(s)
    day: int
    slot: int
    parity: Parity = "all"
    room_id: str | None = None
    pinned: bool = False


class Violation(BaseModel):
    severity: Severity
    code: str
    message: str
    lesson_ids: list[str] = Field(default_factory=list)


class Score(BaseModel):
    group_gaps: int = 0
    teacher_gaps: int = 0
    late_lessons: int = 0
    days_over_min_violations: int = 0
    same_subject_same_day: int = 0
    total_penalty: int = 0


class SolveResult(BaseModel):
    status: Literal["optimal", "feasible", "infeasible", "error"]
    lessons: list[PlacedLesson] = Field(default_factory=list)
    unplaced: list[str] = Field(default_factory=list)  # session ids not placed
    violations: list[Violation] = Field(default_factory=list)
    score: Score = Field(default_factory=Score)
    message: str = ""
    solve_seconds: float = 0.0
