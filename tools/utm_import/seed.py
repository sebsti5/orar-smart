import json, os, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from sqlalchemy import select
from app.db import session_scope
from app.models import Institution, Timetable, User
from app.schemas import InstitutionSetup
from app.solver import solve

EMAIL = os.environ.get("SEED_EMAIL") or sys.exit("Set SEED_EMAIL to the account that should receive the data.")
setup = InstitutionSetup.model_validate(json.load(open("utm_setup.json")))
with session_scope() as db:
    user = db.scalar(select(User).where(User.email == EMAIL.strip().lower()))
    if user is None:
        sys.exit(f"No account with email {EMAIL!r}; register it in the app first.")
    inst = db.get(Institution, user.institution_id)
    inst.setup_json = setup.model_dump_json()
    inst_id = inst.id
print("setup saved for institution", inst_id)
t = time.time()
result = solve(setup, time_limit_s=180)
print(result.status, len(result.lessons), result.score.model_dump(), round(time.time() - t))
with session_scope() as db:
    db.add(Timetable(institution_id=inst_id, name="FCIM UTM — toamna 2026 (generat)", status="done",
                     progress_json=json.dumps({"phase": "done", "message": result.message}),
                     result_json=result.model_dump_json(), setup_snapshot_json=setup.model_dump_json(),
                     time_limit_s=180))
print("timetable saved")
