import { describe, expect, it } from 'vitest';
import { buildSlots, fromMinutes, lessonLength, nextSlot, reflowFrom, slotProblems, toMinutes } from './time';
import { DEFAULT_SLOTS, defaultGeneral } from './setupDefaults';

describe('time helpers', () => {
  it('converts minutes', () => {
    expect(toMinutes('08:00')).toBe(480);
    expect(fromMinutes(585)).toBe('09:45');
    expect(toMinutes('nope')).toBeNaN();
  });

  it('builds the UTM bell schedule from 08:00, 90 min, 15 min breaks, big break after slot 3', () => {
    const slots = buildSlots({ count: 7, firstStart: '08:00', lessonMinutes: 90, breakMinutes: 15, bigBreakAfter: 3, bigBreakMinutes: 30 });
    expect(slots).toEqual(DEFAULT_SLOTS);
  });

  it('reflows later slots after an edit', () => {
    const g = defaultGeneral();
    const edited = g.slots.map((s, i) => (i === 0 ? { start: '08:30', end: '10:00' } : s));
    const out = reflowFrom(edited, 0, g);
    expect(out[0]).toEqual({ start: '08:30', end: '10:00' });
    expect(out[1]).toEqual({ start: '10:15', end: '11:45' });
    expect(out[3].start).toBe('14:00'); // big break after slot 3
  });

  it('suggests the next slot and infers lesson length', () => {
    const g = defaultGeneral();
    expect(lessonLength(g.slots)).toBe(90);
    expect(nextSlot(g.slots, g)).toEqual({ start: '20:30', end: '22:00' });
    expect(nextSlot(g.slots.slice(0, 3), g)).toEqual({ start: '13:30', end: '15:00' });
  });

  it('reports invalid and overlapping slots', () => {
    const p = slotProblems([
      { start: '08:00', end: '09:30' },
      { start: '09:00', end: '10:30' },
      { start: '11:00', end: '10:00' },
      { start: 'x', end: '12:00' },
    ]);
    expect(Object.keys(p)).toEqual(['1', '2', '3']);
  });
});
