import { useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from '../../lib/colors';
import { useTimetable } from './context';

/** A <td> that accepts dropped lessons (moves them to day/slot). */
export function DropCell({
  day,
  slot,
  colSpan,
  rowSpan,
  className,
  children,
}: {
  day: number;
  slot: number;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  children?: ReactNode;
}) {
  const { editable, dragging, onDropLesson } = useTimetable();
  const [over, setOver] = useState(false);
  return (
    <td
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={cx(className, over && 'bg-indigo-100/70 outline outline-2 -outline-offset-2 outline-indigo-400')}
      onDragOver={(e) => {
        if (!editable || !dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!editable) return;
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain') || dragging;
        if (id) onDropLesson(id, day, slot);
      }}
    >
      {children}
    </td>
  );
}
