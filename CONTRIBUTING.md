# Contributing to Orar Smart

Thanks for taking the time to contribute! Bug reports, ideas and pull requests are all welcome.

## Getting started

```bash
git clone https://github.com/sebsti5/orar-smart.git
cd orar-smart
cd backend  && ./run.sh                    # API on :8000 (needs uv)
cd frontend && npm install && npm run dev  # web app on :5173 (needs Node 20+)
```

## Before you open a pull request

```bash
cd backend  && uv run pytest
cd frontend && npm run typecheck && npm test && npm run build
```

- Keep pull requests focused — one change per PR.
- Add or update tests for any behaviour change; the solver in `backend/app/solver/` is pure
  and easy to test without HTTP or a database.
- `backend/app/schemas.py` is the data contract. If you change it, mirror the change in
  `frontend/src/types.ts`.
- The UI language is **Romanian** — keep user-facing strings in Romanian.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`, `ci:`.

## Reporting bugs

Open an issue with the bug report template. For solver problems, attaching the exported setup
(or a minimal version of it) makes a fix much faster.

Security issues: see [SECURITY.md](SECURITY.md).

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating you agree
to uphold it.
