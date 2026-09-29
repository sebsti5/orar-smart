# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-09-29

First public release.

### Added
- Eight-step setup wizard with autosave, paste-from-Excel grids and a one-click demo faculty.
- Two-phase OR-Tools CP-SAT solver: time slots with odd/even weeks and subgroups, then rooms.
- Pre-flight analysis with actionable warnings and “smart fill” teacher assignment.
- UTM/FCIM-style timetable viewer by group, teacher and room, with drag & drop editing.
- Excel export, print layout and public read-only links.
- FCIM UTM PDF importer (`tools/utm_import`).
- Production Docker image, optional site-wide password, solver thread cap.

### Security
- Upgraded `react-router-dom` to 7.18 (open-redirect advisory) and `vitest` to 5.

[0.1.0]: https://github.com/sebsti5/orar-smart/releases/tag/v0.1.0
