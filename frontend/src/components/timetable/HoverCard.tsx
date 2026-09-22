import { createPortal } from 'react-dom';
import type { PlacedLesson } from '../../types';
import type { Lookup } from '../../lib/lookup';
import { KIND_STYLE, cx } from '../../lib/colors';
import { KIND_LABEL, PARITY_LABEL } from '../../lib/labels';
import { DAY_NAMES } from '../../lib/time';
import type { InstitutionSetup, Violation } from '../../types';

export interface HoverState {
  lesson: PlacedLesson;
  rect: DOMRect;
}

export function HoverCard({ state, lookup, setup, violations }: { state: HoverState | null; lookup: Lookup; setup: InstitutionSetup; violations: Violation[] }) {
  if (!state) return null;
  const { lesson, rect } = state;
  const subject = lookup.subject.get(lesson.subject_id);
  const teacher = lookup.teacher.get(lesson.teacher_id);
  const room = lesson.room_id ? lookup.room.get(lesson.room_id) : undefined;
  const slot = setup.general.slots[lesson.slot];
  const mine = violations.filter((v) => v.lesson_ids.includes(lesson.id));
  const width = 280;
  const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left + rect.width / 2 - width / 2));
  const below = rect.bottom + 220 < window.innerHeight;
  const top = below ? rect.bottom + 8 : Math.max(12, rect.top - 8);

  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 animate-slide-in rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lift print:hidden"
      style={{ left, top, width, transform: below ? undefined : 'translateY(-100%)' }}
    >
      <div className="flex items-center gap-2">
        <span className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', KIND_STYLE[lesson.kind].chip)}>{KIND_LABEL[lesson.kind]}</span>
        {lesson.parity !== 'all' && <span className="text-xs text-slate-500">{PARITY_LABEL[lesson.parity]}</span>}
        {lesson.subgroup !== null && <span className="text-xs text-slate-500">subgrupa {lesson.subgroup}</span>}
      </div>
      <p className="mt-2 font-semibold text-slate-900">{subject?.name ?? '—'}</p>
      <dl className="mt-2 grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 text-xs">
        <dt className="text-slate-400">Profesor</dt>
        <dd className="text-slate-700">{teacher ? `${teacher.title ? `${teacher.title} ` : ''}${teacher.name}` : '—'}</dd>
        <dt className="text-slate-400">Grupe</dt>
        <dd className="text-slate-700">{lesson.group_ids.map((g) => lookup.group.get(g)?.name ?? '?').join(', ')}</dd>
        <dt className="text-slate-400">Sala</dt>
        <dd className="text-slate-700">{room ? `${room.name}${room.building ? ` (bloc ${room.building})` : ''} · ${room.capacity} locuri` : 'nealocată'}</dd>
        <dt className="text-slate-400">Când</dt>
        <dd className="text-slate-700">{DAY_NAMES[lesson.day]}, {slot ? `${slot.start}–${slot.end}` : `perechea ${lesson.slot + 1}`}</dd>
      </dl>
      {mine.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
          {mine.map((v, i) => (
            <li key={i}>⛔ {v.message}</li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}
