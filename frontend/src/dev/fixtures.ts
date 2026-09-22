// Test-only fixtures (not imported by the app).
import type { InstitutionSetup, PlacedLesson } from '../types';
import { emptySetup } from '../lib/setupDefaults';

export function fixtureSetup(): InstitutionSetup {
  const s = emptySetup();
  return {
    ...s,
    general: { ...s.general, name: 'FCIM', week_parity: true, academic_year: '2026/2027' },
    programs: [
      { id: 'p_ti', name: 'Tehnologia Informației', abbreviation: 'TI' },
      { id: 'p_si', name: 'Securitatea Informațională', abbreviation: 'SI' },
    ],
    groups: [
      { id: 'g1', name: 'TI-251', program_id: 'p_ti', year: 2, students: 25, subgroups: 2 },
      { id: 'g2', name: 'TI-252', program_id: 'p_ti', year: 2, students: 24, subgroups: 2 },
      { id: 'g3', name: 'TI-253', program_id: 'p_ti', year: 2, students: 26, subgroups: 2 },
      { id: 'g4', name: 'SI-251', program_id: 'p_si', year: 2, students: 20, subgroups: 1 },
    ],
    rooms: [
      { id: 'r1', name: '3-611', building: '3', capacity: 150, kind: 'lecture', tags: [] },
      { id: 'r2', name: '3-114', building: '3', capacity: 30, kind: 'seminar', tags: [] },
      { id: 'r3', name: '3-116', building: '3', capacity: 16, kind: 'lab', tags: ['computers'] },
    ],
    teachers: [
      { id: 't1', name: 'Stanciu L.', title: 'conf. univ., dr.', max_pairs_per_week: 10, capabilities: [{ subject_id: 'sub_am', kinds: ['lecture', 'seminar'] }], availability: [] },
      { id: 't2', name: 'Pavel T.', title: '', max_pairs_per_week: null, capabilities: [{ subject_id: 'sub_pc', kinds: ['lab'] }], availability: [] },
    ],
    subjects: [
      { id: 'sub_am', program_id: 'p_ti', year: 2, name: 'Analiza matematică', short: 'AM', lecture_per_week: 1, seminar_per_week: 1, lab_per_week: 0, lab_room_tag: null, lab_split_subgroups: true },
      { id: 'sub_pc', program_id: 'p_ti', year: 2, name: 'Programarea C', short: 'PC', lecture_per_week: 0, seminar_per_week: 0, lab_per_week: 1, lab_room_tag: 'computers', lab_split_subgroups: true },
    ],
    streams: [{ id: 's_ti25', name: 'TI-25 (1–3)', group_ids: ['g1', 'g2', 'g3'] }],
    assignments: [
      { id: 'a_lec', subject_id: 'sub_am', kind: 'lecture', teacher_id: 't1', group_ids: ['g1', 'g2', 'g3'], per_week: null },
      { id: 'a_sem1', subject_id: 'sub_am', kind: 'seminar', teacher_id: 't1', group_ids: ['g1'], per_week: null },
      { id: 'a_lab1', subject_id: 'sub_pc', kind: 'lab', teacher_id: 't2', group_ids: ['g1'], per_week: null },
    ],
  };
}

export function lesson(partial: Partial<PlacedLesson> & Pick<PlacedLesson, 'id' | 'group_ids' | 'day' | 'slot'>): PlacedLesson {
  return {
    assignment_id: partial.id.split('#')[0],
    session_index: 0,
    subject_id: 'sub_am',
    kind: 'lecture',
    teacher_id: 't1',
    subgroup: null,
    parity: 'all',
    room_id: 'r1',
    pinned: false,
    ...partial,
  };
}
