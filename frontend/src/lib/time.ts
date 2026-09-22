import type { GeneralSettings, Slot } from '../types';

export const DAY_NAMES = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
export const DAY_SHORT = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];

const HHMM = /^(\d{1,2}):(\d{2})$/;

export function isValidTime(t: string): boolean {
  const m = HHMM.exec(t);
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

export function toMinutes(t: string): number {
  const m = HHMM.exec(t);
  if (!m) return Number.NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(total, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface BellParams {
  count: number;
  firstStart: string;
  lessonMinutes: number;
  breakMinutes: number;
  bigBreakAfter: number | null; // 1-based
  bigBreakMinutes: number;
}

/** Build a full bell schedule: 08:00 + 90 + 15 … with a big break after slot N. */
export function buildSlots(p: BellParams): Slot[] {
  const slots: Slot[] = [];
  let start = toMinutes(p.firstStart);
  if (Number.isNaN(start)) start = 8 * 60;
  for (let i = 0; i < p.count; i += 1) {
    const end = start + p.lessonMinutes;
    slots.push({ start: fromMinutes(start), end: fromMinutes(end) });
    const isBig = p.bigBreakAfter !== null && i + 1 === p.bigBreakAfter;
    start = end + (isBig ? p.bigBreakMinutes : p.breakMinutes);
  }
  return slots;
}

/** Lesson length (minutes) inferred from the first valid slot; 90 by default. */
export function lessonLength(slots: Slot[]): number {
  for (const s of slots) {
    const d = toMinutes(s.end) - toMinutes(s.start);
    if (d > 0) return d;
  }
  return 90;
}

/**
 * After editing slot `index`, recompute every later slot so the chain keeps
 * the configured lesson length and breaks. Earlier slots stay untouched.
 */
export function reflowFrom(slots: Slot[], index: number, g: GeneralSettings): Slot[] {
  const len = lessonLength(slots);
  const out = slots.map((s) => ({ ...s }));
  for (let i = index + 1; i < out.length; i += 1) {
    const prevEnd = toMinutes(out[i - 1].end);
    if (Number.isNaN(prevEnd)) break;
    const isBig = g.big_break_after_slot !== null && i === g.big_break_after_slot;
    const start = prevEnd + (isBig ? g.big_break_minutes : g.break_minutes);
    out[i] = { start: fromMinutes(start), end: fromMinutes(start + len) };
  }
  return out;
}

/** Suggested next slot after the last one. */
export function nextSlot(slots: Slot[], g: GeneralSettings): Slot {
  const len = lessonLength(slots);
  const last = slots[slots.length - 1];
  if (!last) return { start: '08:00', end: fromMinutes(8 * 60 + len) };
  const isBig = g.big_break_after_slot !== null && slots.length === g.big_break_after_slot;
  const start = toMinutes(last.end) + (isBig ? g.big_break_minutes : g.break_minutes);
  return { start: fromMinutes(start), end: fromMinutes(start + len) };
}

/** Slot problems in Romanian, keyed by slot index. */
export function slotProblems(slots: Slot[]): Record<number, string> {
  const out: Record<number, string> = {};
  slots.forEach((s, i) => {
    if (!isValidTime(s.start) || !isValidTime(s.end)) {
      out[i] = 'Folosește formatul HH:MM.';
      return;
    }
    if (toMinutes(s.end) <= toMinutes(s.start)) {
      out[i] = 'Sfârșitul trebuie să fie după început.';
      return;
    }
    const prev = slots[i - 1];
    if (prev && isValidTime(prev.end) && toMinutes(s.start) < toMinutes(prev.end)) {
      out[i] = 'Se suprapune cu perechea anterioară.';
    }
  });
  return out;
}
