# Orar Smart — spec (2026-09-22)

## Goal
A web app where a university enters its data through a friendly wizard and gets a
clash-free, humane timetable generated automatically — viewable per group
(UTM-style grid: groups as columns, days × slots as rows), per teacher and per
room, editable by drag & drop, exportable to Excel, shareable via public link.

Source requirements: `~/Downloads/Setup.xlsx` (General Setup + University sheets).
Reference output: FCIM UTM timetables (fcim.utm.md/procesul-de-studii/orar/):
7 slots of 90 min (08:00, 09:45, 11:30, 13:30, 15:15, 17:00, 18:45), big break
after slot 3, lectures merged across a stream of groups, odd/even-week split cells,
labs per subgroup, room codes like `3-611`.

Scope v1: **University**. College/School reuse the same model later (out of scope).
UI language: **Romanian**.

## Stack
- `backend/`: Python 3.12, FastAPI, SQLAlchemy + SQLite, OR-Tools CP-SAT, pytest. Run with `uv`.
- `frontend/`: React 18 + Vite + TypeScript + Tailwind + react-router. Dev proxy `/api` → `http://127.0.0.1:8000`.
- Data contract: `backend/app/schemas.py` (THE source of truth). Frontend mirrors it in `frontend/src/types.ts`.

## Data model
One JSON document per institution (`InstitutionSetup`) + a list of generated timetables.
Tables: `users(id, email, password_hash, institution_id)`, `institutions(id, name, setup_json, share_token)`,
`timetables(id, institution_id, created_at, status, progress_json, result_json, published, name)`.

## Solver (backend/app/solver/)
Pure functions, no DB/HTTP:
- `analyze(setup) -> Analysis` — pre-check: dangling ids, subjects without assignments,
  groups without subject coverage, teacher load > availability or > max_pairs, group load >
  days × max_lessons, rooms: for each kind & capacity threshold, sessions needing it per week
  vs room-slots available, stream groups from different programs/years (warning), 0.5 hours
  with parity off (error), teacher assigned to kind they're not capable of (warning).
- `expand_sessions(setup) -> list[Session]` — each assignment → ⌊h⌋ weekly sessions +
  1 biweekly session if h has .5; labs with lab_split_subgroups → one per subgroup of each group.
- `solve(setup, time_limit_s=30, progress_cb=None) -> SolveResult` — two phases:
  1. CP-SAT time assignment: x[session, day, slot] bools (only for allowed day/slots:
     teacher availability, pins). Biweekly sessions get a parity bool. Hard: each session
     once; per (teacher|group|subgroup, day, slot, parity) ≤ 1 (whole-group lessons clash with
     every subgroup; subgroups of the same group don't clash with each other); per group/day
     ≤ max_lessons_per_day; room-kind capacity (Hall condition per kind and capacity
     threshold: sessions needing ≥c seats of kind k in a slot ≤ rooms of kind k (or "any")
     with capacity ≥ c free in that slot); pinned lessons fixed.
     Soft (weighted): group gaps (×10), teacher gaps (×3), group days with 1..min-1
     lessons (×8), same subject+kind twice same day for a group (×5), lessons in last two
     slots (×2 each), lectures after slot 4 (×1), unbalanced days per group (×1).
  2. Room assignment per (day, slot): small CP-SAT/matching choosing rooms with enough
     capacity, right kind/tag, not unavailable, preferring smallest adequate room and
     keeping a group in the same building across consecutive slots. Unassignable → Violation.
- `validate(setup, lessons) -> list[Violation]` — used after manual moves.
- `auto_assign(setup) -> list[Assignment]` — "smart fill": for every subject×kind with hours,
  lectures per stream (or per group if no stream contains it), seminars/labs per group, pick a
  capable teacher balancing load against max_pairs; keeps existing assignments.
- `demo_setup() -> InstitutionSetup` in `backend/app/demo.py` — realistic FCIM-like data:
  6 programs (TI, SI, IA, CR, AI, RM), ~14 groups over years 1–2, ~35 teachers, ~25 rooms
  (lecture halls 100–150, seminar 30, labs with tag "computers"/"electronics", 1 sport),
  streams, full assignments, week_parity on. Must solve to "feasible"/"optimal" in < 30 s.

## HTTP API (all JSON, prefix /api, cookie auth `session` = JWT HS256, secret from env
`ORAR_SECRET` with dev fallback + warning)
| Method | Path | Body → Response |
|---|---|---|
| POST | /auth/register | {email, password, institution_name} → {email, institution_name} + cookie |
| POST | /auth/login | {email, password} → same |
| POST | /auth/logout | → {ok:true} |
| GET | /auth/me | → {email, institution_name} or 401 |
| GET | /setup | → InstitutionSetup |
| PUT | /setup | InstitutionSetup → {setup, analysis: Analysis} (422 on schema error) |
| POST | /setup/demo | → {setup, analysis} (replaces setup with demo) |
| POST | /setup/auto-assign | → {assignments: Assignment[], analysis} (NOT saved; client merges then PUTs) |
| GET | /analysis | → Analysis |
| POST | /timetables | {name?, group_ids?: string[] (empty = all), time_limit_s?: 5..120} → TimetableSummary |
| GET | /timetables | → TimetableSummary[] |
| GET | /timetables/{id} | → TimetableDetail |
| DELETE | /timetables/{id} | → {ok:true} |
| POST | /timetables/{id}/move | {lesson_id, day, slot, room_id?} → {lessons, violations} (saved even with violations; violations returned) |
| POST | /timetables/{id}/publish | {published: bool} → TimetableSummary |
| GET | /timetables/{id}/export.xlsx | → xlsx file (UTM layout: groups columns, day×slot rows, merged stream cells) |
| GET | /share-token | → {token} (institution's public token) |
| GET | /public/{token} | → {institution_name, setup (names only fine to expose), timetable: TimetableDetail} of the latest published, 404 if none |

`TimetableSummary = {id, name, created_at, status: "queued"|"running"|"done"|"failed", published, progress: {phase, message, best_penalty?}}`
`TimetableDetail = TimetableSummary + {result: SolveResult | null, setup_snapshot: InstitutionSetup}`

Solving runs in a background thread; client polls GET /timetables/{id} every 1 s.
Login rate limit: 10 failed attempts / 15 min per email. Passwords bcrypt, min 8 chars.

## Frontend pages
- `/` landing (what it does, login/register). `/login`, `/register`.
- `/app/setup` — wizard with stepper: 1 General (bell schedule editor, parity toggle, days,
  min/max) · 2 Programe & Grupe (grid, paste from Excel, auto-detect program/year from name
  `TI-241`) · 3 Săli · 4 Profesori (+ capabilities, weekly availability grid click/drag paint) ·
  5 Plan de învățământ (subjects per program/year) · 6 Serii (streams; suggest by program+year) ·
  7 Repartizare (assignments; "Completează automat" button) · 8 Verificare (analysis issues with
  "Mergi la" links, load bars) → "Generează orarul". Autosave (debounced PUT). "Încarcă date demo".
- `/app/timetables` — list + generate dialog + live progress.
- `/app/timetables/:id` — views: Grupe (UTM grid, groups as columns filtered by year/program,
  stream lectures merged across columns, odd/even split cells), Profesor, Sală; color by kind
  (curs/seminar/laborator); drag & drop to move with instant violation feedback; Export Excel;
  Publică + copy public link; Print CSS.
- `/p/:token` — public read-only viewer, pick group/teacher/room.
