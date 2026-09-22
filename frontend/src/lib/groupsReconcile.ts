import type { Group, Program } from '../types';
import { detectGroup } from './groupName';
import { newId } from './ids';

/**
 * Apply name-based detection to a group whose name just changed:
 * fills program + year from "TI-241". An unknown abbreviation clears the
 * program so `reconcileGroups` can create it.
 */
export function applyGroupName(group: Group, name: string, programs: Program[], academicYear: string): Group {
  const det = detectGroup(name, programs, academicYear);
  if (!det) return { ...group, name };
  return {
    ...group,
    name,
    program_id: det.program ? det.program.id : '',
    year: det.year,
  };
}

/**
 * After a bulk edit/paste: groups whose name mentions an unknown program
 * abbreviation get a freshly created program ("TI" → program "TI").
 */
export function reconcileGroups(
  groups: Group[],
  programs: Program[],
  academicYear: string,
): { groups: Group[]; programs: Program[]; created: Program[] } {
  const created: Program[] = [];
  const all = (): Program[] => [...programs, ...created];
  const out = groups.map((g) => {
    if (g.program_id && all().some((p) => p.id === g.program_id)) return g;
    const det = detectGroup(g.name, all(), academicYear);
    if (!det) return g;
    let program = det.program;
    if (!program) {
      program = {
        id: newId('p', det.abbreviation, all().map((p) => p.id)),
        name: det.abbreviation,
        abbreviation: det.abbreviation,
      };
      created.push(program);
    }
    return { ...g, program_id: program.id, year: det.year };
  });
  return { groups: out, programs: all(), created };
}
