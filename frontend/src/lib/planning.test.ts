import { describe, expect, it } from 'vitest';
import { fixtureSetup } from '../dev/fixtures';
import {
  groupWeeklyPairs,
  isValidHours,
  mergeAssignments,
  rankTeachers,
  teacherCapacity,
  teacherLoad,
  uncoveredCount,
} from './planning';

const setup = fixtureSetup();

describe('loads', () => {
  it('counts a group’s weekly pairs from its curriculum', () => {
    expect(groupWeeklyPairs(setup.groups[0], setup.subjects)).toBe(3);
    expect(groupWeeklyPairs(setup.groups[3], setup.subjects)).toBe(0);
  });

  it('counts split labs once per subgroup', () => {
    expect(teacherLoad('t1', setup)).toBe(2); // lecture + seminar
    expect(teacherLoad('t2', setup)).toBe(2); // 1 lab × 2 subgroups
  });

  it('caps capacity by max pairs and availability', () => {
    expect(teacherCapacity(setup.teachers[0], setup)).toBe(10);
    expect(teacherCapacity(setup.teachers[1], setup)).toBe(35);
    const limited = { ...setup.teachers[1], availability: [[true, false, false, false, false, false, false]] };
    expect(teacherCapacity(limited, setup)).toBe(1 + 4 * 7);
  });
});

describe('hours', () => {
  it('accepts 0.5 only with week parity', () => {
    expect(isValidHours(0.5, true)).toBe(true);
    expect(isValidHours(0.5, false)).toBe(false);
    expect(isValidHours(0.25, true)).toBe(false);
    expect(isValidHours(2, false)).toBe(true);
    expect(isValidHours(11, true)).toBe(false);
  });
});

describe('mergeAssignments', () => {
  it('keeps existing assignments and appends only new coverage', () => {
    const suggested = [
      { id: 'n1', subject_id: 'sub_am', kind: 'lecture' as const, teacher_id: 't2', group_ids: ['g3', 'g2', 'g1'], per_week: null },
      { id: 'n2', subject_id: 'sub_am', kind: 'seminar' as const, teacher_id: 't1', group_ids: ['g2'], per_week: null },
    ];
    const { merged, added } = mergeAssignments(setup.assignments, suggested);
    expect(added).toBe(1);
    expect(merged.slice(0, 3)).toEqual(setup.assignments);
    expect(merged[3].id).toBe('n2');
  });
});

describe('coverage helpers', () => {
  it('ranks capable teachers first', () => {
    const r = rankTeachers(setup.teachers, 'sub_pc', 'lab');
    expect(r.capable.map((t) => t.id)).toEqual(['t2']);
    expect(r.others.map((t) => t.id)).toEqual(['t1']);
  });

  it('counts uncovered subject×kind×group combos', () => {
    // seminar AM for g2,g3 + lab PC for g2,g3
    expect(uncoveredCount(setup)).toBe(4);
  });
});
