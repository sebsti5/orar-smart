import type { Group, InstitutionSetup, Program, Room, Subject, Teacher } from '../types';

export interface Lookup {
  group: Map<string, Group>;
  program: Map<string, Program>;
  room: Map<string, Room>;
  subject: Map<string, Subject>;
  teacher: Map<string, Teacher>;
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((x) => [x.id, x]));
}

export function buildLookup(setup: InstitutionSetup): Lookup {
  return {
    group: byId(setup.groups),
    program: byId(setup.programs),
    room: byId(setup.rooms),
    subject: byId(setup.subjects),
    teacher: byId(setup.teachers),
  };
}

export function subjectLabel(s: Subject | undefined, short = false): string {
  if (!s) return '—';
  return short && s.short ? s.short : s.name;
}
