import { describe, expect, it } from 'vitest';
import { buildBlock, buildGroupGrid, buildRuns, buildWeekGrid, orderGroups } from './grid';
import { fixtureSetup, lesson } from '../dev/fixtures';

const setup = fixtureSetup();
const tiGroups = setup.groups.filter((g) => g.program_id === 'p_ti'); // g1, g2, g3
const allGroups = orderGroups(setup.groups, setup.programs); // TI-251..253, SI-251

describe('buildRuns', () => {
  it('merges a stream lecture across adjacent group columns', () => {
    const lec = lesson({ id: 'a_lec#0', group_ids: ['g1', 'g2', 'g3'], day: 0, slot: 0 });
    const runs = buildRuns([[lec], [lec], [lec]]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ col: 0, span: 3 });
  });

  it('never merges empty cells or single-group lessons', () => {
    const sem = lesson({ id: 'a_sem1#0', kind: 'seminar', group_ids: ['g1'], day: 0, slot: 0 });
    const runs = buildRuns([[], [], [sem]]);
    expect(runs.map((r) => r.span)).toEqual([1, 1, 1]);
  });

  it('splits a stream lecture into runs when the columns are not adjacent', () => {
    const lec = lesson({ id: 'x#0', group_ids: ['g1', 'g3'], day: 0, slot: 0 });
    const runs = buildRuns([[lec], [], [lec]]);
    expect(runs.map((r) => [r.col, r.span])).toEqual([[0, 1], [1, 1], [2, 1]]);
  });
});

describe('buildBlock', () => {
  it('produces one weekly row with a merged 3-column lecture', () => {
    const lec = lesson({ id: 'a_lec#0', group_ids: ['g1', 'g2', 'g3'], day: 0, slot: 0 });
    const rows = buildBlock(0, 0, allGroups, [lec]);
    expect(rows).toHaveLength(1);
    expect(rows[0].subRow).toBe('all');
    expect(rows[0].cells.map((c) => [c.col, c.colSpan, c.lessons.length])).toEqual([
      [0, 3, 1],
      [3, 1, 0],
    ]);
  });

  it('splits into odd/even rows for biweekly lessons and merges weekly cells vertically', () => {
    const odd = lesson({ id: 'a_lec#1', group_ids: ['g1', 'g2', 'g3'], day: 1, slot: 2, parity: 'odd' });
    const even = lesson({ id: 'a_sem1#1', kind: 'seminar', group_ids: ['g1'], day: 1, slot: 2, parity: 'even' });
    const weeklySi = lesson({ id: 'si#0', kind: 'seminar', group_ids: ['g4'], day: 1, slot: 2 });
    const rows = buildBlock(1, 2, allGroups, [odd, even, weeklySi]);

    expect(rows.map((r) => r.subRow)).toEqual(['odd', 'even']);
    const [oddRow, evenRow] = rows;
    // odd: lecture merged across 3 TI columns + SI weekly seminar spanning both rows
    expect(oddRow.cells.map((c) => [c.col, c.colSpan, c.rowSpan])).toEqual([
      [0, 3, 1],
      [3, 1, 2],
    ]);
    // even: seminar for g1, empty g2 and g3 (SI cell covered by rowSpan)
    expect(evenRow.cells.map((c) => [c.col, c.colSpan, c.lessons.map((l) => l.id)])).toEqual([
      [0, 1, ['a_sem1#1']],
      [1, 1, []],
      [2, 1, []],
    ]);
  });

  it('puts subgroup labs side by side in the same group cell', () => {
    const sg1 = lesson({ id: 'a_lab1#0#s1', kind: 'lab', group_ids: ['g1'], subgroup: 1, day: 2, slot: 1 });
    const sg2 = lesson({ id: 'a_lab2#0#s2', kind: 'lab', group_ids: ['g1'], subgroup: 2, day: 2, slot: 1 });
    const rows = buildBlock(2, 1, tiGroups, [sg2, sg1]);
    expect(rows).toHaveLength(1);
    expect(rows[0].cells[0].lessons.map((l) => l.subgroup)).toEqual([1, 2]);
    expect(rows[0].cells[0].colSpan).toBe(1);
  });

  it('ignores lessons of groups that are filtered out', () => {
    const si = lesson({ id: 'si#0', group_ids: ['g4'], day: 0, slot: 0, parity: 'odd' });
    const rows = buildBlock(0, 0, tiGroups, [si]);
    expect(rows).toHaveLength(1);
    expect(rows[0].cells.every((c) => c.lessons.length === 0)).toBe(true);
  });
});

describe('buildGroupGrid', () => {
  it('lays out days × slots with per-day row counts', () => {
    const odd = lesson({ id: 'x#0', group_ids: ['g1'], day: 0, slot: 1, parity: 'odd' });
    const layout = buildGroupGrid(tiGroups, [odd], 5, 7);
    expect(layout.dayRowCounts).toEqual([8, 7, 7, 7, 7]);
    expect(layout.rows).toHaveLength(36);
    expect(layout.rows[0]).toMatchObject({ day: 0, slot: 0, dayStart: true, blockStart: true });
    expect(layout.rows[1]).toMatchObject({ slot: 1, subRow: 'odd', blockSize: 2 });
    expect(layout.rows[2]).toMatchObject({ slot: 1, subRow: 'even', blockStart: false });
    expect(layout.rows[8]).toMatchObject({ day: 1, dayStart: true });
  });
});

describe('buildWeekGrid', () => {
  it('buckets lessons by slot/day and parity', () => {
    const a = lesson({ id: 'a#0', group_ids: ['g1'], day: 1, slot: 0 });
    const b = lesson({ id: 'b#0', group_ids: ['g1'], day: 1, slot: 0, parity: 'even' });
    const grid = buildWeekGrid([a, b], 5, 7);
    expect(grid[0][1].all.map((l) => l.id)).toEqual(['a#0']);
    expect(grid[0][1].even.map((l) => l.id)).toEqual(['b#0']);
    expect(grid[0][0].all).toEqual([]);
  });
});

describe('orderGroups', () => {
  it('orders by program, year, name and filters', () => {
    expect(allGroups.map((g) => g.name)).toEqual(['TI-251', 'TI-252', 'TI-253', 'SI-251']);
    expect(orderGroups(setup.groups, setup.programs, { year: null, programId: 'p_si' }).map((g) => g.id)).toEqual(['g4']);
    expect(orderGroups(setup.groups, setup.programs, { year: 1, programId: null })).toEqual([]);
  });
});
