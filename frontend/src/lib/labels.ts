import type { LessonKind, Parity, RoomKind, Severity } from '../types';

export const KIND_LABEL: Record<LessonKind, string> = {
  lecture: 'Curs',
  seminar: 'Seminar',
  lab: 'Laborator',
};

/** UTM-style abbreviations used inside timetable cells. */
export const KIND_ABBR: Record<LessonKind, string> = {
  lecture: 'c.',
  seminar: 's.',
  lab: 'l.',
};

export const KINDS: LessonKind[] = ['lecture', 'seminar', 'lab'];

export const ROOM_KIND_LABEL: Record<RoomKind, string> = {
  lecture: 'Aulă (curs)',
  seminar: 'Sală seminar',
  lab: 'Laborator',
  sport: 'Sală de sport',
  any: 'Universală',
};

export const ROOM_KIND_ICON: Record<RoomKind, string> = {
  lecture: '🎓',
  seminar: '💬',
  lab: '🧪',
  sport: '🏀',
  any: '🏫',
};

export const ROOM_KINDS: RoomKind[] = ['lecture', 'seminar', 'lab', 'sport', 'any'];

export const PARITY_LABEL: Record<Parity, string> = {
  all: 'săptămânal',
  odd: 'săpt. impară',
  even: 'săpt. pară',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'Erori',
  warning: 'Avertismente',
  info: 'Informații',
};

export const STATUS_LABEL: Record<string, string> = {
  queued: 'În așteptare',
  running: 'Se generează',
  done: 'Gata',
  failed: 'Eșuat',
};

export const SOLVE_STATUS_LABEL: Record<string, string> = {
  optimal: 'Optim',
  feasible: 'Valid',
  infeasible: 'Imposibil',
  error: 'Eroare',
};
