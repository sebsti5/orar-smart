import type {
  Assignment,
  Group,
  InstitutionSetup,
  LessonKind,
  Subject,
  Teacher,
} from '../types';

export function hoursFor(subject: Subject, kind: LessonKind): number {
  if (kind === 'lecture') return subject.lecture_per_week;
  if (kind === 'seminar') return subject.seminar_per_week;
  return subject.lab_per_week;
}

export function assignmentHours(a: Assignment, subject: Subject | undefined): number {
  if (a.per_week !== null && a.per_week !== undefined) return a.per_week;
  return subject ? hoursFor(subject, a.kind) : 0;
}

/** Pairs/week a group sits in class (labs per subgroup count once per group). */
export function groupWeeklyPairs(group: Group, subjects: Subject[]): number {
  return subjects
    .filter((s) => s.program_id === group.program_id && s.year === group.year)
    .reduce((sum, s) => sum + s.lecture_per_week + s.seminar_per_week + s.lab_per_week, 0);
}

export function groupCapacity(setup: InstitutionSetup): number {
  return setup.general.days_per_week * setup.general.max_lessons_per_day;
}

/**
 * Pairs/week a teacher actually teaches. Labs split into subgroups count
 * once per subgroup; biweekly (0.5) counts as half.
 */
export function teacherLoad(teacherId: string, setup: InstitutionSetup): number {
  const subjects = new Map(setup.subjects.map((s) => [s.id, s]));
  const groups = new Map(setup.groups.map((g) => [g.id, g]));
  return setup.assignments
    .filter((a) => a.teacher_id === teacherId)
    .reduce((sum, a) => {
      const subj = subjects.get(a.subject_id);
      const h = assignmentHours(a, subj);
      if (a.kind === 'lab' && subj?.lab_split_subgroups) {
        const sub = a.group_ids.reduce((n, id) => n + (groups.get(id)?.subgroups ?? 1), 0);
        return sum + h * sub;
      }
      return sum + h;
    }, 0);
}

export function teacherAvailableSlots(t: Teacher, days: number, slots: number): number {
  if (t.availability.length === 0) return days * slots;
  let n = 0;
  for (let d = 0; d < days; d += 1) {
    for (let s = 0; s < slots; s += 1) if (t.availability[d]?.[s] ?? true) n += 1;
  }
  return n;
}

export function teacherCapacity(t: Teacher, setup: InstitutionSetup): number {
  const avail = teacherAvailableSlots(t, setup.general.days_per_week, setup.general.slots.length);
  return t.max_pairs_per_week !== null ? Math.min(avail, t.max_pairs_per_week) : avail;
}

export function isCapable(t: Teacher, subjectId: string, kind: LessonKind): boolean {
  return t.capabilities.some((c) => c.subject_id === subjectId && c.kinds.includes(kind));
}

/** Teachers who can teach subject×kind, capable ones first then the rest. */
export function rankTeachers(teachers: Teacher[], subjectId: string, kind: LessonKind): {
  capable: Teacher[];
  others: Teacher[];
} {
  const capable = teachers.filter((t) => isCapable(t, subjectId, kind));
  const others = teachers.filter((t) => !isCapable(t, subjectId, kind));
  return { capable, others };
}

/** Key identifying "what is taught to whom" — used to merge auto-assign output. */
function assignmentKey(a: Assignment): string {
  return `${a.subject_id}|${a.kind}|${[...a.group_ids].sort().join(',')}`;
}

/**
 * Merge server suggestions into the current list: existing assignments are
 * kept untouched, suggestions covering the same subject/kind/groups are
 * ignored, the rest are appended.
 */
export function mergeAssignments(current: Assignment[], suggested: Assignment[]): {
  merged: Assignment[];
  added: number;
} {
  const keys = new Set(current.map(assignmentKey));
  const ids = new Set(current.map((a) => a.id));
  const fresh = suggested.filter((a) => !keys.has(assignmentKey(a)) && !ids.has(a.id));
  return { merged: [...current, ...fresh], added: fresh.length };
}

/** Allowed step for weekly hours: 0.5 only when week parity is on. */
export function hoursStep(weekParity: boolean): number {
  return weekParity ? 0.5 : 1;
}

export function isValidHours(h: number, weekParity: boolean): boolean {
  if (!Number.isFinite(h) || h < 0 || h > 10) return false;
  return weekParity ? Number.isInteger(h * 2) : Number.isInteger(h);
}

/** Subject × kind combos with hours but no assignment covering a group. */
export function uncoveredCount(setup: InstitutionSetup): number {
  let missing = 0;
  for (const s of setup.subjects) {
    const groups = setup.groups.filter((g) => g.program_id === s.program_id && g.year === s.year);
    for (const kind of ['lecture', 'seminar', 'lab'] as LessonKind[]) {
      if (hoursFor(s, kind) <= 0) continue;
      for (const g of groups) {
        const covered = setup.assignments.some(
          (a) => a.subject_id === s.id && a.kind === kind && a.group_ids.includes(g.id),
        );
        if (!covered) missing += 1;
      }
    }
  }
  return missing;
}

export interface TeacherLoadInfo {
  load: number;
  capacity: number;
}

/** Load + capacity for every teacher, computed once per render. */
export function teacherLoads(setup: InstitutionSetup): Map<string, TeacherLoadInfo> {
  return new Map(setup.teachers.map((t) => [t.id, { load: teacherLoad(t.id, setup), capacity: teacherCapacity(t, setup) }]));
}
