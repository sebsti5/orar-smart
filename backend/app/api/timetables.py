"""/api/timetables: generate, list, inspect, move lessons, publish, export, delete."""

from __future__ import annotations

import json
import threading
from collections import defaultdict
from datetime import datetime
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import jobs
from app.api.common import load_setup, solver_unavailable
from app.auth import current_user
from app.db import get_db
from app.export import export_xlsx
from app.models import Timetable, User
from app.schemas import InstitutionSetup, PlacedLesson, SolveResult, Violation

router = APIRouter(prefix="/timetables", tags=["timetables"])

XLSX_MEDIA = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DEFAULT_TIME_LIMIT_S = 30


def validate(setup: InstitutionSetup, lessons: list[PlacedLesson]) -> list[Violation]:
    """Lazy wrapper around the solver's validator (patched in tests)."""
    from app.solver import validate as _validate

    return _validate(setup, lessons)


# ------------------------------------------------------------------ schemas


class Progress(BaseModel):
    phase: str
    message: str = ""
    best_penalty: float | None = None


class TimetableSummary(BaseModel):
    id: int
    name: str
    created_at: str
    status: Literal["queued", "running", "done", "failed"]
    published: bool
    progress: Progress


class TimetableDetail(TimetableSummary):
    result: SolveResult | None
    setup_snapshot: InstitutionSetup


