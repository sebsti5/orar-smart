import type { PlacedLesson } from '../../types';
import { KIND_STYLE, cx } from '../../lib/colors';
import { KIND_ABBR } from '../../lib/labels';
import { useTimetable } from './context';

export function LessonCard({ lesson, compact = false }: { lesson: PlacedLesson; compact?: boolean }) {
  const { lookup, mode, badIds, editable, setDragging, onHover, dragging } = useTimetable();
  const subject = lookup.subject.get(lesson.subject_id);
  const teacher = lookup.teacher.get(lesson.teacher_id);
  const room = lesson.room_id ? lookup.room.get(lesson.room_id) : undefined;
  const bad = badIds.has(lesson.id);
  const groups = lesson.group_ids.map((g) => lookup.group.get(g)?.name ?? '?').join(', ');
  const title = compact && subject?.short ? subject.short : (subject?.name ?? '—');

  return (
    <div
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', lesson.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(lesson.id);
        onHover(null);
      }}
      onDragEnd={() => setDragging(null)}
      onMouseEnter={(e) => onHover(lesson, e.currentTarget)}
      onMouseLeave={() => onHover(null)}
      data-lesson-id={lesson.id}
      className={cx(
        'relative flex h-full min-h-[44px] w-full flex-col justify-center rounded-lg border px-1.5 py-1 text-left text-[11px] leading-tight transition',
        KIND_STYLE[lesson.kind].cell,
        editable && 'cursor-grab active:cursor-grabbing hover:shadow-md',
        bad && 'ring-2 ring-rose-500 ring-offset-1',
        dragging === lesson.id && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-1">
        <span className="font-semibold opacity-60">{KIND_ABBR[lesson.kind]}</span>
        <span className="line-clamp-2 font-semibold">{title}</span>
        {lesson.pinned && <span title="Fixată manual" className="ml-auto">📌</span>}
      </div>
      <div className="mt-0.5 truncate text-[10px] opacity-75">
        {lesson.subgroup !== null && <span className="mr-1 rounded bg-white/70 px-1 font-semibold">sg.{lesson.subgroup}</span>}
        {mode !== 'teacher' && (teacher?.name ?? '?')}
        {mode === 'teacher' && groups}
      </div>
      <div className="truncate text-[10px] font-medium opacity-80">
        {mode === 'room' ? groups : room ? room.name : <span className="text-rose-600">fără sală</span>}
      </div>
    </div>
  );
}
