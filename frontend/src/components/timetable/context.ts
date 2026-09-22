import { createContext, useContext } from 'react';
import type { InstitutionSetup, PlacedLesson } from '../../types';
import type { Lookup } from '../../lib/lookup';

export type ViewMode = 'group' | 'teacher' | 'room';

export interface TimetableCtx {
  setup: InstitutionSetup;
  lookup: Lookup;
  mode: ViewMode;
  badIds: Set<string>;
  editable: boolean;
  dragging: string | null;
  setDragging: (id: string | null) => void;
  onDropLesson: (lessonId: string, day: number, slot: number) => void;
  onHover: (lesson: PlacedLesson | null, anchor?: HTMLElement) => void;
}

export const TimetableContext = createContext<TimetableCtx | null>(null);

export function useTimetable(): TimetableCtx {
  const ctx = useContext(TimetableContext);
  if (!ctx) throw new Error('useTimetable must be used inside <TimetableContext.Provider>');
  return ctx;
}
