import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, api } from '../api';
import type { PublicTimetable } from '../types';
import { EmptyState } from '../components/EmptyState';
import { LogoMark } from '../components/Logo';
import { PageLoader } from '../components/Spinner';
import { TimetableViewer } from '../components/timetable/TimetableViewer';
import { normalizeSetup } from '../lib/setupDefaults';

export function PublicViewerPage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicTimetable | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .publicTimetable(token)
      .then((d) => {
        if (!alive) return;
        // The public payload may omit fields; prefer the timetable's own snapshot.
        const setup = normalizeSetup(d.timetable.setup_snapshot ?? d.setup);
        setData({ ...d, setup });
        document.title = `Orar · ${d.institution_name}`;
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? { status: e.status, message: e.detail } : { status: 0, message: 'Nu am putut încărca orarul.' });
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <EmptyState
          icon="🗓"
          title={error.status === 404 ? 'Orarul nu este publicat' : 'Nu am putut încărca orarul'}
          description={error.status === 404 ? 'Instituția nu a publicat încă un orar sau linkul nu mai este valid.' : error.message}
        />
      </div>
    );
  }
  if (!data) return <PageLoader label="Încărcăm orarul…" />;

  const g = data.setup.general;
  const lessons = data.timetable.result?.lessons ?? [];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white print:border-0">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <LogoMark className="h-7 w-7 print:hidden" />
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-slate-900">{data.institution_name}</h1>
            <p className="text-xs text-slate-500">
              {g.name ? `${g.name} · ` : ''}Anul universitar {g.academic_year} · semestrul {g.semester}
            </p>
          </div>
          <button type="button" onClick={() => window.print()} className="ml-auto rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 print:hidden">
            🖨 Tipărește
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {lessons.length === 0 ? (
          <EmptyState icon="🗓" title="Orarul este gol" />
        ) : (
          <TimetableViewer setup={data.setup} lessons={lessons} />
        )}
        <p className="mt-6 text-center text-xs text-slate-400 print:hidden">Generat cu Orar Smart</p>
      </main>
    </div>
  );
}
