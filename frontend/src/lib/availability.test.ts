import { describe, expect, it } from 'vitest';
import { compact, countAvailable, expand, paint, preset, setDay } from './availability';

describe('availability', () => {
  it('treats [] as always available', () => {
    expect(countAvailable([], 5, 7)).toBe(35);
    expect(expand([], 2, 2)).toEqual([[true, true], [true, true]]);
  });

  it('paints a single cell and compacts back to [] when full', () => {
    const off = paint([], 5, 7, 1, 2, false);
    expect(off[1][2]).toBe(false);
    expect(countAvailable(off, 5, 7)).toBe(34);
    expect(paint(off, 5, 7, 1, 2, true)).toEqual([]);
  });

  it('returns the same reference when nothing changes', () => {
    const m = paint([], 5, 7, 0, 0, false);
    expect(paint(m, 5, 7, 0, 0, false)).toBe(m);
  });

  it('builds presets', () => {
    expect(preset('all', 5, 7)).toEqual([]);
    const morning = preset('morning', 5, 7, 3);
    expect(countAvailable(morning, 5, 7)).toBe(15);
    expect(morning[0]).toEqual([true, true, true, false, false, false, false]);
    expect(countAvailable(preset('none', 5, 7), 5, 7)).toBe(0);
  });

  it('toggles whole days', () => {
    const m = setDay([], 5, 7, 4, false);
    expect(countAvailable(m, 5, 7)).toBe(28);
    expect(compact(expand(setDay(m, 5, 7, 4, true), 5, 7))).toEqual([]);
  });
});
