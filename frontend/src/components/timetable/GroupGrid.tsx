import { useMemo } from 'react';
import type { Group, PlacedLesson } from '../../types';
import { buildGroupGrid } from '../../lib/grid';
import type { GridCell } from '../../lib/grid';
import { cx } from '../../lib/colors';
import { DAY_NAMES } from '../../lib/time';
import { useTimetable } from './context';
import { DropCell } from './DropCell';
import { LessonCard } from './LessonCard';

const DAY_W = 40;
const SLOT_W = 76;
const PAR_W = 22;

function CellContent({ cell }: { cell: GridCell }) {
  if (cell.lessons.length === 0) return null;
  const compact = cell.colSpan === 1 && cell.lessons.length > 1;
  return (
    <div className={cx('flex h-full gap-1', cell.lessons.length > 1 ? 'flex-row' : 'flex-col')}>
      {cell.lessons.map((l) => (
        <div key={l.id} className="min-w-0 flex-1">
          <LessonCard lesson={l} compact={compact} />
        </div>
      ))}
    </div>
  );
}

export function GroupGrid({ groups, lessons }: { groups: Group[]; lessons: PlacedLesson[] }) {
  const { setup } = useTimetable();
  const days = setup.general.days_per_week;
  const slots = setup.general.slots;
  const layout = useMemo(() => buildGroupGrid(groups, lessons, days, slots.length), [groups, lessons, days, slots.length]);

  return (
    <div className="tt-scroll max-h-[calc(100vh-220px)] overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="tt-table border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-slate-50" style={{ minWidth: DAY_W }} />
            <th className="sticky top-0 z-30 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-left font-medium text-slate-500" style={{ left: DAY_W, minWidth: SLOT_W }}>
              Ora
            </th>
            <th className="sticky top-0 z-30 border-b border-r border-slate-200 bg-slate-50" style={{ left: DAY_W + SLOT_W, minWidth: PAR_W }} />
            {groups.map((g) => (
              <th key={g.id} className="sticky top-0 z-20 min-w-[132px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-sm font-semibold text-slate-800">
                {g.name}
                <div className="text-[10px] font-normal text-slate-400">{g.students} stud.</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {layout.rows.map((row, ri) => {
            const slot = slots[row.slot];
            const dayBorder = row.dayStart ? 'border-t-2 border-t-slate-300' : '';
            return (
              <tr key={`${row.day}-${row.slot}-${row.subRow}`}>
                {row.dayStart && (
                  <th rowSpan={layout.dayRowCounts[row.day]} className={cx('sticky left-0 z-10 border-r border-slate-200 bg-white align-middle', dayBorder)} style={{ minWidth: DAY_W }}>
                    <span className="inline-block -rotate-180 text-sm font-semibold tracking-wide text-slate-700 [writing-mode:vertical-rl]">{DAY_NAMES[row.day]}</span>
                  </th>
                )}
                {row.blockStart && (
                  <th rowSpan={row.blockSize} className={cx('sticky z-10 border-b border-r border-slate-200 bg-white px-2 text-left align-middle font-normal', dayBorder)} style={{ left: DAY_W, minWidth: SLOT_W }}>
                    <div className="font-semibold tabular-nums text-slate-700">{slot?.start}</div>
                    <div className="tabular-nums text-slate-400">{slot?.end}</div>
                  </th>
                )}
                <th
                  className={cx('sticky z-10 border-r border-slate-200 bg-white text-[10px] font-medium text-slate-400', row.subRow !== 'even' && 'border-b-0', row.subRow !== 'odd' && 'border-b', dayBorder)}
                  style={{ left: DAY_W + SLOT_W, minWidth: PAR_W }}
                  title={row.subRow === 'odd' ? 'Săptămâna impară' : row.subRow === 'even' ? 'Săptămâna pară' : undefined}
                >
                  {row.subRow === 'odd' ? 'I' : row.subRow === 'even' ? 'P' : ''}
                </th>
                {row.cells.map((cell) => (
                  <DropCell
                    key={`${ri}-${cell.col}`}
                    day={row.day}
                    slot={row.slot}
                    colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                    rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                    className={cx('h-[52px] border-b border-r border-slate-100 p-1 align-top', dayBorder)}
                  >
                    <CellContent cell={cell} />
                  </DropCell>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
