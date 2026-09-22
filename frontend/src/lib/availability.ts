/** Availability matrix helpers. availability[day][slot]; [] = always available. */

export type Matrix = boolean[][];

export function expand(av: Matrix, days: number, slots: number): Matrix {
  return Array.from({ length: days }, (_, d) =>
    Array.from({ length: slots }, (_, s) => av[d]?.[s] ?? true),
  );
}

/** Store the canonical form: [] when everything is available. */
export function compact(m: Matrix): Matrix {
  return m.every((row) => row.every(Boolean)) ? [] : m;
}

export function paint(av: Matrix, days: number, slots: number, day: number, slot: number, value: boolean): Matrix {
  const full = expand(av, days, slots);
  if (full[day]?.[slot] === value) return av;
  const next = full.map((row, d) => (d === day ? row.map((v, s) => (s === slot ? value : v)) : row));
  return compact(next);
}

export function setDay(av: Matrix, days: number, slots: number, day: number, value: boolean): Matrix {
  const full = expand(av, days, slots);
  return compact(full.map((row, d) => (d === day ? row.map(() => value) : row)));
}

export function setSlot(av: Matrix, days: number, slots: number, slot: number, value: boolean): Matrix {
  const full = expand(av, days, slots);
  return compact(full.map((row) => row.map((v, s) => (s === slot ? value : v))));
}

export function countAvailable(av: Matrix, days: number, slots: number): number {
  return expand(av, days, slots).reduce((n, row) => n + row.filter(Boolean).length, 0);
}

export type Preset = 'all' | 'morning' | 'afternoon' | 'none';

export const PRESET_LABEL: Record<Preset, string> = {
  all: 'Tot timpul',
  morning: 'Doar dimineața',
  afternoon: 'Doar după-amiaza',
  none: 'Golește',
};

/** Morning = slots before the big break (default: first 3). */
export function preset(p: Preset, days: number, slots: number, morningSlots = 3): Matrix {
  if (p === 'all') return [];
  return Array.from({ length: days }, () =>
    Array.from({ length: slots }, (_, s) => {
      if (p === 'morning') return s < morningSlots;
      if (p === 'afternoon') return s >= morningSlots;
      return false;
    }),
  );
}
