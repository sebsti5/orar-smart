"""Password hashing, JWT session cookie, login rate limiting, current-user dependency."""

from __future__ import annotations

import logging
import os
from pathlib import Path
import secrets
import re
import threading
import time
from collections import defaultdict, deque

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User

log = logging.getLogger("orar.auth")

COOKIE_NAME = "session"
TOKEN_TTL_S = 7 * 24 * 3600
JWT_ALG = "HS256"
MIN_PASSWORD_LEN = 8
MAX_PASSWORD_LEN = 128
RATE_LIMIT_FAILURES = 10
RATE_LIMIT_WINDOW_S = 15 * 60

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_failures: dict[str, deque[float]] = defaultdict(deque)
_failures_lock = threading.Lock()


def _now() -> float:
    return time.time()


# ------------------------------------------------------------------ secret


_generated_secret: str | None = None


def _local_secret_path() -> Path:
    from app.db import DEFAULT_DB_PATH

    db_path = Path(os.environ.get("ORAR_DB") or DEFAULT_DB_PATH)
    return db_path.parent / ".orar_secret"


def _load_or_create_local_secret() -> str:
    """Random per-installation secret kept next to the database (never in source)."""
    path = _local_secret_path()
    try:
        if path.exists():
            existing = path.read_text().strip()
            if existing:
                return existing
        path.parent.mkdir(parents=True, exist_ok=True)
        secret = secrets.token_urlsafe(48)
        path.write_text(secret)
        path.chmod(0o600)
        return secret
    except OSError as exc:
        log.warning("Nu pot salva secretul local (%s); sesiunile expiră la repornire.", exc)
        return secrets.token_urlsafe(48)


def get_secret() -> str:
    global _generated_secret
    secret = os.environ.get("ORAR_SECRET")
    if secret:
        return secret
    if os.environ.get("ORAR_ENV") == "production":
        raise RuntimeError("ORAR_SECRET trebuie setat în producție.")
    if _generated_secret is None:
        _generated_secret = _load_or_create_local_secret()
        log.warning("ORAR_SECRET nu este setat; folosesc un secret local generat aleator (%s). "
                    "Setați ORAR_SECRET în producție!", _local_secret_path())
    return _generated_secret


# ------------------------------------------------------------------ passwords / emails


def normalize_email(email: str) -> str:
    return email.strip().lower()


def is_valid_email(email: str) -> bool:
    return len(email) <= 254 and bool(EMAIL_RE.match(email))


def _pw_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:72]  # bcrypt only uses the first 72 bytes


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_pw_bytes(password), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_pw_bytes(password), password_hash.encode("ascii"))
    except ValueError:
        return False


# ------------------------------------------------------------------ tokens / cookie


def create_token(user_id: int, ttl_seconds: int = TOKEN_TTL_S) -> str:
    now = int(_now())
    payload = {"sub": str(user_id), "iat": now, "exp": now + ttl_seconds}
    return jwt.encode(payload, get_secret(), algorithm=JWT_ALG)


def decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, get_secret(), algorithms=[JWT_ALG])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        return None


def set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_token(user_id),
        max_age=TOKEN_TTL_S,
        httponly=True,
        samesite="lax",
        secure=os.environ.get("ORAR_COOKIE_SECURE") == "1",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, samesite="lax")


# ------------------------------------------------------------------ rate limit


def reset_rate_limits() -> None:
    with _failures_lock:
        _failures.clear()


def _prune(q: deque[float], now: float) -> None:
    while q and now - q[0] > RATE_LIMIT_WINDOW_S:
        q.popleft()


def is_rate_limited(email: str) -> bool:
    now = _now()
    with _failures_lock:
        q = _failures.get(email)
        if not q:
            return False
        _prune(q, now)
        return len(q) >= RATE_LIMIT_FAILURES


def record_failure(email: str) -> None:
    now = _now()
    with _failures_lock:
        q = _failures[email]
        _prune(q, now)
        q.append(now)


def clear_failures(email: str) -> None:
    with _failures_lock:
        _failures.pop(email, None)


# ------------------------------------------------------------------ dependency


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    user_id = decode_token(token) if token else None
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(status_code=401, detail="Nu sunteți autentificat.")
    return user
