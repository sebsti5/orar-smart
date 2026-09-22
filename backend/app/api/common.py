"""Helpers shared by the routers."""

from __future__ import annotations

import logging

from fastapi import HTTPException
from pydantic import ValidationError

from app.models import Institution
from app.schemas import InstitutionSetup

log = logging.getLogger("orar.api")


def load_setup(inst: Institution) -> InstitutionSetup:
    try:
        return InstitutionSetup.model_validate_json(inst.setup_json)
    except ValidationError as exc:  # stored data should always be valid
        raise HTTPException(status_code=500, detail="Datele instituției sunt corupte.") from exc


def solver_unavailable(exc: Exception) -> HTTPException:
    log.error("solver call failed", exc_info=exc)
    return HTTPException(
        status_code=503,
        detail=f"Motorul de calcul al orarului nu este disponibil momentan ({type(exc).__name__}).",
    )
