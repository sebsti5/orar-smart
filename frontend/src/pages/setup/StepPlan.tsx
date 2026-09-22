import { useMemo, useState } from 'react';
import type { InstitutionSetup, Subject } from '../../types';
import { Button } from '../../components/Button';
import { Card, CardBody, CardHeader } from '../../components/Card';
import { DataGrid } from '../../components/DataGrid';
import type { GridColumn } from '../../components/DataGrid';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/Field';
import { LoadBar, formatPairs } from '../../components/LoadBar';
import { useToast } from '../../components/Toast';
import { cx } from '../../lib/colors';
import { suggestAbbreviation } from '../../lib/groupName';
import { newId } from '../../lib/ids';
import { parseNumber } from '../../lib/paste';
import { groupCapacity, isValidHours } from '../../lib/planning';
import type { StepProps } from './stepTypes';

type HourField = 'lecture_per_week' | 'seminar_per_week' | 'lab_per_week';

function hourColumn(field: HourField, header: string, parity: boolean): GridColumn<Subject> {
  return {
    key: field,
    header,
    hint: parity ? 'Perechi pe săptămână. 0,5 = o dată la două săptămâni.' : 'Perechi pe săptămână (numere întregi).',
    type: 'number',
    width: '90px',
    get: (s) => s[field],
    set: (s, v) => {
      const n = parseNumber(String(v));
      return { ...s, [field]: Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : 0 };
    },
    validate: (s) => (isValidHours(s[field], parity) ? null : parity ? 'Folosește pași de 0,5.' : '0,5 cere săptămâni pare/impare (pasul 1).'),
  };
}

function subjectColumns(parity: boolean, tags: string[]): GridColumn<Subject>[] {
  return [
    {
      key: 'name',
      header: 'Disciplina',
      placeholder: 'Analiza matematică',
      type: 'text',
      width: '32%',
      get: (s) => s.name,
      set: (s, v) => {
        const name = String(v);
        const autoShort = !s.short || s.short === suggestAbbreviation(s.name);
        return { ...s, name, short: autoShort ? suggestAbbreviation(name) : s.short };
      },
      validate: (s) => (s.name.trim() ? null : 'Numele lipsește.'),
    },
    { key: 'short', header: 'Scurt', hint: 'Afișat în celulele mici ale orarului.', type: 'text', width: '80px', get: (s) => s.short, set: (s, v) => ({ ...s, short: String(v) }) },
    hourColumn('lecture_per_week', 'Curs', parity),
    hourColumn('seminar_per_week', 'Seminar', parity),
    hourColumn('lab_per_week', 'Laborator', parity),
    {
      key: 'tag',
      header: 'Sală lab. cu eticheta',
      hint: 'Laboratorul are nevoie de o sală cu această etichetă (ex.: computers).',
      type: 'select',
      placeholder: 'oricare',
      options: tags.map((t) => ({ value: t, label: `#${t}` })),
      get: (s) => s.lab_room_tag ?? '',
      set: (s, v) => ({ ...s, lab_room_tag: String(v) || null }),
    },
    {
      key: 'split',
      header: 'Pe subgrupe',
      hint: 'Laboratorul se ține separat pentru fiecare subgrupă.',
      type: 'checkbox',
      width: '100px',
      get: (s) => s.lab_split_subgroups,
      set: (s, v) => ({ ...s, lab_split_subgroups: Boolean(v) }),
    },
  ];
}

function combos(setup: InstitutionSetup): Map<string, number[]> {
  const out = new Map<string, Set<number>>();
  const add = (p: string, y: number) => out.set(p, new Set([...(out.get(p) ?? []), y]));
  setup.groups.forEach((g) => add(g.program_id, g.year));
  setup.subjects.forEach((s) => add(s.program_id, s.year));
  return new Map([...out].map(([p, ys]) => [p, [...ys].sort((a, b) => a - b)]));
}

