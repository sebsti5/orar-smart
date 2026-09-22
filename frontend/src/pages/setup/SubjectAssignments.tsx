import type { Assignment, InstitutionSetup, Subject } from '../../types';
import { Badge, Chip } from '../../components/Badge';
import { formatPairs } from '../../components/LoadBar';
import { KIND_STYLE, cx } from '../../lib/colors';
import { coverageGaps, makeAssignment } from '../../lib/coverage';
import { KIND_LABEL } from '../../lib/labels';
import { assignmentHours, hoursFor, rankTeachers } from '../../lib/planning';
import type { TeacherLoadInfo } from '../../lib/planning';
import { TeacherSelect } from './TeacherSelect';

export function SubjectAssignments({
  setup,
  subject,
  onChange,
  loads,
}: {
  loads: Map<string, TeacherLoadInfo>;
  setup: InstitutionSetup;
  subject: Subject;
  onChange: (next: Assignment[]) => void;
}) {
  const mine = setup.assignments.filter((a) => a.subject_id === subject.id);
  const gaps = coverageGaps(setup, subject);
  const groupName = (id: string) => setup.groups.find((g) => g.id === id)?.name ?? '?';
  const program = setup.programs.find((p) => p.id === subject.program_id);

  const replaceOne = (a: Assignment) => onChange(setup.assignments.map((x) => (x.id === a.id ? a : x)));
  const remove = (id: string) => onChange(setup.assignments.filter((x) => x.id !== id));
  const addGap = (kind: Assignment['kind'], groupIds: string[]) => {
    const best = rankTeachers(setup.teachers, subject.id, kind).capable[0];
    onChange([...setup.assignments, makeAssignment(setup, subject.id, kind, groupIds, best?.id ?? '')]);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <p className="font-medium text-slate-900">{subject.name}</p>
        <Badge>{program?.abbreviation ?? '?'} · anul {subject.year}</Badge>
        <span className="ml-auto flex gap-1">
          {(['lecture', 'seminar', 'lab'] as const).map((k) =>
            hoursFor(subject, k) > 0 ? (
              <Badge key={k} className={KIND_STYLE[k].chip}>
                {KIND_LABEL[k]} {formatPairs(hoursFor(subject, k))}
              </Badge>
            ) : null,
          )}
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {mine.map((a) => (
          <div key={a.id} className="grid items-center gap-2 px-4 py-2 sm:grid-cols-[110px_minmax(0,1fr)_260px_32px]">
            <span className={cx('w-fit rounded-md px-2 py-0.5 text-xs font-medium', KIND_STYLE[a.kind].chip)}>
              {KIND_LABEL[a.kind]} · {formatPairs(assignmentHours(a, subject))}
            </span>
            <div className="flex flex-wrap gap-1">
              {a.group_ids.map((g) => (
                <Chip key={g}>{groupName(g)}</Chip>
              ))}
            </div>
            <TeacherSelect loads={loads} setup={setup} subjectId={subject.id} kind={a.kind} value={a.teacher_id} onChange={(teacher_id) => replaceOne({ ...a, teacher_id })} />
            <button type="button" onClick={() => remove(a.id)} className="rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600" aria-label="Șterge repartizarea">
              🗑
            </button>
          </div>
        ))}
        {gaps.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 bg-amber-50/50 px-4 py-2">
            <span className="text-xs font-medium text-amber-800">Lipsesc:</span>
            {gaps.map((g, i) => (
              <button
                key={`${g.kind}-${i}`}
                type="button"
                onClick={() => addGap(g.kind, g.groupIds)}
                className="rounded-lg border border-dashed border-amber-300 bg-white px-2 py-0.5 text-xs text-amber-800 hover:border-amber-400 hover:bg-amber-50"
                title="Adaugă repartizarea"
              >
                ＋ {KIND_LABEL[g.kind]} · {g.groupIds.map(groupName).join(', ')}
              </button>
            ))}
          </div>
        )}
        {mine.length === 0 && gaps.length === 0 && <p className="px-4 py-3 text-xs text-slate-400">Nicio grupă nu urmează această disciplină.</p>}
      </div>
    </div>
  );
}
