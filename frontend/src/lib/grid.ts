/**
 * Layout builders for timetable grids.
 *
 * Group view (UTM style): one column per group, one row block per (day, slot).
 * A block is split into two sub-rows (odd / even week) when any visible lesson
 * in it is biweekly. Identical whole-group lessons in adjacent columns (stream
 * lectures) merge horizontally; cells identical in both sub-rows and weekly
 * merge vertically.
 */
import type { Group, Parity, PlacedLesson, Program } from '../types';

export type SubRow = 'all' | 'odd' | 'even';

export interface GridCell {
  /** first column (0-based) */
  col: number;
  colSpan: number;
  rowSpan: 1 | 2;
  lessons: PlacedLesson[];
}

export interface GridRow {
  day: number;
  slot: number;
  subRow: SubRow;
  /** true for the first sub-row of a (day, slot) block */
  blockStart: boolean;
  /** number of sub-rows in the block (1 or 2) */
  blockSize: 1 | 2;
  /** true for the first row of a day */
  dayStart: boolean;
  cells: GridCell[];
}

export interface GroupGridLayout {
  columns: Group[];
  rows: GridRow[];
  /** rows per day, used for the sticky day column rowSpan */
  dayRowCounts: number[];
}

interface Run {
  col: number;
  span: number;
  sig: string;
  lessons: PlacedLesson[];
}

function sortLessons(ls: PlacedLesson[]): PlacedLesson[] {
  return [...ls].sort(
    (a, b) =>
      (a.subgroup ?? 0) - (b.subgroup ?? 0) ||
      parityOrder(a.parity) - parityOrder(b.parity) ||
      a.id.localeCompare(b.id),
  );
}

function parityOrder(p: Parity): number {
  return p === 'odd' ? 0 : p === 'even' ? 1 : 2;
}

function matchesSubRow(l: PlacedLesson, r: SubRow): boolean {
  return r === 'all' || l.parity === 'all' || l.parity === r;
}

/** Collapse a row of per-column lesson lists into runs of merged cells. */
export function buildRuns(perColumn: PlacedLesson[][]): Run[] {
  const runs: Run[] = [];
  perColumn.forEach((lessons, col) => {
    const sorted = sortLessons(lessons);
    const sig = sorted.map((l) => l.id).join('|');
    const prev = runs[runs.length - 1];
    const mergeable = sig !== '' && sorted.every((l) => l.subgroup === null && l.group_ids.length > 1);
    if (prev && mergeable && prev.sig === sig && prev.col + prev.span === col) {
      prev.span += 1;
    } else {
      runs.push({ col, span: 1, sig, lessons: sorted });
    }
  });
  return runs;
}

function toCell(r: Run, rowSpan: 1 | 2): GridCell {
  return { col: r.col, colSpan: r.span, rowSpan, lessons: r.lessons };
}

/** Build the rows of one (day, slot) block. */
export function buildBlock(
  day: number,
  slot: number,
  columns: Group[],
  lessonsAt: PlacedLesson[],
): Omit<GridRow, 'dayStart'>[] {
  const visible = new Set(columns.map((g) => g.id));
  const relevant = lessonsAt.filter((l) => l.group_ids.some((g) => visible.has(g)));
  const split = relevant.some((l) => l.parity !== 'all');
  const perColumn = (r: SubRow) =>
    columns.map((g) => relevant.filter((l) => l.group_ids.includes(g.id) && matchesSubRow(l, r)));

  if (!split) {
    const cells = buildRuns(perColumn('all')).map((r) => toCell(r, 1));
    return [{ day, slot, subRow: 'all', blockStart: true, blockSize: 1, cells }];
  }

  const oddRuns = buildRuns(perColumn('odd'));
  const evenRuns = buildRuns(perColumn('even'));
  const oddCells: GridCell[] = [];
  const evenCells: GridCell[] = [];
  const mergedStarts = new Set<number>();

  for (const r of oddRuns) {
    const twin = evenRuns.find((e) => e.col === r.col && e.span === r.span && e.sig === r.sig);
    const weekly = r.lessons.every((l) => l.parity === 'all');
    if (twin && weekly) {
      oddCells.push(toCell(r, 2));
      mergedStarts.add(r.col);
    } else {
      oddCells.push(toCell(r, 1));
    }
  }
  for (const r of evenRuns) {
    if (!mergedStarts.has(r.col)) evenCells.push(toCell(r, 1));
  }
  return [
    { day, slot, subRow: 'odd', blockStart: true, blockSize: 2, cells: oddCells },
    { day, slot, subRow: 'even', blockStart: false, blockSize: 2, cells: evenCells },
  ];
}

export function buildGroupGrid(
  columns: Group[],
  lessons: PlacedLesson[],
  days: number,
  slots: number,
): GroupGridLayout {
  const index = new Map<string, PlacedLesson[]>();
  for (const l of lessons) {
    const k = `${l.day}:${l.slot}`;
    const list = index.get(k);
    if (list) list.push(l);
    else index.set(k, [l]);
  }
  const rows: GridRow[] = [];
  const dayRowCounts: number[] = [];
  for (let d = 0; d < days; d += 1) {
    let count = 0;
    for (let s = 0; s < slots; s += 1) {
      const block = buildBlock(d, s, columns, index.get(`${d}:${s}`) ?? []);
      block.forEach((row) => {
        rows.push({ ...row, dayStart: count === 0 });
        count += 1;
      });
    }
    dayRowCounts.push(count);
  }
  return { columns, rows, dayRowCounts };
}

// ------------------------------------------------------------ week grid

export interface WeekCell {
  all: PlacedLesson[];
  odd: PlacedLesson[];
  even: PlacedLesson[];
}

/** Classic week grid for one teacher / room: cells[slot][day]. */
export function buildWeekGrid(
  lessons: PlacedLesson[],
  days: number,
  slots: number,
): WeekCell[][] {
  const grid: WeekCell[][] = Array.from({ length: slots }, () =>
    Array.from({ length: days }, () => ({ all: [], odd: [], even: [] })),
  );
  for (const l of sortLessons(lessons)) {
    const cell = grid[l.slot]?.[l.day];
    if (cell) cell[l.parity].push(l);
  }
  return grid;
}

// ------------------------------------------------------------ filtering

export interface GroupFilter {
  year: number | null;
  programId: string | null;
}

/** Groups in display order: program order, then year, then name. */
export function orderGroups(groups: Group[], programs: Program[], filter?: GroupFilter): Group[] {
  const progIndex = new Map(programs.map((p, i) => [p.id, i]));
  return groups
    .filter((g) => !filter || filter.year === null || g.year === filter.year)
    .filter((g) => !filter || filter.programId === null || g.program_id === filter.programId)
    .sort(
      (a, b) =>
        (progIndex.get(a.program_id) ?? 999) - (progIndex.get(b.program_id) ?? 999) ||
        a.year - b.year ||
        a.name.localeCompare(b.name, 'ro', { numeric: true }),
    );
}

export function lessonsForTeacher(lessons: PlacedLesson[], teacherId: string): PlacedLesson[] {
  return lessons.filter((l) => l.teacher_id === teacherId);
}

export function lessonsForRoom(lessons: PlacedLesson[], roomId: string): PlacedLesson[] {
  return lessons.filter((l) => l.room_id === roomId);
}

export function lessonsForGroup(lessons: PlacedLesson[], groupId: string): PlacedLesson[] {
  return lessons.filter((l) => l.group_ids.includes(groupId));
}
