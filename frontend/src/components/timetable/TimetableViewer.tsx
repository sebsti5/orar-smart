import { useMemo, useState } from 'react';
import type { InstitutionSetup, PlacedLesson, Violation } from '../../types';
import { EmptyState } from '../EmptyState';
import { Select } from '../Field';
import { Tabs } from '../Tabs';
import { orderGroups, lessonsForRoom, lessonsForTeacher } from '../../lib/grid';
import { buildLookup } from '../../lib/lookup';
import { ROOM_KIND_ICON } from '../../lib/labels';
import { TimetableContext } from './context';
import type { TimetableCtx, ViewMode } from './context';
import { GroupGrid } from './GroupGrid';
import { HoverCard } from './HoverCard';
import type { HoverState } from './HoverCard';
import { Legend } from './Legend';
import { WeekGrid } from './WeekGrid';

export interface TimetableViewerProps {
  setup: InstitutionSetup;
  lessons: PlacedLesson[];
  violations?: Violation[];
  editable?: boolean;
  onMove?: (lessonId: string, day: number, slot: number) => void;
}

export function TimetableViewer({ setup, lessons, violations = [], editable = false, onMove }: TimetableViewerProps) {
  const lookup = useMemo(() => buildLookup(setup), [setup]);
  const [mode, setMode] = useState<ViewMode>('group');
  const [year, setYear] = useState<number | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string>('');
  const [teacherId, setTeacherId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [hover, setHover] = useState<HoverState | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const badIds = useMemo(() => new Set(violations.filter((v) => v.severity === 'error').flatMap((v) => v.lesson_ids)), [violations]);
  const years = useMemo(() => [...new Set(setup.groups.map((g) => g.year))].sort((a, b) => a - b), [setup.groups]);

  const scheduledTeachers = useMemo(() => {
    const ids = new Set(lessons.map((l) => l.teacher_id));
    return setup.teachers.filter((t) => ids.has(t.id)).sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }, [lessons, setup.teachers]);
  const usedRooms = useMemo(() => {
    const ids = new Set(lessons.map((l) => l.room_id));
    return setup.rooms.filter((r) => ids.has(r.id)).sort((a, b) => a.name.localeCompare(b.name, 'ro', { numeric: true }));
  }, [lessons, setup.rooms]);

  const visibleGroups = useMemo(() => {
    const ordered = orderGroups(setup.groups, setup.programs, { year, programId });
    return groupId ? ordered.filter((g) => g.id === groupId) : ordered;
  }, [setup.groups, setup.programs, year, programId, groupId]);

  const teacher = teacherId || scheduledTeachers[0]?.id || '';
  const room = roomId || usedRooms[0]?.id || '';

  const ctx: TimetableCtx = {
    setup,
    lookup,
    mode,
    badIds,
    editable,
    dragging,
    setDragging,
    onDropLesson: (id, day, slot) => {
      setDragging(null);
      const l = lessons.find((x) => x.id === id);
      if (!l || (l.day === day && l.slot === slot)) return;
      onMove?.(id, day, slot);
    },
    onHover: (lesson, anchor) => setHover(lesson && anchor && !dragging ? { lesson, rect: anchor.getBoundingClientRect() } : null),
  };

  return (
    <TimetableContext.Provider value={ctx}>
      <div className="mb-3 flex flex-wrap items-center gap-3 print:hidden">
        <Tabs<ViewMode>
          items={[
            { key: 'group', label: 'Grupe', count: setup.groups.length },
            { key: 'teacher', label: 'Profesori', count: scheduledTeachers.length },
            { key: 'room', label: 'Săli', count: usedRooms.length },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'group' && (
          <>
            <Select className="h-9 w-32" value={year ?? ''} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)} aria-label="Anul de studiu">
              <option value="">Toți anii</option>
              {years.map((y) => (
                <option key={y} value={y}>Anul {y}</option>
              ))}
            </Select>
            <Select className="h-9 w-56" value={programId ?? ''} onChange={(e) => setProgramId(e.target.value || null)} aria-label="Program">
              <option value="">Toate programele</option>
              {setup.programs.map((p) => (
                <option key={p.id} value={p.id}>{p.abbreviation} · {p.name}</option>
              ))}
            </Select>
            <Select className="h-9 w-40" value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Grupa">
              <option value="">Toate grupele</option>
              {orderGroups(setup.groups, setup.programs, { year, programId }).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </>
        )}
        {mode === 'teacher' && (
          <Select className="h-9 w-64" value={teacher} onChange={(e) => setTeacherId(e.target.value)} aria-label="Profesor">
            {scheduledTeachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        )}
        {mode === 'room' && (
          <Select className="h-9 w-56" value={room} onChange={(e) => setRoomId(e.target.value)} aria-label="Sala">
            {usedRooms.map((r) => (
              <option key={r.id} value={r.id}>{ROOM_KIND_ICON[r.kind]} {r.name} · {r.capacity} locuri</option>
            ))}
          </Select>
        )}
        <div className="ml-auto">
          <Legend parity={setup.general.week_parity} />
        </div>
      </div>

      {mode === 'group' &&
        (visibleGroups.length === 0 ? (
          <EmptyState icon="🔍" title="Nicio grupă pentru acest filtru" description="Schimbă anul sau programul." />
        ) : (
          <GroupGrid groups={visibleGroups} lessons={lessons} />
        ))}
      {mode === 'teacher' && (teacher ? <WeekGrid lessons={lessonsForTeacher(lessons, teacher)} /> : <EmptyState icon="🧑‍🏫" title="Niciun profesor în orar" />)}
      {mode === 'room' && (room ? <WeekGrid lessons={lessonsForRoom(lessons, room)} /> : <EmptyState icon="🏫" title="Nicio sală folosită" />)}

      <HoverCard state={hover} lookup={lookup} setup={setup} violations={violations} />
    </TimetableContext.Provider>
  );
}
