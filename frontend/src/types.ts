// Mirror of backend/app/schemas.py (the source of truth) + API response types.

export type LessonKind = 'lecture' | 'seminar' | 'lab';
export type RoomKind = 'lecture' | 'seminar' | 'lab' | 'sport' | 'any';
export type Parity = 'all' | 'odd' | 'even';
export type InstitutionType = 'university' | 'college' | 'school';

export interface Slot {
  start: string; // "08:00"
  end: string; // "09:30"
}

export interface GeneralSettings {
  institution_type: InstitutionType;
  name: string;
  week_parity: boolean;
  days_per_week: number;
  min_lessons_per_day: number;
  max_lessons_per_day: number;
  slots: Slot[];
  break_minutes: number;
  big_break_after_slot: number | null;
  big_break_minutes: number;
  academic_year: string;
  semester: number;
}

export interface Program {
  id: string;
  name: string;
  abbreviation: string;
}

export interface Group {
  id: string;
  name: string;
  program_id: string;
  year: number;
  students: number;
  subgroups: number;
}

export interface Room {
  id: string;
  name: string;
  building: string;
  capacity: number;
  kind: RoomKind;
  tags: string[];
}

export interface Subject {
  id: string;
  program_id: string;
  year: number;
  name: string;
  short: string;
  lecture_per_week: number;
  seminar_per_week: number;
  lab_per_week: number;
  lab_room_tag: string | null;
  lab_split_subgroups: boolean;
}

export interface TeacherCapability {
  subject_id: string;
  kinds: LessonKind[];
}

export interface Teacher {
  id: string;
  name: string;
  title: string;
  max_pairs_per_week: number | null;
  capabilities: TeacherCapability[];
  /** availability[day][slot]; empty = always available */
  availability: boolean[][];
}

export interface Stream {
  id: string;
  name: string;
  group_ids: string[];
}

export interface RoomUnavailability {
  room_id: string;
  day: number;
  slot: number;
}

export interface Assignment {
  id: string;
  subject_id: string;
  kind: LessonKind;
  teacher_id: string;
  group_ids: string[];
  per_week: number | null;
}

export interface PinnedLesson {
  assignment_id: string;
  session_index: number;
  subgroup: number | null;
  day: number;
  slot: number;
  room_id: string | null;
}

export interface InstitutionSetup {
  general: GeneralSettings;
  programs: Program[];
  groups: Group[];
  rooms: Room[];
  teachers: Teacher[];
  subjects: Subject[];
  streams: Stream[];
  room_unavailability: RoomUnavailability[];
  assignments: Assignment[];
  pinned: PinnedLesson[];
}

// ---------------------------------------------------------------- analysis

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  severity: Severity;
  code: string;
  message: string;
  entity: string | null;
  entity_id: string | null;
}

export interface LoadStat {
  entity: 'teacher' | 'group' | 'room_kind';
  entity_id: string;
  name: string;
  required: number;
  capacity: number;
}

export interface Analysis {
  issues: Issue[];
  loads: LoadStat[];
  total_sessions: number;
  can_generate: boolean;
}

// ---------------------------------------------------------------- timetable

export interface PlacedLesson {
  id: string;
  assignment_id: string;
  session_index: number;
  subject_id: string;
  kind: LessonKind;
  teacher_id: string;
  group_ids: string[];
  subgroup: number | null;
  day: number;
  slot: number;
  parity: Parity;
  room_id: string | null;
  pinned: boolean;
}

export interface Violation {
  severity: Severity;
  code: string;
  message: string;
  lesson_ids: string[];
}

export interface Score {
  group_gaps: number;
  teacher_gaps: number;
  late_lessons: number;
  days_over_min_violations: number;
  same_subject_same_day: number;
  total_penalty: number;
}

export interface SolveResult {
  status: 'optimal' | 'feasible' | 'infeasible' | 'error';
  lessons: PlacedLesson[];
  unplaced: string[];
  violations: Violation[];
  score: Score;
  message: string;
  solve_seconds: number;
}

// ---------------------------------------------------------------- API

export interface AuthUser {
  email: string;
  institution_name: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  institution_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SetupWithAnalysis {
  setup: InstitutionSetup;
  analysis: Analysis;
}

export interface AutoAssignResponse {
  assignments: Assignment[];
  analysis: Analysis;
}

export type TimetableStatus = 'queued' | 'running' | 'done' | 'failed';

export interface TimetableProgress {
  phase: string;
  message: string;
  best_penalty?: number | null;
}

export interface TimetableSummary {
  id: string;
  name: string;
  created_at: string;
  status: TimetableStatus;
  published: boolean;
  progress: TimetableProgress;
}

export interface TimetableDetail extends TimetableSummary {
  result: SolveResult | null;
  setup_snapshot: InstitutionSetup;
}

export interface CreateTimetableRequest {
  name?: string;
  group_ids?: string[];
  time_limit_s?: number;
}

export interface MoveRequest {
  lesson_id: string;
  day: number;
  slot: number;
  room_id?: string | null;
}

export interface MoveResponse {
  lessons: PlacedLesson[];
  violations: Violation[];
}

export interface PublicTimetable {
  institution_name: string;
  setup: InstitutionSetup;
  timetable: TimetableDetail;
}
