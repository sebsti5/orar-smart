import type { StepDef } from '../lib/steps';
import { cx } from '../lib/colors';

export function Stepper({
  steps,
  current,
  onSelect,
  counts,
}: {
  steps: StepDef[];
  current: number;
  onSelect: (n: number) => void;
  counts: Record<number, { errors: number; warnings: number }>;
}) {
  return (
    <nav aria-label="Pașii configurării" className="flex flex-col gap-1">
      {steps.map((s) => {
        const active = s.n === current;
        const c = counts[s.n] ?? { errors: 0, warnings: 0 };
        return (
          <button
            key={s.n}
            type="button"
            onClick={() => onSelect(s.n)}
            aria-current={active ? 'step' : undefined}
            className={cx(
              'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
              active ? 'bg-white shadow-soft ring-1 ring-slate-200' : 'hover:bg-white/70',
            )}
          >
            <span
              className={cx(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                active ? 'bg-indigo-600 text-white' : 'bg-slate-200/70 text-slate-600 group-hover:bg-slate-200',
              )}
            >
              {s.n}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cx('block truncate text-sm font-medium', active ? 'text-slate-900' : 'text-slate-700')}>{s.title}</span>
              <span className="block truncate text-xs text-slate-400">{s.hint}</span>
            </span>
            {c.errors > 0 ? (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700" title={`${c.errors} erori`}>
                {c.errors}
              </span>
            ) : c.warnings > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800" title={`${c.warnings} avertismente`}>
                {c.warnings}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
