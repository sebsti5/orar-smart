"""FastAPI application: /api routers + built frontend (SPA) when available."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app import auth, db, jobs
from app.site_gate import SiteGate, site_password
from app.api import auth as auth_api
from app.api import public as public_api
from app.api import setup as setup_api
from app.api import timetables as timetables_api

log = logging.getLogger("orar")

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.configure()
    auth.get_secret()  # log the dev-secret warning early
    interrupted = jobs.recover_interrupted()
    if interrupted:
        log.warning("%d calcul(e) întrerupte marcate ca eșuate", interrupted)
    yield


def _api_router() -> APIRouter:
    api = APIRouter(prefix="/api")
    api.include_router(auth_api.router)
    api.include_router(setup_api.router)
    api.include_router(timetables_api.router)
    api.include_router(public_api.router)

    @api.get("/health")
    def health() -> dict:
        return {"ok": True}

    @api.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
                   include_in_schema=False)
    def api_not_found(path: str) -> None:
        raise HTTPException(status_code=404, detail="Resursa nu a fost găsită.")

    return api


def _mount_frontend(app: FastAPI, dist: Path) -> None:
    index = dist / "index.html"
    if not index.is_file():
        return
    root = dist.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        candidate = (root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)
        return FileResponse(index)


def create_app(frontend_dist: Path | None = None) -> FastAPI:
    app = FastAPI(title="Orar Smart", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(_api_router())
    _mount_frontend(app, frontend_dist or FRONTEND_DIST)
    password = site_password()
    if password:
        app.add_middleware(SiteGate, password=password)
    return app


app = create_app()
