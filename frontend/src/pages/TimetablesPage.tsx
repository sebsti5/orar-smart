import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api';
import type { CreateTimetableRequest, TimetableSummary } from '../types';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageLoader } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { GenerateModal } from '../components/timetable/GenerateModal';
import { ProgressCard } from '../components/timetable/ProgressCard';
import { useInterval } from '../hooks/useInterval';
import { cx } from '../lib/colors';
import { STATUS_LABEL } from '../lib/labels';

const POLL_MS = 1000;
const DEFAULT_LIMIT_S = 30;

const STATUS_STYLE: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-600',
  running: 'bg-indigo-100 text-indigo-700',
  done: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
};

function isActive(t: TimetableSummary): boolean {
  return t.status === 'queued' || t.status === 'running';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function TimetablesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const watchId = (location.state as { watch?: string } | null)?.watch ?? null;
  const [items, setItems] = useState<TimetableSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [toDelete, setToDelete] = useState<TimetableSummary | null>(null);
  // Generations started from the wizard use the backend default (30 s).
  const limits = useRef(new Map<string, number>(watchId ? [[watchId, DEFAULT_LIMIT_S]] : []));
  const firstSeen = useRef(new Map<string, number>());
  const inflight = useRef(new Set<string>());

  const startedAt = (t: TimetableSummary): number => {
    const known = firstSeen.current.get(t.id);
    if (known) return known;
    // created_at may lack a timezone; only trust it if it's plausible.
    const parsed = Date.parse(t.created_at);
    const start = Number.isFinite(parsed) && Math.abs(Date.now() - parsed) < 10 * 60_000 ? parsed : Date.now();
    firstSeen.current.set(t.id, start);
    return start;
  };

  const load = useCallback(async () => {
    try {
      setItems(await api.listTimetables());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'Nu am putut încărca orarele.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = (items ?? []).filter(isActive);
  useInterval(
    () => {
      active.forEach(async (t) => {
        if (inflight.current.has(t.id)) return;
        inflight.current.add(t.id);
        try {
          const fresh = await api.getTimetable(t.id);
          setItems((xs) => (xs ?? []).map((x) => (x.id === fresh.id ? { ...x, status: fresh.status, progress: fresh.progress, published: fresh.published } : x)));
          if (fresh.status === 'done') toast.success(`„${fresh.name}” este gata!`);
          if (fresh.status === 'failed') toast.error(`Generarea „${fresh.name}” a eșuat: ${fresh.progress.message || 'motiv necunoscut'}`);
        } catch {
          /* transient network error: retried on the next tick */
        } finally {
          inflight.current.delete(t.id);
        }
      });
    },
    active.length > 0 ? POLL_MS : null,
  );

  const create = async (req: CreateTimetableRequest) => {
    try {
      const t = await api.createTimetable(req);
      if (req.time_limit_s) limits.current.set(t.id, req.time_limit_s);
      setItems((xs) => [t, ...(xs ?? []).filter((x) => x.id !== t.id)]);
      toast.info('Generarea a pornit. Poți urmări progresul aici.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Nu am putut porni generarea.');
      throw e;
    }
  };

  const remove = async (t: TimetableSummary) => {
    try {
      await api.deleteTimetable(t.id);
      setItems((xs) => (xs ?? []).filter((x) => x.id !== t.id));
      toast.success('Orarul a fost șters.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Nu am putut șterge orarul.');
    } finally {
      setToDelete(null);
    }
  };

  if (error && !items) {
    return <EmptyState icon="🔌" title="Nu am putut încărca orarele" description={error} actions={<Button variant="primary" onClick={() => void load()}>Reîncearcă</Button>} />;
  }
  if (!items) return <PageLoader />;

  const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orare</h1>
          <p className="mt-1 text-sm text-slate-500">Fiecare generare păstrează o copie a datelor de atunci. Publici varianta care îți place.</p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setGenOpen(true)}>⚡ Generează orar</Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon="🗓"
          title="Niciun orar generat încă"
          description="Când datele sunt gata, apasă „Generează orar”. Durează de obicei sub un minut."
          actions={
            <>
              <Button variant="primary" onClick={() => setGenOpen(true)}>Generează primul orar</Button>
              <Button onClick={() => navigate('/app/setup?step=8')}>Verifică datele întâi</Button>
            </>
          }
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((t) => (
            <Card key={t.id} className={cx('p-4 transition', t.id === watchId && 'ring-2 ring-indigo-300')}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {t.status === 'done' ? (
                      <Link to={`/app/timetables/${t.id}`} className="truncate font-semibold text-slate-900 hover:text-indigo-700">{t.name}</Link>
                    ) : (
                      <span className="truncate font-semibold text-slate-900">{t.name}</span>
                    )}
                    <Badge className={STATUS_STYLE[t.status]}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
                    {t.published && <Badge className="bg-sky-100 text-sky-700">🔗 Publicat</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(t.created_at)}
                    {t.status === 'done' && t.progress.best_penalty != null && ` · penalizare ${t.progress.best_penalty}`}
                    {t.status === 'failed' && t.progress.message && ` · ${t.progress.message}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {t.status === 'done' && (
                    <Button variant="primary" size="sm" onClick={() => navigate(`/app/timetables/${t.id}`)}>Deschide →</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setToDelete(t)} aria-label="Șterge" disabled={isActive(t)}>🗑</Button>
                </div>
              </div>
              {isActive(t) && (
                <div className="mt-3">
                  <ProgressCard t={t} limitS={limits.current.get(t.id) ?? null} startedAt={startedAt(t)} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <GenerateModal open={genOpen} onClose={() => setGenOpen(false)} onSubmit={create} />
      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        size="sm"
        title="Ștergi orarul?"
        description={toDelete ? `„${toDelete.name}” va fi șters definitiv.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Anulează</Button>
            <Button variant="danger" onClick={() => toDelete && void remove(toDelete)}>Șterge</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{toDelete?.published ? 'Atenție: este publicat — linkul public nu va mai funcționa pentru el.' : 'Datele din Configurare rămân neatinse.'}</p>
      </Modal>
    </div>
  );
}
