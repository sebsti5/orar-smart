import type { Issue } from '../types';

export interface StepDef {
  n: number;
  key: string;
  title: string;
  hint: string;
}

export const STEPS: StepDef[] = [
  { n: 1, key: 'general', title: 'General', hint: 'Orarul sunetelor și regulile zilei' },
  { n: 2, key: 'groups', title: 'Programe & Grupe', hint: 'Specialități și grupe de studenți' },
  { n: 3, key: 'rooms', title: 'Săli', hint: 'Aule, săli de seminar, laboratoare' },
  { n: 4, key: 'teachers', title: 'Profesori', hint: 'Ce predau și când sunt disponibili' },
  { n: 5, key: 'plan', title: 'Plan de învățământ', hint: 'Discipline și ore pe săptămână' },
  { n: 6, key: 'streams', title: 'Serii', hint: 'Grupe care ascultă cursurile împreună' },
  { n: 7, key: 'assign', title: 'Repartizare', hint: 'Cine predă ce și cui' },
  { n: 8, key: 'review', title: 'Verificare', hint: 'Totul e gata de generare?' },
];

const ENTITY_STEP: Record<string, number> = {
  general: 1,
  settings: 1,
  slot: 1,
  program: 2,
  group: 2,
  room: 3,
  room_kind: 3,
  teacher: 4,
  subject: 5,
  stream: 6,
  assignment: 7,
};

const CODE_HINTS: [RegExp, number][] = [
  [/assign|uncovered|coverage|without_teacher/i, 7],
  [/stream|serie/i, 6],
  [/parity|half|subject|hours/i, 5],
  [/teacher|capab|availability/i, 4],
  [/room|capacity|hall/i, 3],
  [/group|program/i, 2],
  [/slot|day|lessons_per_day|general/i, 1],
];

/** Which wizard step can fix this issue. */
export function issueStep(issue: Issue): number {
  if (issue.entity && ENTITY_STEP[issue.entity]) {
    // Assignment-coverage problems are reported per subject/group but fixed in step 7.
    if (/assign|uncovered|without_assignment|no_teacher/i.test(issue.code)) return 7;
    return ENTITY_STEP[issue.entity];
  }
  for (const [re, step] of CODE_HINTS) if (re.test(issue.code)) return step;
  return 8;
}

export function issuesByStep(issues: Issue[]): Record<number, Issue[]> {
  const out: Record<number, Issue[]> = {};
  for (const i of issues) {
    const s = issueStep(i);
    out[s] = [...(out[s] ?? []), i];
  }
  return out;
}
