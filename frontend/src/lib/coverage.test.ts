import { describe, expect, it } from 'vitest';
import { fixtureSetup } from '../dev/fixtures';
import { coverageGaps, makeAssignment } from './coverage';

describe('coverageGaps', () => {
  it('lists missing seminars/labs per group', () => {
    const s = fixtureSetup();
    const am = s.subjects[0];
    expect(coverageGaps(s, am)).toEqual([
      { kind: 'seminar', groupIds: ['g2'] },
      { kind: 'seminar', groupIds: ['g3'] },
    ]);
  });

  it('proposes missing lectures per stream', () => {
    const s = { ...fixtureSetup(), assignments: [] };
    const gaps = coverageGaps(s, s.subjects[0]);
    expect(gaps[0]).toEqual({ kind: 'lecture', groupIds: ['g1', 'g2', 'g3'] });
    expect(gaps.filter((g) => g.kind === 'seminar')).toHaveLength(3);
  });

  it('falls back to per-group lectures without streams', () => {
    const s = { ...fixtureSetup(), assignments: [], streams: [] };
    expect(coverageGaps(s, s.subjects[0]).filter((g) => g.kind === 'lecture')).toHaveLength(3);
  });

  it('creates assignments with fresh ids', () => {
    const s = fixtureSetup();
    const a = makeAssignment(s, 'sub_am', 'seminar', ['g2'], 't1');
    expect(s.assignments.some((x) => x.id === a.id)).toBe(false);
    expect(a).toMatchObject({ subject_id: 'sub_am', kind: 'seminar', group_ids: ['g2'], per_week: null });
  });
});
