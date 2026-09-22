import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../../api';
import type { PlacedLesson, TimetableDetail, Violation } from '../../types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { PageLoader } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { ProgressCard } from '../../components/timetable/ProgressCard';
import { TimetableViewer } from '../../components/timetable/TimetableViewer';
import { useInterval } from '../../hooks/useInterval';
import { normalizeSetup } from '../../lib/setupDefaults';
import { publicLink } from '../../lib/share';
import { ScoreChips } from './ScoreChips';
import { ViolationsPanel } from './ViolationsPanel';

export function TimetableDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [tt, setTt] = useState<TimetableDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lessons, setLessons] = useState<PlacedLesson[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const d = await api.getTimetable(id);
      const detail = { ...d, setup_snapshot: normalizeSetup(d.setup_snapshot) };
      setTt(detail);
      setLessons(d.result?.lessons ?? []);
      setViolations(d.result?.violations ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'Nu am putut încărca orarul.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const running = tt?.status === 'queued' || tt?.status === 'running';
  useInterval(() => void load(), running ? 1000 : null);

  const move = async (lessonId: string, day: number, slot: number) => {
    const before = lessons;
    setLessons(lessons.map((l) => (l.id === lessonId ? { ...l, day, slot } : l)));
    setMoving(true);
    try {
      const res = await api.moveLesson(id, { lesson_id: lessonId, day, slot });
      setLessons(res.lessons);
      setViolations(res.violations);
      const errs = res.violations.filter((v) => v.severity === 'error' && v.lesson_ids.includes(lessonId));
      if (errs.length > 0) toast.error(`Mutat, dar apare un conflict: ${errs[0].message}`);
      else toast.success('Lecția a fost mutată.');
    } catch (e) {
      setLessons(before);
      toast.error(e instanceof ApiError ? e.detail : 'Nu am putut muta lecția.');
    } finally {
      setMoving(false);
    }
  };

  const togglePublish = async () => {
    if (!tt) return;
    setPublishing(true);
    try {
      const s = await api.publish(tt.id, !tt.published);
      setTt({ ...tt, published: s.published });
      toast.success(s.published ? 'Orarul este public. Copiază linkul și trimite-l studenților.' : 'Orarul nu mai este public.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Nu am putut schimba publicarea.');
    } finally {
      setPublishing(false);
    }
  };

  const copyLink = async () => {
    try {
      const { token } = await api.shareToken();
      const url = publicLink(token);
      await navigator.clipboard.writeText(url);
      toast.success('Linkul public a fost copiat.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Nu am putut copia linkul.');
    }
  };

  if (error && !tt) {
    return (
      <EmptyState
        icon="🗓"
        title="Nu am găsit orarul"
        description={error}
        actions={<Link to="/app/timetables" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Înapoi la orare</Link>}
      />
    );
  }
  if (!tt) return <PageLoader label="Încărcăm orarul…" />;

  const result = tt.result;
  const setup = tt.setup_snapshot;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/app/timetables" className="text-xs font-medium text-slate-500 hover:text-indigo-600 print:hidden">← Toate orarele</Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">{tt.name}</h1>
            {tt.published && <Badge className="bg-sky-100 text-sky-700">🔗 Publicat</Badge>}
            {moving && <Badge className="bg-indigo-50 text-indigo-600">se salvează…</Badge>}
          </div>
          <p className="mt-0.5 hidden text-sm text-slate-600 print:block">
            {setup.general.name} · {setup.general.academic_year} · semestrul {setup.general.semester}
          </p>
        </div>
        {tt.status === 'done' && (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <a href={api.exportUrl(tt.id)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              ⬇ Export Excel
            </a>
            <Button onClick={() => window.print()}>🖨 Tipărește</Button>
            <Button variant={tt.published ? 'secondary' : 'primary'} loading={publishing} onClick={() => void togglePublish()}>
              {tt.published ? 'Retrage' : 'Publică'}
            </Button>
            <Button variant="soft" disabled={!tt.published} title={tt.published ? undefined : 'Publică orarul întâi'} onClick={() => void copyLink()}>
              🔗 Copiază link public
            </Button>
          </div>
        )}
      </div>

      {running && <ProgressCard t={tt} limitS={null} startedAt={openedAt} />}
      {tt.status === 'failed' && (
        <EmptyState icon="😕" title="Generarea a eșuat" description={tt.progress.message || result?.message || 'Verifică datele la Configurare și încearcă din nou.'} actions={<Link to="/app/setup?step=8" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Verifică datele</Link>} />
      )}

      {tt.status === 'done' && result && (
        <div className="space-y-4">
          <ScoreChips result={result} />
          {(result.status === 'infeasible' || result.status === 'error') && result.message && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{result.message}</p>
          )}
          <ViolationsPanel violations={violations} unplaced={result.unplaced.length} />
          {lessons.length === 0 ? (
            <EmptyState icon="🗓" title="Orarul nu are lecții" description="Poate nu există repartizări. Verifică pasul 7 din Configurare." />
          ) : (
            <>
              <p className="text-xs text-slate-500 print:hidden">Sfat: trage o lecție într-o altă celulă ca s-o muți. Conflictele apar imediat.</p>
              <TimetableViewer setup={setup} lessons={lessons} violations={violations} editable onMove={(l, d, s) => void move(l, d, s)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
