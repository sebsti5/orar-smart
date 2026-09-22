import { useEffect, useRef, useState } from 'react';
import type { Slot } from '../types';
import { cx } from '../lib/colors';
import { DAY_SHORT } from '../lib/time';
import { PRESET_LABEL, countAvailable, expand, paint, preset, setDay } from '../lib/availability';
import type { Matrix, Preset } from '../lib/availability';

export function AvailabilityGrid({
  value,
  onChange,
  days,
  slots,
  morningSlots = 3,
}: {
  value: Matrix;
  onChange: (m: Matrix) => void;
  days: number;
  slots: Slot[];
  morningSlots?: number;
}) {
  const full = expand(value, days, slots.length);
  const [painting, setPainting] = useState<boolean | null>(null);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (painting === null) return undefined;
    const stop = () => setPainting(null);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchend', stop);
    };
  }, [painting]);

  const apply = (d: number, s: number, v: boolean) => {
    onChange(paint(latest.current, days, slots.length, d, s, v));
  };

  const total = days * slots.length;
  const available = countAvailable(value, days, slots.length);

  return (
    <div className="select-none">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(preset(p, days, slots.length, morningSlots))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
        <span className="ml-auto text-xs tabular-nums text-slate-500">
          {available} / {total} perechi disponibile
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th />
              {Array.from({ length: days }, (_, d) => (
                <th key={d} className="px-1 text-xs font-medium text-slate-500">
                  <button type="button" className="rounded px-1 hover:bg-slate-100" title="Comută toată ziua" onClick={() => onChange(setDay(value, days, slots.length, d, !full[d].every(Boolean)))}>
                    {DAY_SHORT[d]}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, s) => (
              <tr key={s}>
                <td className="pr-2 text-right text-[11px] tabular-nums text-slate-400">{slot.start}</td>
                {Array.from({ length: days }, (_, d) => {
                  const on = full[d][s];
                  return (
                    <td key={d}>
                      <button
                        type="button"
                        aria-label={`${DAY_SHORT[d]} ${slot.start}: ${on ? 'disponibil' : 'indisponibil'}`}
                        aria-pressed={on}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setPainting(!on);
                          apply(d, s, !on);
                        }}
                        onMouseEnter={() => {
                          if (painting !== null) apply(d, s, painting);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            apply(d, s, !on);
                          }
                        }}
                        className={cx(
                          'h-8 w-12 rounded-md border text-[10px] font-medium transition-colors',
                          on
                            ? 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'border-slate-200 bg-slate-50 text-slate-300 hover:bg-slate-100',
                        )}
                      >
                        {on ? '✓' : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">Click sau trage cu mouse-ul peste celule pentru a marca rapid orele. Click pe o zi comută toată ziua.</p>
    </div>
  );
}
