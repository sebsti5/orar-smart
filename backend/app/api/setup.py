"""/api/setup, /api/analysis, /api/share-token."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.common import load_setup, solver_unavailable
from app.auth import current_user
from app.db import get_db
from app.models import User
from app.schemas import Analysis, InstitutionSetup

router = APIRouter(tags=["setup"])


# Lazy wrappers: the solver package may not be importable yet; tests patch these names.
def analyze(setup: InstitutionSetup) -> Analysis:
    from app.solver import analyze as _analyze

    return _analyze(setup)


def auto_assign(setup: InstitutionSetup):
    from app.solver import auto_assign as _auto_assign

    return _auto_assign(setup)


def demo_setup() -> InstitutionSetup:
    from app.demo import demo_setup as _demo_setup

    return _demo_setup()


def _analysis(setup: InstitutionSetup) -> Analysis:
    try:
        return analyze(setup)
    except Exception as exc:
        raise solver_unavailable(exc) from exc


def _save(db: Session, user: User, setup: InstitutionSetup) -> dict:
    analysis = _analysis(setup)
    user.institution.setup_json = setup.model_dump_json()
    db.commit()
    return {"setup": setup, "analysis": analysis}


@router.get("/setup", response_model=InstitutionSetup)
def get_setup(user: User = Depends(current_user)) -> InstitutionSetup:
    return load_setup(user.institution)


@router.put("/setup")
def put_setup(body: InstitutionSetup, user: User = Depends(current_user),
              db: Session = Depends(get_db)) -> dict:
    return _save(db, user, body)


@router.post("/setup/demo")
def load_demo(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    try:
        setup = demo_setup()
    except Exception as exc:
        raise solver_unavailable(exc) from exc
    return _save(db, user, setup)


@router.post("/setup/auto-assign")
def post_auto_assign(user: User = Depends(current_user)) -> dict:
    setup = load_setup(user.institution)
    try:
        assignments = auto_assign(setup)
    except Exception as exc:
        raise solver_unavailable(exc) from exc
    merged = setup.model_copy(update={"assignments": list(assignments)})
    return {"assignments": assignments, "analysis": _analysis(merged)}


@router.get("/analysis", response_model=Analysis)
def get_analysis(user: User = Depends(current_user)) -> Analysis:
    return _analysis(load_setup(user.institution))


@router.get("/share-token")
def share_token(user: User = Depends(current_user)) -> dict:
    return {"token": user.institution.share_token}
