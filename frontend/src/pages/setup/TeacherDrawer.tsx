import { useState } from 'react';
import type { InstitutionSetup, LessonKind, Subject, Teacher } from '../../types';
import { AvailabilityGrid } from '../../components/AvailabilityGrid';
import { Button } from '../../components/Button';
import { Field, Select, TextInput } from '../../components/Field';
import { LoadBar } from '../../components/LoadBar';
import { Drawer } from '../../components/Modal';
import { Tabs } from '../../components/Tabs';
import { fold, hasCapability, toggleCapability } from '../../lib/capabilities';
import { KIND_STYLE, cx } from '../../lib/colors';
import { KINDS, KIND_LABEL } from '../../lib/labels';
import { hoursFor, teacherCapacity, teacherLoad } from '../../lib/planning';

type Tab = 'caps' | 'avail';

export function TeacherDrawer({
  teacher,
  setup,
  onClose,
  onChange,
}: {
  teacher: Teacher | null;
  setup: InstitutionSetup;
  onClose: () => void;
  onChange: (t: Teacher) => void;
}) {
  const [tab, setTab] = useState<Tab>('caps');
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);

  if (!teacher) return null;
  const t = teacher;
  const progName = (id: string) => setup.programs.find((p) => p.id === id)?.abbreviation ?? '?';

  const subjects = setup.subjects
    .filter((s) => !program || s.program_id === program)
    .filter((s) => !query || fold(`${s.name} ${s.short} ${progName(s.program_id)}`).includes(fold(query)))
    .filter((s) => !onlyMine || t.capabilities.some((c) => c.subject_id === s.id))
    .sort((a, b) => progName(a.program_id).localeCompare(progName(b.program_id)) || a.year - b.year || a.name.localeCompare(b.name, 'ro'));

  const toggle = (s: Subject, k: LessonKind, on: boolean) => onChange({ ...t, capabilities: toggleCapability(t.capabilities, s.id, k, on) });

  return (
    <Drawer
      open
      onClose={onClose}
      title={t.name || 'Profesor nou'}
      description={t.title || 'Ce predă și când este disponibil'}
      footer={<Button variant="primary" onClick={onClose}>Gata</Button>}
    >
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nume">
          <TextInput value={t.name} onChange={(e) => onChange({ ...t, name: e.target.value })} />
        </Field>
        <Field label="Titlu">
          <TextInput value={t.title} onChange={(e) => onChange({ ...t, title: e.target.value })} placeholder="conf. univ., dr." />
        </Field>
        <div className="sm:col-span-2">
          <LoadBar label="Încărcare curentă (din repartizare)" required={teacherLoad(t.id, setup)} capacity={teacherCapacity(t, setup)} />
        </div>
      </div>

      <Tabs<Tab>
        items={[
          { key: 'caps', label: 'Discipline', count: t.capabilities.length },
          { key: 'avail', label: 'Disponibilitate' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'caps' ? (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <TextInput className="flex-1" placeholder="Caută disciplina…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Select className="w-40" value={program} onChange={(e) => setProgram(e.target.value)}>
              <option value="">Toate programele</option>
              {setup.programs.map((p) => (
                <option key={p.id} value={p.id}>{p.abbreviation}</option>
              ))}
            </Select>
          </div>
          <label className="mb-3 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" className="accent-indigo-600" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Doar disciplinele bifate
          </label>
          {setup.subjects.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nu există încă discipline. Le adaugi la pasul 5 „Plan de învățământ”.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {subjects.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400">{progName(s.program_id)} · anul {s.year}</p>
                  </div>
                  <div className="flex gap-1">
                    {KINDS.map((k) => {
                      const has = hoursFor(s, k) > 0;
                      const on = hasCapability(t.capabilities, s.id, k);
                      return (
                        <button
                          key={k}
                          type="button"
                          disabled={!has && !on}
                          aria-pressed={on}
                          onClick={() => toggle(s, k, !on)}
                          title={has ? KIND_LABEL[k] : `${KIND_LABEL[k]}: disciplina nu are ore de acest tip`}
                          className={cx(
                            'rounded-lg border px-2 py-1 text-xs font-medium transition',
                            on ? cx(KIND_STYLE[k].chip, 'border-transparent') : 'border-slate-200 text-slate-500 hover:border-slate-300',
                            !has && !on && 'cursor-not-allowed opacity-30',
                          )}
                        >
                          {on ? '✓ ' : ''}
                          {KIND_LABEL[k]}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
              {subjects.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">Nicio disciplină nu se potrivește filtrului.</li>}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <AvailabilityGrid
            value={t.availability}
            onChange={(availability) => onChange({ ...t, availability })}
            days={setup.general.days_per_week}
            slots={setup.general.slots}
            morningSlots={setup.general.big_break_after_slot ?? 3}
          />
        </div>
      )}
    </Drawer>
  );
}
