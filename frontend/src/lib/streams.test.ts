import { describe, expect, it } from 'vitest';
import { fixtureSetup } from '../dev/fixtures';
import { groupsWithoutStream, streamMixWarning, streamName, suggestStreams } from './streams';

describe('streams', () => {
  it('suggests one stream per program+year with ≥2 groups, skipping existing ones', () => {
    const s = fixtureSetup();
    expect(suggestStreams(s.groups, s.programs, s.streams)).toEqual([]);
    const fresh = suggestStreams(s.groups, s.programs, []);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].group_ids).toEqual(['g1', 'g2', 'g3']);
    expect(fresh[0].name).toBe('TI-25 (1–3)');
  });

  it('names streams from their groups', () => {
    const s = fixtureSetup();
    expect(streamName([s.groups[0]], s.programs)).toBe('TI-25');
    expect(streamName([], s.programs)).toBe('Serie nouă');
  });

  it('finds loose groups and mixed streams', () => {
    const s = fixtureSetup();
    expect(groupsWithoutStream(s.groups, s.streams).map((g) => g.id)).toEqual(['g4']);
    expect(streamMixWarning({ id: 'x', name: 'x', group_ids: ['g1', 'g4'] }, s.groups)).toMatch(/programe/);
    expect(streamMixWarning(s.streams[0], s.groups)).toBeNull();
  });
});