export function StepPlan({ setup, update, goTo }: StepProps) {
  const toast = useToast();
  const byProgram = useMemo(() => combos(setup), [setup]);
  const [programRaw, setProgramId] = useState(setup.programs[0]?.id ?? '');
  const programId = setup.programs.some((p) => p.id === programRaw) ? programRaw : (setup.programs[0]?.id ?? '');
  const years = byProgram.get(programId) ?? [1];
  const allYears = [...new Set([...years, 1, 2, 3, 4])].sort((a, b) => a - b);
  const [yearRaw, setYear] = useState(years[0] ?? 1);
  const year = allYears.includes(yearRaw) ? yearRaw : (years[0] ?? 1);
  const parity = setup.general.week_parity;

  if (setup.programs.length === 0) {
    return (
      <EmptyState
        icon="📚"
        title="Mai întâi adaugă programele"
        description="Planul de învățământ se completează pe program și an de studiu."
        actions={<Button variant="primary" onClick={() => goTo(2)}>Mergi la Programe & Grupe</Button>}
      />
    );
  }

  const tags = [...new Set(['computers', ...setup.rooms.flatMap((r) => r.tags)])];
  const current = setup.subjects.filter((s) => s.program_id === programId && s.year === year);
  const groups = setup.groups.filter((g) => g.program_id === programId && g.year === year);
  const total = current.reduce((n, s) => n + s.lecture_per_week + s.seminar_per_week + s.lab_per_week, 0);
  const cap = groupCapacity(setup);

  const setCurrent = (rows: Subject[]) =>
    update((s) => ({
      ...s,
      subjects: [...s.subjects.filter((x) => !(x.program_id === programId && x.year === year)), ...rows.map((r) => ({ ...r, program_id: programId, year }))],
    }));

  const makeSubject = (_: number, rows: Subject[]): Subject => ({
    id: newId('sub', '', [...setup.subjects.map((s) => s.id), ...rows.map((s) => s.id)]),
    program_id: programId,
    year,
    name: '',
    short: '',
    lecture_per_week: 1,
    seminar_per_week: 1,
    lab_per_week: 0,
    lab_room_tag: null,
    lab_split_subgroups: true,
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card>
        <CardHeader
          title="Discipline pe semestru"
          description="Pentru fiecare disciplină: câte perechi pe săptămână de curs, seminar și laborator."
          actions={
            <Select className="w-56" value={programId} onChange={(e) => setProgramId(e.target.value)} aria-label="Program">
              {setup.programs.map((p) => (
                <option key={p.id} value={p.id}>{p.abbreviation} · {p.name}</option>
              ))}
            </Select>
          }
        />
        <CardBody>
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Anul de studiu">
            {allYears.map((y) => {
              const n = setup.subjects.filter((s) => s.program_id === programId && s.year === y).length;
              return (
                <button
                  key={y}
                  type="button"
                  role="tab"
                  aria-selected={y === year}
                  onClick={() => setYear(y)}
                  className={cx('rounded-lg px-3 py-1.5 text-sm font-medium transition', y === year ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                >
                  Anul {y}
                  {n > 0 && <span className={cx('ml-1.5 text-xs', y === year ? 'text-indigo-200' : 'text-slate-400')}>{n}</span>}
                </button>
              );
            })}
          </div>
          {!parity && (
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              💡 Ai discipline cu o pereche la două săptămâni? Pornește „Săptămâni pare / impare” la{' '}
              <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => goTo(1)}>pasul 1</button> și vei putea scrie 0,5.
            </p>
          )}
          <DataGrid
            rows={current}
            columns={subjectColumns(parity, tags)}
            onChange={setCurrent}
            rowKey={(s) => s.id}
            addLabel="Adaugă disciplină"
            makeRow={makeSubject}
            pasteHint="Coloane: Disciplina · Scurt · Curs · Seminar · Laborator · Etichetă sală · Pe subgrupe (da/nu)"
            onPasted={(a) => a && toast.success(`Am adăugat ${a} discipline.`)}
            empty={
              <EmptyState
                icon="📚"
                title={`Nicio disciplină pentru anul ${year}`}
                description="Lipește planul din Excel (disciplina, curs, seminar, laborator) sau adaugă disciplinele pe rând."
                actions={<Button variant="primary" onClick={() => setCurrent([makeSubject(0, [])])}>Adaugă prima disciplină</Button>}
              />
            }
          />
        </CardBody>
      </Card>

      <Card className="self-start">
        <CardHeader title="Încărcarea săptămânală" description={`Perechi/săpt. pentru fiecare grupă din anul ${year}.`} />
        <CardBody className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-3xl font-semibold tabular-nums text-slate-900">{formatPairs(total)}</p>
            <p className="text-xs text-slate-500">perechi / săptămână din maxim {cap}</p>
            <p className="mt-1 text-[11px] text-slate-400">= {setup.general.days_per_week} zile × {setup.general.max_lessons_per_day} perechi/zi</p>
          </div>
          {groups.length === 0 ? (
            <p className="text-xs text-slate-500">Nu există grupe pentru acest an.</p>
          ) : (
            groups.map((g) => <LoadBar key={g.id} label={g.name} required={total} capacity={cap} />)
          )}
          {total > cap && <p className="text-xs text-rose-600">Prea multe perechi: mărește maximul pe zi sau redu orele.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
