import { useEffect, useState } from 'react';
import type { TimetableSummary } from '../../types';
import { cx } from '../../lib/colors';
import { Spinner } from '../Spinner';

const PHASE_LABEL: Record<string, string> = {
  queued: 'În coadă',
  analyze: 'Verificăm datele',
  expand: 'Pregătim lecțiile',
  model: 'Construim modelul',
  solve: 'Căutăm cel mai bun orar',
  time: 'Așezăm lecțiile în timp',
  rooms: 'Alocăm sălile',
  validate: 'Verificăm rezultatul',
  done: 'Gata',
};

export function phaseLabel(phase: string): string {
  return PHASE_LABEL[phase] ?? (phase ? phase.charAt(0).toUpperCase() + phase.slice(1) : 'Pornim');
}

/** Live progress of a running generation; estimated bar from elapsed / time limit. */
export function ProgressCard({ t, limitS, startedAt }: { t: TimetableSummary; limitS: number | null; startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.max(0, (now - startedAt) / 1000);
  const pct = limitS ? Math.min(95, Math.round((elapsed / (limitS + 5)) * 100)) : null;
  const queued = t.status === 'queued';

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-4">
      <div className="flex items-center gap-3">
        <Spinner className="h-5 w-5 text-indigo-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{queued ? 'În coadă…' : phaseLabel(t.progress.phase)}</p>
          <p className="truncate text-xs text-slate-500">{t.progress.message || 'Lucrăm la el…'}</p>
        </div>
        {t.progress.best_penalty !== undefined && t.progress.best_penalty !== null && (
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums text-indigo-700">{t.progress.best_penalty}</p>
            <p className="text-[11px] text-slate-500">penalizare (mai mic = mai bun)</p>
          </div>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-100">
        {pct === null ? (
          <div className="h-full w-full animate-shimmer rounded-full bg-[linear-gradient(90deg,#c7d2fe_0%,#6366f1_50%,#c7d2fe_100%)] bg-[length:200%_100%]" />
        ) : (
          <div className={cx('h-full rounded-full bg-indigo-500 transition-all duration-300')} style={{ width: `${pct}%` }} />
        )}
      </div>
      <p className="mt-1.5 text-right text-[11px] tabular-nums text-slate-400">{Math.round(elapsed)} s{limitS ? ` din ~${limitS} s` : ''}</p>
    </div>
  );
}
