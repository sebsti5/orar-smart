import { useMemo, useState } from 'react';
import { ApiError, api } from '../../api';
import type { Assignment } from '../../types';
import { Button } from '../../components/Button';
import { Card, CardBody, CardHeader } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Select, TextInput } from '../../components/Field';
import { LoadBar } from '../../components/LoadBar';
import { useToast } from '../../components/Toast';
import { fold } from '../../lib/capabilities';
import { coverageGaps } from '../../lib/coverage';
import { mergeAssignments, teacherLoads } from '../../lib/planning';
import { SubjectAssignments } from './SubjectAssignments';
import type { StepProps } from './stepTypes';

export function StepAssign({ setup, update, goTo, flush }: StepProps) {
  const toast = useToast();
  const [programId, setProgramId] = useState('');
  const [year, setYear] = useState(0);
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const loads = useMemo(() => teacherLoads(setup), [setup]);
  const setAssignments = (assignments: Assignment[]) => update((s) => ({ ...s, assignments }));

  const totalGaps = useMemo(() => setup.subjects.reduce((n, s) => n + coverageGaps(setup, s).length, 0), [setup]);

  if (setup.subjects.length === 0) {
    return (
      <EmptyState
        icon="🧩"
        title="Nu există discipline"
        description="Repartizarea leagă fiecare disciplină de un profesor. Completează întâi planul de învățământ."
        actions={<Button variant="primary" onClick={() => goTo(5)}>Mergi la Plan de învățământ</Button>}
      />
    );
  }

  const autoFill = async () => {
    setBusy(true);
    try {
      const saved = await flush();
      if (!saved) throw new ApiError(0, 'Salvează mai întâi modificările (vezi mesajul de salvare).');
      const res = await api.autoAssign();
      const { merged, added } = mergeAssignments(setup.assignments, res.assignments);
      setAssignments(merged);
      toast.success(added > 0 ? `Gata! Am completat ${added} repartizări. Le poți ajusta oricând.` : 'Totul era deja repartizat.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : 'Completarea automată a eșuat.');
    } finally {
      setBusy(false);
    }
  };

  const years = [...new Set(setup.subjects.map((s) => s.year))].sort((a, b) => a - b);
  const progAbbr = (id: string) => setup.programs.find((p) => p.id === id)?.abbreviation ?? '';
  const subjects = setup.subjects
    .filter((s) => !programId || s.program_id === programId)
    .filter((s) => !year || s.year === year)
    .filter((s) => !query || fold(s.name).includes(fold(query)))
    .filter((s) => !onlyMissing || coverageGaps(setup, s).length > 0)
    .sort((a, b) => progAbbr(a.program_id).localeCompare(progAbbr(b.program_id)) || a.year - b.year || a.name.localeCompare(b.name, 'ro'));

  const teacherRows = [...setup.teachers]
    .map((t) => ({ t, l: loads.get(t.id) ?? { load: 0, capacity: 0 } }))
    .sort((a, b) => b.l.load / Math.max(1, b.l.capacity) - a.l.load / Math.max(1, a.l.capacity));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-white">
          <CardBody className="flex flex-wrap items-center gap-4">
            <div className="text-2xl">🪄</div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">
                {totalGaps > 0 ? `${totalGaps} repartizări lipsesc` : 'Toate disciplinele au profesori'}
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                „Completează automat” alege pentru fiecare curs, seminar și laborator un profesor care îl poate preda, echilibrând încărcarea. Ce ai ales deja rămâne neatins.
              </p>
            </div>
            <Button variant="primary" loading={busy} onClick={() => void autoFill()}>
              Completează automat
            </Button>
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <TextInput className="w-56" placeholder="Caută disciplina…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select className="w-40" value={programId} onChange={(e) => setProgramId(e.target.value)} aria-label="Program">
            <option value="">Toate programele</option>
            {setup.programs.map((p) => (
              <option key={p.id} value={p.id}>{p.abbreviation}</option>
            ))}
          </Select>
          <Select className="w-32" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Anul">
            <option value={0}>Toți anii</option>
            {years.map((y) => (
              <option key={y} value={y}>Anul {y}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="accent-indigo-600" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
            Doar ce lipsește
          </label>
          <span className="ml-auto text-xs text-slate-400">{setup.assignments.length} repartizări</span>
        </div>

        {subjects.map((s) => (
          <SubjectAssignments key={s.id} setup={setup} subject={s} onChange={setAssignments} loads={loads} />
        ))}
        {subjects.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Nicio disciplină nu se potrivește filtrului.</p>}
      </div>

      <Card className="self-start xl:sticky xl:top-20">
        <CardHeader title="Încărcarea profesorilor" description="Perechi/săpt. repartizate vs. disponibile." />
        <CardBody className="max-h-[70vh] space-y-3 overflow-y-auto">
          {teacherRows.length === 0 && <p className="text-xs text-slate-500">Nu există profesori.</p>}
          {teacherRows.map(({ t, l }) => (
            <LoadBar key={t.id} label={t.name || '(fără nume)'} required={l.load} capacity={l.capacity} />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
