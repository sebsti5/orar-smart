import { describe, expect, it } from 'vitest';
import { fixtureSetup } from '../dev/fixtures';
import { hasCapability, toggleCapability } from './capabilities';
import { applyGroupName, reconcileGroups } from './groupsReconcile';
import { newId, slug } from './ids';
import { buildingFromRoomName } from './rooms';
import { normalizeSetup } from './setupDefaults';
import { issueStep, issuesByStep } from './steps';
import { publicLink } from './share';

describe('capabilities', () => {
  it('adds, extends and removes kinds immutably', () => {
    const a = toggleCapability([], 's1', 'lecture', true);
    expect(a).toEqual([{ subject_id: 's1', kinds: ['lecture'] }]);
    const b = toggleCapability(a, 's1', 'lab', true);
    expect(b[0].kinds).toEqual(['lecture', 'lab']);
    expect(a[0].kinds).toEqual(['lecture']);
    expect(toggleCapability(toggleCapability(b, 's1', 'lab', false), 's1', 'lecture', false)).toEqual([]);
    expect(hasCapability(b, 's1', 'lab')).toBe(true);
  });
});

describe('group reconciliation', () => {
  it('fills program and year from the name', () => {
    const s = fixtureSetup();
    const g = applyGroupName({ ...s.groups[0], program_id: '', year: 1 }, 'SI-241', s.programs, '2026/2027');
    expect(g).toMatchObject({ name: 'SI-241', program_id: 'p_si', year: 3 });
  });

  it('creates missing programs from pasted names', () => {
    const s = fixtureSetup();
    const r = reconcileGroups([{ id: 'x', name: 'RM-261', program_id: '', year: 1, students: 20, subgroups: 1 }], s.programs, '2026/2027');
    expect(r.created).toHaveLength(1);
    expect(r.created[0].abbreviation).toBe('RM');
    expect(r.groups[0].program_id).toBe(r.created[0].id);
    expect(r.programs).toHaveLength(3);
  });

  it('reuses one created program for several groups', () => {
    const r = reconcileGroups(
      [
        { id: 'a', name: 'RM-261', program_id: '', year: 1, students: 20, subgroups: 1 },
        { id: 'b', name: 'RM-262', program_id: '', year: 1, students: 20, subgroups: 1 },
      ],
      [],
      '2026/2027',
    );
    expect(r.created).toHaveLength(1);
    expect(r.groups[0].program_id).toBe(r.groups[1].program_id);
  });
});

describe('ids', () => {
  it('slugifies and avoids collisions', () => {
    expect(slug('TI-251 Ș')).toBe('ti251s');
    expect(newId('g', 'TI-251')).toBe('g_ti251');
    const next = newId('g', 'TI-251', ['g_ti251']);
    expect(next).toMatch(/^g_ti251_[a-z0-9]{5}$/);
    expect(newId('t')).toMatch(/^t_[a-z0-9]{5}$/);
  });
});

describe('rooms / share / defaults', () => {
  it('derives the building from a room code', () => {
    expect(buildingFromRoomName('3-611')).toBe('3');
    expect(buildingFromRoomName('B-204')).toBe('B');
    expect(buildingFromRoomName('Aula Magna')).toBe('');
  });

  it('builds a public link', () => {
    expect(publicLink('abc 1', 'https://x.md')).toBe('https://x.md/p/abc%201');
  });

  it('normalizes partial setups from the server', () => {
    const s = normalizeSetup({ groups: [{ id: 'g', name: 'TI-251', program_id: 'p', year: 1, students: 20 } as never] });
    expect(s.groups[0].subgroups).toBe(1);
    expect(s.general.slots).toHaveLength(7);
    expect(s.pinned).toEqual([]);
  });
});

describe('issue → step mapping', () => {
  it('routes issues to the wizard step that fixes them', () => {
    const mk = (code: string, entity: string | null) => ({ severity: 'error' as const, code, message: '', entity, entity_id: null });
    expect(issueStep(mk('teacher_overloaded', 'teacher'))).toBe(4);
    expect(issueStep(mk('subject_without_assignment', 'subject'))).toBe(7);
    expect(issueStep(mk('half_hours_without_parity', 'subject'))).toBe(5);
    expect(issueStep(mk('room_capacity', 'room_kind'))).toBe(3);
    expect(issueStep(mk('stream_mixed', null))).toBe(6);
    expect(issueStep(mk('something_else', null))).toBe(8);
    expect(Object.keys(issuesByStep([mk('x', 'group'), mk('y', 'group')]))).toEqual(['2']);
  });
});
