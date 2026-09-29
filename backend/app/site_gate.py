"""Optional whole-site password (HTTP Basic) for private deployments.

Enabled only when env `ORAR_SITE_PASSWORD` is set. Any username is accepted;
only the password is checked. `/api/health` stays open for monitoring.
"""

from __future__ import annotations

import base64
import binascii
import hmac
import os

from starlette.types import ASGIApp, Receive, Scope, Send

OPEN_PATHS = frozenset({"/api/health"})
REALM = 'Basic realm="Orar Smart", charset="UTF-8"'


def _password_from_header(value: str) -> str | None:
    scheme, _, token = value.partition(" ")
    if scheme.lower() != "basic" or not token:
        return None
    try:
        decoded = base64.b64decode(token, validate=True).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError):
        return None
    _, sep, password = decoded.partition(":")
    return password if sep else None


class SiteGate:
    def __init__(self, app: ASGIApp, password: str) -> None:
        self.app = app
        self.expected = password.encode("utf-8")

    def _allowed(self, scope: Scope) -> bool:
        if scope.get("path") in OPEN_PATHS:
            return True
        headers = dict(scope.get("headers") or [])
        raw = headers.get(b"authorization", b"").decode("latin-1")
        given = _password_from_header(raw)
        return given is not None and hmac.compare_digest(given.encode("utf-8"), self.expected)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or self._allowed(scope):
            await self.app(scope, receive, send)
            return
        body = "Acces restricționat.".encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": 401,
            "headers": [
                (b"www-authenticate", REALM.encode()),
                (b"content-type", b"text/plain; charset=utf-8"),
                (b"content-length", str(len(body)).encode()),
            ],
        })
        await send({"type": "http.response.body", "body": body})


def site_password() -> str | None:
    return os.environ.get("ORAR_SITE_PASSWORD") or None
