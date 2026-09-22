#!/usr/bin/env bash
# Dev server for the Orar Smart API (http://127.0.0.1:8000, frontend proxy /api).
set -euo pipefail
cd "$(dirname "$0")"
exec uv run uvicorn app.main:app --reload --port 8000 "$@"
