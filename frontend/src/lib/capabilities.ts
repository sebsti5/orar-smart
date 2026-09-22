import type { LessonKind, TeacherCapability } from '../types';

/** Add/remove one kind for a subject; drops the capability when no kind is left. */
export function toggleCapability(caps: TeacherCapability[], subjectId: string, kind: LessonKind, on: boolean): TeacherCapability[] {
  const existing = caps.find((c) => c.subject_id === subjectId);
  if (!existing) {
    return on ? [...caps, { subject_id: subjectId, kinds: [kind] }] : caps;
  }
  const kinds = on
    ? existing.kinds.includes(kind)
      ? existing.kinds
      : [...existing.kinds, kind]
    : existing.kinds.filter((k) => k !== kind);
  if (kinds.length === 0) return caps.filter((c) => c.subject_id !== subjectId);
  return caps.map((c) => (c.subject_id === subjectId ? { ...c, kinds } : c));
}

export function hasCapability(caps: TeacherCapability[], subjectId: string, kind: LessonKind): boolean {
  return caps.some((c) => c.subject_id === subjectId && c.kinds.includes(kind));
}

/** Normalize text for accent-insensitive search. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
