import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../api';
import type { Analysis, Issue, LoadStat, Severity } from '../../types';
import { Button } from '../../components/Button';
import { Card, CardBody, CardHeader } from '../../components/Card';
import { LoadBar } from '../../components/LoadBar';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { SEVERITY_STYLE, cx } from '../../lib/colors';
import { SEVERITY_LABEL } from '../../lib/labels';
import { STEPS, issueStep } from '../../lib/steps';
import type { StepProps } from './stepTypes';

const SEVERITIES: Severity[] = ['error', 'warning', 'info'];
const LOAD_TITLES: Record<LoadStat['entity'], string> = { teacher: 'Profesori', group: 'Grupe', room_kind: 'Săli (pe tip)' };

function IssueList({ severity, issues, goTo }: { severity: Severity; issues: Issue[]; goTo: (n: number) => void }) {
  const [all, setAll] = useState(false);
  if (issues.length === 0) return null;
  const shown = all ? issues : issues.slice(0, 6);
  return (
    <div className={cx('rounded-xl border p-4', SEVERITY_STYLE[severity].box)}>
      <p className="mb-2 text-sm font-semibold text-slate-800">
        {SEVERITY_STYLE[severity].icon} {SEVERITY_LABEL[severity]} ({issues.length})
      </p>
      <ul className="space-y-1.5">
        {shown.map((i, k) => {
          const step = issueStep(i);
          return (
            <li key={`${i.code}-${i.entity_id ?? ''}-${k}`} className="flex items-start justify-between gap-3 text-sm text-slate-700">
              <span>{i.message}</span>
              {step < 8 && (
                <button type="button" onClick={() => goTo(step)} className="shrink-0 whitespace-nowrap text-xs font-medium text-indigo-600 hover:underline">
                  Mergi la pasul {step} · {STEPS[step - 1].title} →
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {issues.length > 6 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs font-medium text-slate-600 hover:underline">
          {all ? 'Arată mai puțin' : `Arată toate (${issues.length})`}
        </button>
      )}
    </div>
  );
}

export function StepReview({ setup, analysis: cached, goTo, flush }: StepProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<Analysis | null>(cached);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      await flush();
      try {
        const a = await api.analysis();
        if (alive) setAnalysis(a);
      } catch (e) {
        if (alive) toast.error(e instanceof ApiError ? e.detail : 'Nu am putut verifica datele.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const generate = async () => {
    setStarting(true);
    try {
      await flush();
      const t = await api.createTimetable({});
      toast.success('Generarea a pornit!');
      navigate('/app/timetables', { state: { watch: t.id } });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Nu am putut porni generarea.');
      setStarting(false);
    }
  };

  const errors = analysis?.issues.filter((i) => i.severity === 'error') ?? [];
  const canGenerate = !!analysis?.can_generate && !loading;
  const reason = loading
    ? 'Verificăm datele…'
    : !analysis
      ? 'Nu am putut verifica datele.'
      : !analysis.can_generate
        ? `Rezolvă mai întâi ${errors.length === 1 ? 'eroarea' : `cele ${errors.length} erori`} de mai jos.`
        : null;

  const stats = [
    { label: 'Grupe', value: setup.groups.length },
    { label: 'Profesori', value: setup.teachers.length },
    { label: 'Săli', value: setup.rooms.length },
    { label: 'Discipline', value: setup.subjects.length },
    { label: 'Repartizări', value: setup.assignments.length },
    { label: 'Lecții de plasat', value: analysis?.total_sessions ?? '—' },
  ];

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden">
        <div className="grid gap-6 bg-gradient-to-br from-indigo-600 to-indigo-500 p-6 text-white md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h3 className="text-xl font-semibold">{canGenerate ? 'Totul arată bine. Hai să generăm orarul!' : 'Aproape gata'}</h3>
            <p className="mt-1 text-sm text-indigo-100">
              {reason ?? 'Durează de obicei sub un minut. Poți ajusta orice după aceea, prin drag & drop.'}
            </p>
          </div>
          <Button size="lg" className="bg-white text-indigo-700 hover:bg-indigo-50 disabled:bg-white/40 disabled:text-indigo-200" disabled={!canGenerate} loading={starting} onClick={() => void generate()} title={reason ?? undefined}>
            {loading ? <Spinner className="h-4 w-4" /> : '⚡'} Generează orarul
          </Button>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 md:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="px-4 py-3 text-center">
              <p className="text-xl font-semibold tabular-nums text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {analysis && analysis.issues.length === 0 && !loading && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ Nu am găsit nicio problemă.</p>
      )}
      {analysis && SEVERITIES.map((sev) => <IssueList key={sev} severity={sev} issues={analysis.issues.filter((i) => i.severity === sev)} goTo={goTo} />)}

      {analysis && analysis.loads.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          {(Object.keys(LOAD_TITLES) as LoadStat['entity'][]).map((entity) => {
            const rows = analysis.loads
              .filter((l) => l.entity === entity)
              .sort((a, b) => b.required / Math.max(1, b.capacity) - a.required / Math.max(1, a.capacity));
            if (rows.length === 0) return null;
            return (
              <Card key={entity}>
                <CardHeader title={LOAD_TITLES[entity]} description="Necesar vs. disponibil (perechi/săpt.)" />
                <CardBody className="max-h-96 space-y-3 overflow-y-auto">
                  {rows.map((l) => (
                    <LoadBar key={l.entity_id} label={l.name} required={l.required} capacity={l.capacity} />
                  ))}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
