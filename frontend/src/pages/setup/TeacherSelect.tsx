import type { InstitutionSetup, LessonKind } from '../../types';
import { cx } from '../../lib/colors';
import { formatPairs } from '../../components/LoadBar';
import { rankTeachers } from '../../lib/planning';
import type { TeacherLoadInfo } from '../../lib/planning';

export function TeacherSelect({
  setup,
  subjectId,
  kind,
  value,
  onChange,
  className,
  loads,
}: {
  loads: Map<string, TeacherLoadInfo>;
  setup: InstitutionSetup;
  subjectId: string;
  kind: LessonKind;
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const { capable, others } = rankTeachers(setup.teachers, subjectId, kind);
  const label = (id: string) => {
    const t = setup.teachers.find((x) => x.id === id);
    if (!t) return '?';
    const l = loads.get(id);
    return l ? `${t.name} · ${formatPairs(l.load)}/${formatPairs(l.capacity)}` : t.name;
  };
  const known = setup.teachers.some((t) => t.id === value);
  const notCapable = known && !capable.some((t) => t.id === value);
  return (
    <select
      value={known ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'h-9 w-full rounded-lg border bg-white px-2 pr-7 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100',
        !known ? 'border-rose-300 text-rose-600' : notCapable ? 'border-amber-300' : 'border-slate-200',
        className,
      )}
      title={notCapable ? 'Profesorul nu are bifată această disciplină la „Ce predă”.' : undefined}
    >
      <option value="">— alege profesorul —</option>
      {capable.length > 0 && (
        <optgroup label="Pot preda">
          {capable.map((t) => (
            <option key={t.id} value={t.id}>{label(t.id)}</option>
          ))}
        </optgroup>
      )}
      {others.length > 0 && (
        <optgroup label="Alți profesori">
          {others.map((t) => (
            <option key={t.id} value={t.id}>{label(t.id)}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
