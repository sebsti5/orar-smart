import { useMemo } from 'react';
import type { PlacedLesson } from '../../types';
import { buildWeekGrid } from '../../lib/grid';
import type { WeekCell } from '../../lib/grid';
import { DAY_NAMES } from '../../lib/time';
import { useTimetable } from './context';
import { DropCell } from './DropCell';
import { LessonCard } from './LessonCard';

function Stack({ lessons }: { lessons: PlacedLesson[] }) {
  return (
    <div className="flex h-full flex-col gap-1">
      {lessons.map((l) => (
        <LessonCard key={l.id} lesson={l} />
      ))}
    </div>
  );
}

function WeekCellContent({ cell }: { cell: WeekCell }) {
  const split = cell.odd.length > 0 || cell.even.length > 0;
  if (!split) return <Stack lessons={cell.all} />;
  return (
    <div className="flex h-full flex-col gap-1">
      {cell.all.length > 0 && <Stack lessons={cell.all} />}
      <div className="min-h-[44px] flex-1 border-b border-dashed border-slate-200 pb-1">
        <span className="text-[9px] uppercase tracking-wide text-slate-400">impară</span>
        <Stack lessons={cell.odd} />
      </div>
      <div className="min-h-[44px] flex-1">
        <span className="text-[9px] uppercase tracking-wide text-slate-400">pară</span>
        <Stack lessons={cell.even} />
      </div>
    </div>
  );
}

export function WeekGrid({ lessons }: { lessons: PlacedLesson[] }) {
  const { setup } = useTimetable();
  const days = setup.general.days_per_week;
  const slots = setup.general.slots;
  const grid = useMemo(() => buildWeekGrid(lessons, days, slots.length), [lessons, days, slots.length]);

  return (
    <div className="tt-scroll max-h-[calc(100vh-220px)] overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="tt-table w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 w-20 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-left font-medium text-slate-500">Ora</th>
            {Array.from({ length: days }, (_, d) => (
              <th key={d} className="sticky top-0 z-20 min-w-[160px] border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-sm font-semibold text-slate-800">
                {DAY_NAMES[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, s) => (
            <tr key={s}>
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-2 text-left align-middle font-normal">
                <div className="font-semibold tabular-nums text-slate-700">{slot.start}</div>
                <div className="tabular-nums text-slate-400">{slot.end}</div>
              </th>
              {Array.from({ length: days }, (_, d) => (
                <DropCell key={d} day={d} slot={s} className="h-[60px] border-b border-r border-slate-100 p-1 align-top">
                  <WeekCellContent cell={grid[s][d]} />
                </DropCell>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
