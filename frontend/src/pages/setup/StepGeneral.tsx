import { useState } from 'react';
import type { GeneralSettings, Slot } from '../../types';
import { Button } from '../../components/Button';
import { Card, CardBody, CardHeader } from '../../components/Card';
import { Field, NumberStepper, Select, TextInput, Toggle } from '../../components/Field';
import { buildSlots, fromMinutes, lessonLength, nextSlot, reflowFrom, slotProblems, toMinutes } from '../../lib/time';
import { cx } from '../../lib/colors';
import type { StepProps } from './stepTypes';

export function StepGeneral({ setup, update }: StepProps) {
  const g = setup.general;
  const [autoReflow, setAutoReflow] = useState(true);
  const setGeneral = (patch: Partial<GeneralSettings>) => update((s) => ({ ...s, general: { ...s.general, ...patch } }));
  const len = lessonLength(g.slots);
  const problems = slotProblems(g.slots);

  const rebuild = (patch: Partial<GeneralSettings>, lessonMinutes = len) => {
    const next = { ...g, ...patch };
    const slots = buildSlots({
      count: next.slots.length,
      firstStart: next.slots[0]?.start ?? '08:00',
      lessonMinutes,
      breakMinutes: next.break_minutes,
      bigBreakAfter: next.big_break_after_slot,
      bigBreakMinutes: next.big_break_minutes,
    });
    setGeneral({ ...patch, slots });
  };

  const setSlot = (i: number, field: keyof Slot, value: string) => {
    const valid = /^\d{2}:\d{2}$/.test(value);
    const reflowStart = autoReflow && valid && field === 'start';
    const edited = g.slots.map((s, j) => {
      if (j !== i) return s;
      return reflowStart ? { start: value, end: fromMinutes(toMinutes(value) + len) } : { ...s, [field]: value };
    });
    setGeneral({ slots: autoReflow && valid ? reflowFrom(edited, i, g) : edited });
  };

  const setMinMax = (min: number, max: number) => setGeneral({ min_lessons_per_day: Math.min(min, max), max_lessons_per_day: Math.max(min, max) });

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Instituția și anul" description="Apar în antetul orarului și în exportul Excel." />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field label="Denumire (facultate / instituție)" className="sm:col-span-2" hint="Ex.: Facultatea Calculatoare, Informatică și Microelectronică">
            <TextInput value={g.name} onChange={(e) => setGeneral({ name: e.target.value })} placeholder="Facultatea…" />
          </Field>
          <Field label="Anul universitar" hint="Folosit și pentru a deduce anul de studiu din numele grupei (TI-251 → anul 2 în 2026/2027).">
            <TextInput value={g.academic_year} onChange={(e) => setGeneral({ academic_year: e.target.value })} placeholder="2026/2027" invalid={!/^\d{4}\/\d{4}$/.test(g.academic_year)} />
          </Field>
          <Field label="Semestrul" hint="Semestrul pentru care faci orarul.">
            <Select value={g.semester} onChange={(e) => setGeneral({ semester: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Semestrul {i + 1}</option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Regulile săptămânii" description="Limitele pe care orarul le respectă pentru fiecare grupă." />
        <CardBody className="grid gap-5 sm:grid-cols-3">
          <Field label="Zile pe săptămână" hint="5 = luni–vineri.">
            <NumberStepper value={g.days_per_week} min={1} max={7} onChange={(v) => setGeneral({ days_per_week: v })} ariaLabel="Zile pe săptămână" />
          </Field>
          <Field label="Minim perechi / zi" hint="Evităm zilele cu o singură pereche.">
            <NumberStepper value={g.min_lessons_per_day} min={0} max={12} onChange={(v) => setMinMax(v, Math.max(v, g.max_lessons_per_day))} ariaLabel="Minim perechi pe zi" />
          </Field>
          <Field label="Maxim perechi / zi" hint="Limită strictă pentru o grupă.">
            <NumberStepper value={g.max_lessons_per_day} min={1} max={12} onChange={(v) => setMinMax(Math.min(g.min_lessons_per_day, v), v)} ariaLabel="Maxim perechi pe zi" />
          </Field>
          <div className="sm:col-span-3 rounded-xl bg-slate-50 p-4">
            <Toggle
              checked={g.week_parity}
              onChange={(v) => setGeneral({ week_parity: v })}
              label="Săptămâni pare / impare"
              description="Pornește dacă unele discipline au o pereche la două săptămâni (0,5 pe săptămână). În orar, celula se împarte în două: sus săptămâna impară, jos săptămâna pară."
            />
          </div>
        </CardBody>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader
          title="Orarul sunetelor"
          description="Când începe și se termină fiecare pereche. Modifici un început — restul se recalculează singur."
          actions={
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" className="accent-indigo-600" checked={autoReflow} onChange={(e) => setAutoReflow(e.target.checked)} />
              Recalculează automat perechile următoare
            </label>
          }
        />
        <CardBody>
          <div className="mb-5 grid gap-4 sm:grid-cols-4">
            <Field label="Durata perechii (min)" hint="De obicei 90.">
              <TextInput type="number" min={20} max={240} value={len} onChange={(e) => rebuild({}, Math.max(20, Number(e.target.value) || 90))} />
            </Field>
            <Field label="Pauza (min)" hint="Între perechi.">
              <TextInput type="number" min={0} max={120} value={g.break_minutes} onChange={(e) => rebuild({ break_minutes: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
            <Field label="Pauza mare după perechea" hint="Pauza de prânz.">
              <Select value={g.big_break_after_slot ?? ''} onChange={(e) => rebuild({ big_break_after_slot: e.target.value === '' ? null : Number(e.target.value) })}>
                <option value="">Fără pauză mare</option>
                {g.slots.slice(0, -1).map((_, i) => (
                  <option key={i} value={i + 1}>a {i + 1}-a</option>
                ))}
              </Select>
            </Field>
            <Field label="Pauza mare (min)" hint="Ex.: 30.">
              <TextInput type="number" min={0} max={180} disabled={g.big_break_after_slot === null} value={g.big_break_minutes} onChange={(e) => rebuild({ big_break_minutes: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {g.slots.map((s, i) => (
              <div key={i}>
                <div className={cx('flex items-center gap-2 rounded-xl border bg-white px-3 py-2', problems[i] ? 'border-rose-300' : 'border-slate-200')}>
                  <span className="w-6 text-sm font-semibold text-indigo-600">{i + 1}</span>
                  <input aria-label={`Început perechea ${i + 1}`} type="time" value={s.start} onChange={(e) => setSlot(i, 'start', e.target.value)} className="w-[88px] rounded-md px-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                  <span className="text-slate-300">–</span>
                  <input aria-label={`Sfârșit perechea ${i + 1}`} type="time" value={s.end} onChange={(e) => setSlot(i, 'end', e.target.value)} className="w-[88px] rounded-md px-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                </div>
                {problems[i] && <p className="mt-1 text-xs text-rose-600">{problems[i]}</p>}
                {g.big_break_after_slot === i + 1 && i < g.slots.length - 1 && (
                  <p className="mt-1 text-center text-[11px] text-amber-600">☕ pauză mare {g.big_break_minutes} min</p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="soft" disabled={g.slots.length >= 16} onClick={() => setGeneral({ slots: [...g.slots, nextSlot(g.slots, g)] })}>
              ＋ Adaugă pereche
            </Button>
            <Button size="sm" variant="ghost" disabled={g.slots.length <= 1} onClick={() => setGeneral({ slots: g.slots.slice(0, -1) })}>
              − Elimină ultima
            </Button>
            <Button size="sm" variant="ghost" onClick={() => rebuild({}, len)}>
              ↻ Recalculează tot de la prima pereche
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
