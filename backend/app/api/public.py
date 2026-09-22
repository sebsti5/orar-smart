"""/api/public/{token}: latest published timetable of an institution (no auth)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.timetables import detail
from app.db import get_db
from app.models import Institution, Timetable
from app.schemas import InstitutionSetup

router = APIRouter(prefix="/public", tags=["public"])

NOT_FOUND = "Nu există niciun orar publicat pentru acest link."


def public_setup(setup: InstitutionSetup) -> InstitutionSetup:
    """Drop teachers' private planning data (availability, load caps) before exposing."""
    teachers = [t.model_copy(update={"availability": [], "max_pairs_per_week": None})
                for t in setup.teachers]
    return setup.model_copy(update={"teachers": teachers})


@router.get("/{token}")
def public_timetable(token: str, db: Session = Depends(get_db)) -> dict:
    inst = db.scalar(select(Institution).where(Institution.share_token == token))
    if inst is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    t = db.scalar(
        select(Timetable)
        .where(Timetable.institution_id == inst.id, Timetable.published.is_(True),
               Timetable.status == "done")
        .order_by(Timetable.created_at.desc(), Timetable.id.desc())
        .limit(1)
    )
    if t is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    d = detail(t)
    safe = public_setup(d.setup_snapshot)
    return {
        "institution_name": inst.name,
        "setup": safe,
        "timetable": d.model_copy(update={"setup_snapshot": safe}),
    }
