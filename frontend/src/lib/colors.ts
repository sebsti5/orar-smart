import type { LessonKind, Severity } from '../types';

export interface KindStyle {
  cell: string; // background + border for a timetable cell
  chip: string; // small pill
  dot: string; // legend dot
  bar: string; // accent bar
}

export const KIND_STYLE: Record<LessonKind, KindStyle> = {
  lecture: {
    cell: 'bg-indigo-50 border-indigo-200 text-indigo-950',
    chip: 'bg-indigo-100 text-indigo-700',
    dot: 'bg-indigo-500',
    bar: 'bg-indigo-400',
  },
  seminar: {
    cell: 'bg-emerald-50 border-emerald-200 text-emerald-950',
    chip: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-400',
  },
  lab: {
    cell: 'bg-amber-50 border-amber-200 text-amber-950',
    chip: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
    bar: 'bg-amber-400',
  },
};

export const SEVERITY_STYLE: Record<Severity, { chip: string; box: string; icon: string }> = {
  error: { chip: 'bg-rose-100 text-rose-700', box: 'border-rose-200 bg-rose-50', icon: '⛔' },
  warning: { chip: 'bg-amber-100 text-amber-800', box: 'border-amber-200 bg-amber-50', icon: '⚠️' },
  info: { chip: 'bg-sky-100 text-sky-700', box: 'border-sky-200 bg-sky-50', icon: 'ℹ️' },
};

/** Load ratio → bar color (green → amber → red). */
export function loadColor(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio > 1) return 'bg-rose-500';
  if (ratio > 0.85) return 'bg-amber-500';
  return 'bg-emerald-500';
}

/** Tiny class-name joiner. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
