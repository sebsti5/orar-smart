"""Background solve runner.

Each timetable is solved in a worker thread. Progress reported by the solver is
persisted in `timetables.progress_json` (throttled), the final `SolveResult`
in `result_json`. Jobs interrupted by a server restart are marked failed.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from sqlalchemy import select

from app import db
from app.models import Timetable
from app.schemas import InstitutionSetup, SolveResult

log = logging.getLogger("orar.jobs")

MAX_WORKERS = 2
PROGRESS_MIN_INTERVAL_S = 0.5  # at most 2 DB writes per second

_executor: ThreadPoolExecutor | None = None
_executor_lock = threading.Lock()


def solve(setup: InstitutionSetup, time_limit_s: int = 30, progress_cb=None) -> SolveResult:
    """Lazy wrapper around the solver (patched in tests)."""
    from app.solver import solve as _solve

    return _solve(setup, time_limit_s=time_limit_s, progress_cb=progress_cb)


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    with _executor_lock:
        if _executor is None:
            _executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="solve")
        return _executor


# ------------------------------------------------------------------ progress


def normalize_progress(*args: Any, **kwargs: Any) -> dict:
    """Accept progress as a dict, a pydantic model, (phase, message, best_penalty) or text."""
    if kwargs and not args:
        data = dict(kwargs)
    elif len(args) == 1 and isinstance(args[0], dict):
        data = dict(args[0])
    elif len(args) == 1 and hasattr(args[0], "model_dump"):
        data = args[0].model_dump()
    elif len(args) == 1:
        data = {"phase": "running", "message": str(args[0])}
    else:
        keys = ("phase", "message", "best_penalty")
        data = {k: v for k, v in zip(keys, args)}
        data.update(kwargs)
    data.setdefault("phase", "running")
    data.setdefault("message", "")
    return {k: v for k, v in data.items() if v is not None or k in ("phase", "message")}


class ProgressRecorder:
    """Callable handed to the solver; writes at most once per `min_interval_s`."""

    def __init__(self, write: Callable[[dict], None], min_interval_s: float | None = None):
        self._write = write
        self._interval = PROGRESS_MIN_INTERVAL_S if min_interval_s is None else min_interval_s
        self._last_write = 0.0
        self._pending: dict | None = None
        self._lock = threading.Lock()

    def __call__(self, *args: Any, **kwargs: Any) -> None:
        progress = normalize_progress(*args, **kwargs)
        with self._lock:
            self._pending = progress
            now = time.monotonic()
            if now - self._last_write < self._interval:
                return
            self._last_write = now
            self._pending = None
        self._safe_write(progress)

    def flush(self) -> None:
        with self._lock:
            pending, self._pending = self._pending, None
        if pending is not None:
            self._safe_write(pending)

    def _safe_write(self, progress: dict) -> None:
        try:
            self._write(progress)
        except Exception:  # progress is best effort; never kill the solve
            log.exception("could not store progress")


# ------------------------------------------------------------------ DB updates


def _update(timetable_id: int, **fields: Any) -> bool:
    with db.session_scope() as s:
        t = s.get(Timetable, timetable_id)
        if t is None:  # deleted meanwhile
            return False
        for k, v in fields.items():
            setattr(t, k, v)
        return True


def _write_progress(timetable_id: int, progress: dict) -> None:
    _update(timetable_id, progress_json=json.dumps(progress, ensure_ascii=False))


# ------------------------------------------------------------------ runner


def run_job(timetable_id: int, setup: InstitutionSetup, time_limit_s: int) -> None:
    started = _update(
        timetable_id,
        status="running",
        progress_json=json.dumps({"phase": "start", "message": "Se pregătește calculul"}),
    )
    if not started:
        return
    recorder = ProgressRecorder(lambda p: _write_progress(timetable_id, p))
    try:
        result = solve(setup, time_limit_s, recorder)
        if not isinstance(result, SolveResult):
            result = SolveResult.model_validate(result)
    except Exception as exc:
        log.exception("solve failed for timetable %s", timetable_id)
        _update(
            timetable_id,
            status="failed",
            progress_json=json.dumps(
                {"phase": "failed", "message": f"Eroare la generarea orarului: {exc}"},
                ensure_ascii=False,
            ),
        )
        return
    recorder.flush()
    progress = {
        "phase": "done",
        "message": result.message or "Orarul a fost generat.",
        "best_penalty": result.score.total_penalty,
    }
    _update(
        timetable_id,
        status="done",
        result_json=result.model_dump_json(),
        progress_json=json.dumps(progress, ensure_ascii=False),
    )


def submit(timetable_id: int, setup: InstitutionSetup, time_limit_s: int) -> None:
    _get_executor().submit(run_job, timetable_id, setup, time_limit_s)


def recover_interrupted() -> int:
    """Mark jobs left queued/running by a previous process as failed."""
    msg = json.dumps(
        {"phase": "failed", "message": "Calculul a fost întrerupt de o repornire a serverului."},
        ensure_ascii=False,
    )
    with db.session_scope() as s:
        rows = s.scalars(select(Timetable).where(Timetable.status.in_(("queued", "running"))))
        count = 0
        for t in rows:
            t.status = "failed"
            t.progress_json = msg
            count += 1
    return count
