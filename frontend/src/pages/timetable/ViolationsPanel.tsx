import { useState } from 'react';
import type { Violation } from '../../types';
import { SEVERITY_STYLE, cx } from '../../lib/colors';

export function ViolationsPanel({ violations, unplaced }: { violations: Violation[]; unplaced: number }) {
  const [open, setOpen] = useState(true);
  if (violations.length === 0 && unplaced === 0) {
    return <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 print:hidden">✓ Fără conflicte: nicio suprapunere de profesori, grupe sau săli.</p>;
  }
  const errors = violations.filter((v) => v.severity === 'error').length;
  return (
    <div className={cx('rounded-xl border px-4 py-3 print:hidden', errors ? SEVERITY_STYLE.error.box : SEVERITY_STYLE.warning.box)}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-semibold text-slate-800">
          {errors > 0 ? `⛔ ${errors} conflicte` : '⚠️ Atenționări'}
          {violations.length - errors > 0 && ` · ${violations.length - errors} atenționări`}
          {unplaced > 0 && ` · ${unplaced} lecții neplasate`}
        </span>
        <span className="text-xs text-slate-500">{open ? 'Ascunde' : 'Arată'}</span>
      </button>
      {open && (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {violations.map((v, i) => (
            <li key={`${v.code}-${i}`} className="flex gap-2 text-sm text-slate-700">
              <span aria-hidden>{SEVERITY_STYLE[v.severity].icon}</span>
              <span>{v.message}</span>
            </li>
          ))}
          {errors > 0 && <li className="pt-1 text-xs text-slate-500">Lecțiile afectate sunt încercuite cu roșu în orar. Trage-le într-o altă celulă.</li>}
        </ul>
      )}
    </div>
  );
}
