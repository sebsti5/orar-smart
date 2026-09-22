import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../../api';
import type { CreateTimetableRequest, InstitutionSetup } from '../../types';
import { Button } from '../Button';
import { Field, TextInput } from '../Field';
import { Modal } from '../Modal';
import { Spinner } from '../Spinner';
import { orderGroups } from '../../lib/grid';
import { normalizeSetup } from '../../lib/setupDefaults';
import { cx } from '../../lib/colors';

export const TIME_LIMIT_MIN = 5;
export const TIME_LIMIT_MAX = 120;

export function GenerateModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (req: CreateTimetableRequest) => Promise<void>;
}) {
  const [setup, setSetup] = useState<InstitutionSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [limit, setLimit] = useState(30);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    api
      .getSetup()
      .then((raw) => {
        const s = normalizeSetup(raw);
        setSetup(s);
        setSelected(new Set(s.groups.map((g) => g.id)));
        setName(`Orar sem. ${s.general.semester} · ${new Date().toLocaleDateString('ro-RO')}`);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.detail : 'Nu am putut încărca grupele.'));
  }, [open]);

  const byYear = useMemo(() => {
    if (!setup) return [];
    const ordered = orderGroups(setup.groups, setup.programs);
    const years = [...new Set(ordered.map((g) => g.year))].sort((a, b) => a - b);
    return years.map((y) => ({
      year: y,
      programs: setup.programs
        .map((p) => ({ program: p, groups: ordered.filter((g) => g.year === y && g.program_id === p.id) }))
        .filter((x) => x.groups.length > 0),
    }));
  }, [setup]);

  const toggleMany = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setSelected(next);
  };

  const all = setup?.groups.length ?? 0;
  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim() || undefined,
        group_ids: selected.size === all ? [] : [...selected],
        time_limit_s: limit,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Generează un orar nou"
      description="Alege grupele și cât timp poate căuta algoritmul. Mai mult timp = orar mai compact."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Anulează</Button>
          <Button variant="primary" loading={busy} disabled={!setup || selected.size === 0} onClick={() => void submit()}>
            ⚡ Generează ({selected.size === all ? 'toate grupele' : `${selected.size} grupe`})
          </Button>
        </>
      }
    >
      {error && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {!setup && !error ? (
        <div className="flex justify-center py-10 text-indigo-500"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          <Field label="Nume">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Grupe</p>
              <div className="flex gap-2 text-xs">
                <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setSelected(new Set(setup?.groups.map((g) => g.id)))}>Toate</button>
                <button type="button" className="font-medium text-slate-500 hover:underline" onClick={() => setSelected(new Set())}>Niciuna</button>
              </div>
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
              {byYear.length === 0 && <p className="text-sm text-slate-500">Nu există grupe. Adaugă-le la Configurare.</p>}
              {byYear.map(({ year, programs }) => {
                const ids = programs.flatMap((p) => p.groups.map((g) => g.id));
                const allOn = ids.every((id) => selected.has(id));
                return (
                  <div key={year}>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <input type="checkbox" className="accent-indigo-600" checked={allOn} onChange={(e) => toggleMany(ids, e.target.checked)} />
                      Anul {year}
                    </label>
                    <div className="space-y-1.5 pl-6">
                      {programs.map(({ program, groups }) => (
                        <div key={program.id} className="flex flex-wrap items-center gap-1.5">
                          <button type="button" className="w-12 text-left text-xs font-semibold text-slate-500 hover:text-indigo-600" onClick={() => toggleMany(groups.map((g) => g.id), !groups.every((g) => selected.has(g.id)))}>
                            {program.abbreviation}
                          </button>
                          {groups.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              aria-pressed={selected.has(g.id)}
                              onClick={() => toggleMany([g.id], !selected.has(g.id))}
                              className={cx('rounded-lg border px-2 py-0.5 text-xs font-medium transition', selected.has(g.id) ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-400')}
                            >
                              {g.name}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <Field label={`Timp de căutare: ${limit} secunde`} hint="30 s ajung de obicei. Pentru facultăți mari, încearcă 60–120 s.">
            <input type="range" min={TIME_LIMIT_MIN} max={TIME_LIMIT_MAX} step={5} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full accent-indigo-600" aria-label="Timp de căutare" />
            <div className="flex justify-between text-[11px] text-slate-400"><span>{TIME_LIMIT_MIN} s · rapid</span><span>{TIME_LIMIT_MAX} s · cel mai bun</span></div>
          </Field>
        </div>
      )}
    </Modal>
  );
}
