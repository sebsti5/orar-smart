"""SQLite engine/session management.

The database path comes from env `ORAR_DB` (default: backend/data/orar.db).
`configure()` is called at app startup, so tests can point each run at a
temporary file by setting the env var before starting the TestClient.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "orar.db"


class Base(DeclarativeBase):
    pass


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def db_path_from_env() -> Path:
    return Path(os.environ.get("ORAR_DB") or DEFAULT_DB_PATH)


def _sqlite_pragmas(dbapi_conn, _record) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


def configure(path: Path | None = None) -> Engine:
    """(Re)create the engine for `path` and create all tables."""
    global _engine, _session_factory
    from app import models  # noqa: F401  (register tables)

    target = Path(path) if path else db_path_from_env()
    target.parent.mkdir(parents=True, exist_ok=True)
    if _engine is not None:
        _engine.dispose()
    engine = create_engine(
        f"sqlite:///{target}", connect_args={"check_same_thread": False}
    )
    event.listen(engine, "connect", _sqlite_pragmas)
    Base.metadata.create_all(engine)
    _engine = engine
    _session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    return engine


def new_session() -> Session:
    if _session_factory is None:
        configure()
    assert _session_factory is not None
    return _session_factory()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional scope for background code: commit on success, rollback on error."""
    session = new_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Iterator[Session]:
    """FastAPI dependency."""
    session = new_session()
    try:
        yield session
    finally:
        session.close()
