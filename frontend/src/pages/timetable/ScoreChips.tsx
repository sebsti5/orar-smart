import type { Score, SolveResult } from '../../types';
import { cx } from '../../lib/colors';
import { SOLVE_STATUS_LABEL } from '../../lib/labels';

function Chip({ label, value, tone }: { label: string; value: number | string; tone: 'good' | 'warn' | 'neutral' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs',
        tone === 'good' ? 'bg-emerald-50 text-emerald-700' : tone === 'warn' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600',
      )}
    >
      <span className="font-semibold tabular-nums">{value}</span> {label}
    </span>
  );
}

export function ScoreChips({ result }: { result: SolveResult }) {
  const s: Score = result.score;
  const tone = (n: number) => (n === 0 ? 'good' : 'warn');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip label="stare" value={SOLVE_STATUS_LABEL[result.status] ?? result.status} tone={result.status === 'optimal' || result.status === 'feasible' ? 'good' : 'warn'} />
      <Chip label="ferestre grupe" value={s.group_gaps} tone={tone(s.group_gaps)} />
      <Chip label="ferestre profesori" value={s.teacher_gaps} tone={tone(s.teacher_gaps)} />
      <Chip label="lecții târzii" value={s.late_lessons} tone={tone(s.late_lessons)} />
      {s.same_subject_same_day > 0 && <Chip label="aceeași disciplină de 2× pe zi" value={s.same_subject_same_day} tone="warn" />}
      <Chip label="penalizare totală" value={s.total_penalty} tone="neutral" />
      {result.solve_seconds > 0 && <Chip label="s calcul" value={result.solve_seconds.toFixed(1)} tone="neutral" />}
    </div>
  );
}