class CreateIn(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    group_ids: list[str] = Field(default_factory=list)
    time_limit_s: int = Field(default=DEFAULT_TIME_LIMIT_S, ge=5, le=120)


class MoveIn(BaseModel):
    lesson_id: str
    day: int
    slot: int
    room_id: str | None = None


class PublishIn(BaseModel):
    published: bool


# ------------------------------------------------------------------ serialisation


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat() + "Z"


def summary(t: Timetable) -> TimetableSummary:
    try:
        progress = json.loads(t.progress_json or "{}")
    except json.JSONDecodeError:
        progress = {}
    progress.setdefault("phase", t.status)
    progress.setdefault("message", "")
    return TimetableSummary(
        id=t.id,
        name=t.name,
        created_at=_iso(t.created_at),
        status=t.status,
        published=bool(t.published),
        progress=Progress.model_validate(progress),
    )


def snapshot_of(t: Timetable) -> InstitutionSetup:
    return InstitutionSetup.model_validate_json(t.setup_snapshot_json)


def result_of(t: Timetable) -> SolveResult | None:
    return SolveResult.model_validate_json(t.result_json) if t.result_json else None


def detail(t: Timetable) -> TimetableDetail:
    return TimetableDetail(
        **summary(t).model_dump(), result=result_of(t), setup_snapshot=snapshot_of(t)
    )


# ------------------------------------------------------------------ helpers


def filter_setup(setup: InstitutionSetup, group_ids: list[str]) -> InstitutionSetup:
    """Keep only assignments touching `group_ids` (and pins on those); other entities stay."""
    if not group_ids:
        return setup
    wanted = set(group_ids)
    known = {g.id for g in setup.groups}
    if not wanted & known:
        raise HTTPException(status_code=422, detail="Niciuna dintre grupele selectate nu există.")
    assignments = [a for a in setup.assignments if wanted & set(a.group_ids)]
    kept = {a.id for a in assignments}
    pinned = [p for p in setup.pinned if p.assignment_id in kept]
    return setup.model_copy(update={"assignments": assignments, "pinned": pinned})


def _get_owned(db: Session, user: User, timetable_id: int) -> Timetable:
    t = db.get(Timetable, timetable_id)
    if t is None or t.institution_id != user.institution_id:
        raise HTTPException(status_code=404, detail="Orarul nu a fost găsit.")
    return t


def _require_result(t: Timetable) -> SolveResult:
    result = result_of(t)
    if t.status != "done" or result is None:
        raise HTTPException(status_code=409, detail="Orarul nu este încă generat.")
    return result


# ------------------------------------------------------------------ routes


@router.post("", response_model=TimetableSummary)
def create(body: CreateIn, user: User = Depends(current_user),
           db: Session = Depends(get_db)) -> TimetableSummary:
    setup = filter_setup(load_setup(user.institution), body.group_ids)
    name = (body.name or "").strip() or f"Orar {datetime.now().strftime('%d.%m.%Y %H:%M')}"
    t = Timetable(
        institution_id=user.institution_id,
        name=name,
        status="queued",
        progress_json=json.dumps({"phase": "queued", "message": "În așteptare"},
                                 ensure_ascii=False),
        setup_snapshot_json=setup.model_dump_json(),
        time_limit_s=body.time_limit_s,
    )
    db.add(t)
    db.commit()
    jobs.submit(t.id, setup, body.time_limit_s)
    return summary(t)


@router.get("", response_model=list[TimetableSummary])
def list_timetables(user: User = Depends(current_user),
                    db: Session = Depends(get_db)) -> list[TimetableSummary]:
    rows = db.scalars(
        select(Timetable)
        .where(Timetable.institution_id == user.institution_id)
        .order_by(Timetable.created_at.desc(), Timetable.id.desc())
    )
    return [summary(t) for t in rows]


@router.get("/{timetable_id}", response_model=TimetableDetail)
def get_timetable(timetable_id: int, user: User = Depends(current_user),
                  db: Session = Depends(get_db)) -> TimetableDetail:
    return detail(_get_owned(db, user, timetable_id))


@router.delete("/{timetable_id}")
def delete_timetable(timetable_id: int, user: User = Depends(current_user),
                     db: Session = Depends(get_db)) -> dict:
    db.delete(_get_owned(db, user, timetable_id))
    db.commit()
    return {"ok": True}


def _check_move_bounds(setup: InstitutionSetup, body: MoveIn) -> None:
    g = setup.general
    if not 0 <= body.day < g.days_per_week:
        raise HTTPException(status_code=422, detail="Ziua aleasă nu există în orar.")
    if not 0 <= body.slot < len(g.slots):
        raise HTTPException(status_code=422, detail="Perechea aleasă nu există în orar.")
    if body.room_id is not None and body.room_id not in {r.id for r in setup.rooms}:
        raise HTTPException(status_code=422, detail="Sala aleasă nu există.")


_move_locks: dict[int, threading.Lock] = defaultdict(threading.Lock)
_move_locks_guard = threading.Lock()


def _move_lock(timetable_id: int) -> threading.Lock:
    with _move_locks_guard:
        return _move_locks[timetable_id]


@router.post("/{timetable_id}/move")
def move_lesson(timetable_id: int, body: MoveIn, user: User = Depends(current_user),
                db: Session = Depends(get_db)) -> dict:
    # Serialize moves per timetable so two quick drags can't overwrite each other.
    with _move_lock(timetable_id):
        db.expire_all()
        return _apply_move(db, user, timetable_id, body)


def _apply_move(db: Session, user: User, timetable_id: int, body: MoveIn) -> dict:
    t = _get_owned(db, user, timetable_id)
    result = _require_result(t)
    setup = snapshot_of(t)
    _check_move_bounds(setup, body)
    if not any(l.id == body.lesson_id for l in result.lessons):
        raise HTTPException(status_code=404, detail="Lecția nu a fost găsită în acest orar.")

    changes: dict = {"day": body.day, "slot": body.slot, "pinned": True}
    if "room_id" in body.model_fields_set:
        changes["room_id"] = body.room_id
    lessons = [l.model_copy(update=changes) if l.id == body.lesson_id else l
               for l in result.lessons]
    try:
        violations = validate(setup, lessons)
    except Exception as exc:
        raise solver_unavailable(exc) from exc

    t.result_json = result.model_copy(
        update={"lessons": lessons, "violations": violations}
    ).model_dump_json()
    db.commit()
    return {"lessons": lessons, "violations": violations}


@router.post("/{timetable_id}/publish", response_model=TimetableSummary)
def publish(timetable_id: int, body: PublishIn, user: User = Depends(current_user),
            db: Session = Depends(get_db)) -> TimetableSummary:
    t = _get_owned(db, user, timetable_id)
    if body.published:
        _require_result(t)
    t.published = body.published
    db.commit()
    return summary(t)


@router.get("/{timetable_id}/export.xlsx")
def export(timetable_id: int, user: User = Depends(current_user),
           db: Session = Depends(get_db)) -> Response:
    t = _get_owned(db, user, timetable_id)
    result = _require_result(t)
    data = export_xlsx(snapshot_of(t), result)
    filename = f"{t.name}.xlsx"
    disposition = f"attachment; filename=\"orar-{t.id}.xlsx\"; filename*=UTF-8''{quote(filename)}"
    return Response(content=data, media_type=XLSX_MEDIA,
                    headers={"Content-Disposition": disposition})
