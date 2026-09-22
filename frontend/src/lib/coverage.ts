import type { Assignment, InstitutionSetup, LessonKind, Subject } from '../types';
import { hoursFor } from './planning';
import { newId } from './ids';

export interface CoverageGap {
  kind: LessonKind;
  /** Groups the missing assignment should cover (a stream for lectures). */
  groupIds: string[];
}

const KIND_ORDER: LessonKind[] = ['lecture', 'seminar', 'lab'];

/** Groups the subject applies to (same program + year). */
export function subjectGroups(setup: InstitutionSetup, subject: Subject): string[] {
  return setup.groups.filter((g) => g.program_id === subject.program_id && g.year === subject.year).map((g) => g.id);
}

/**
 * What's still missing for a subject: for every kind with hours, the groups
 * that no assignment covers yet. Lectures are proposed per stream when the
 * group belongs to one, otherwise per group; seminars/labs per group.
 */
export function coverageGaps(setup: InstitutionSetup, subject: Subject): CoverageGap[] {
  const groups = subjectGroups(setup, subject);
  const gaps: CoverageGap[] = [];
  for (const kind of KIND_ORDER) {
    if (hoursFor(subject, kind) <= 0) continue;
    const covered = new Set(
      setup.assignments.filter((a) => a.subject_id === subject.id && a.kind === kind).flatMap((a) => a.group_ids),
    );
    const missing = groups.filter((g) => !covered.has(g));
    if (kind !== 'lecture') {
      missing.forEach((g) => gaps.push({ kind, groupIds: [g] }));
      continue;
    }
    const seen = new Set<string>();
    for (const g of missing) {
      if (seen.has(g)) continue;
      const stream = setup.streams.find((s) => s.group_ids.includes(g));
      const unit = stream ? stream.group_ids.filter((x) => missing.includes(x)) : [g];
      unit.forEach((x) => seen.add(x));
      gaps.push({ kind, groupIds: unit });
    }
  }
  return gaps;
}

export function makeAssignment(setup: InstitutionSetup, subjectId: string, kind: LessonKind, groupIds: string[], teacherId: string): Assignment {
  return {
    id: newId('a', '', setup.assignments.map((a) => a.id)),
    subject_id: subjectId,
    kind,
    teacher_id: teacherId,
    group_ids: groupIds,
    per_week: null,
  };
}
