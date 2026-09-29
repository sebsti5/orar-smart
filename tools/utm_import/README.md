# Import FCIM UTM timetables

Seeds an account with real FCIM data parsed from the published PDFs
(https://fcim.utm.md/procesul-de-studii/orar/, full-time years I–IV).

```bash
cd tools/utm_import
uv venv && uv pip install pdfplumber
curl -sLO <pdf url>   # anul_i_semestrul_i-*.pdf … anul_iv_semestrul_vii-*.pdf
uv run --no-project python parse_utm.py anul_i.pdf 1 anul_ii.pdf 2 anul_iii.pdf 3 anul_iv.pdf 4   # → raw.json
uv run --project ../../backend python build_setup.py                                         # → utm_setup.json
SEED_EMAIL=you@example.com ORAR_DB=../../backend/data/orar.db uv run --project ../../backend python seed.py
```

How parsing works: each word is placed in the box formed by the nearest thin border on
each side; header boxes → group columns (a box can hold 2 groups), left time boxes →
day/slot rows, half-height boxes → odd/even week. Cells: `c.` = lecture, `lab.` = lab,
otherwise seminar; abbreviations (ALGA, POO) are expanded via lecture-name initials.

Known approximations: 25 students/group, room capacity inferred from use, only the first
teacher of a multi-teacher cell is kept, cells without a teacher get a placeholder
"Nespecificat (…)" teacher, "Activități individuale" cells are skipped.
