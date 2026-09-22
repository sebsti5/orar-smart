import type { Assignment, GeneralSettings, Group, InstitutionSetup, Room, Slot, Subject, Teacher } from '../types';

export const DEFAULT_SLOTS: Slot[] = [
  { start: '08:00', end: '09:30' },
  { start: '09:45', end: '11:15' },
  { start: '11:30', end: '13:00' },
  { start: '13:30', end: '15:00' },
  { start: '15:15', end: '16:45' },
  { start: '17:00', end: '18:30' },
  { start: '18:45', end: '20:15' },
];

export function defaultGeneral(): GeneralSettings {
  return {
    institution_type: 'university',
    name: '',
    week_parity: false,
    days_per_week: 5,
    min_lessons_per_day: 2,
    max_lessons_per_day: 4,
    slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
    break_minutes: 15,
    big_break_after_slot: 3,
    big_break_minutes: 30,
    academic_year: '2026/2027',
    semester: 1,
  };
}

export function emptySetup(): InstitutionSetup {
  return {
    general: defaultGeneral(),
    programs: [],
    groups: [],
    rooms: [],
    teachers: [],
    subjects: [],
    streams: [],
    room_unavailability: [],
    assignments: [],
    pinned: [],
  };
}

/** Defaults first, then whatever the server sent (which may omit fields). */
function fill<T>(defaults: Partial<T>, x: T): T {
  return { ...defaults, ...x };
}

/** Fill any missing fields so the UI never has to guard against undefined. */
export function normalizeSetup(raw: Partial<InstitutionSetup> | null | undefined): InstitutionSetup {
  const base = emptySetup();
  if (!raw) return base;
  return {
    general: { ...base.general, ...(raw.general ?? {}) },
    programs: raw.programs ?? [],
    groups: (raw.groups ?? []).map((g) => fill<Group>({ subgroups: 1 }, g)),
    rooms: (raw.rooms ?? []).map((r) => fill<Room>({ building: '', kind: 'any', tags: [] }, r)),
    teachers: (raw.teachers ?? []).map((t) =>
      fill<Teacher>({ title: '', max_pairs_per_week: null, capabilities: [], availability: [] }, t),
    ),
    subjects: (raw.subjects ?? []).map((s) =>
      fill<Subject>(
        {
          short: '',
          lecture_per_week: 0,
          seminar_per_week: 0,
          lab_per_week: 0,
          lab_room_tag: null,
          lab_split_subgroups: true,
        },
        s,
      ),
    ),
    streams: raw.streams ?? [],
    room_unavailability: raw.room_unavailability ?? [],
    assignments: (raw.assignments ?? []).map((a) => fill<Assignment>({ per_week: null }, a)),
    pinned: raw.pinned ?? [],
  };
}
