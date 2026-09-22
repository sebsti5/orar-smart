import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TimetableViewer } from './TimetableViewer';
import { fixtureSetup, lesson } from '../../dev/fixtures';

const setup = fixtureSetup();
const lessons = [
  lesson({ id: 'a_lec#0', group_ids: ['g1', 'g2', 'g3'], day: 0, slot: 0 }),
  lesson({ id: 'a_sem1#0', kind: 'seminar', subject_id: 'sub_am', group_ids: ['g1'], day: 0, slot: 1, parity: 'odd', room_id: 'r2' }),
  lesson({ id: 'a_lab1#0#s1', kind: 'lab', subject_id: 'sub_pc', teacher_id: 't2', group_ids: ['g1'], subgroup: 1, day: 1, slot: 0, room_id: 'r3' }),
  lesson({ id: 'a_lab1#0#s2', kind: 'lab', subject_id: 'sub_pc', teacher_id: 't2', group_ids: ['g1'], subgroup: 2, day: 1, slot: 0, room_id: 'r3' }),
];

describe('TimetableViewer', () => {
  it('renders groups as columns with a merged stream lecture', () => {
    render(<TimetableViewer setup={setup} lessons={lessons} />);
    for (const name of ['TI-251', 'TI-252', 'TI-253', 'SI-251']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(name) })).toBeInTheDocument();
    }
    const lecture = document.querySelector('[data-lesson-id="a_lec#0"]');
    expect(lecture?.closest('td')?.getAttribute('colspan')).toBe('3');
    expect(document.querySelectorAll('[data-lesson-id="a_lec#0"]')).toHaveLength(1);
  });

  it('shows parity sub-rows and subgroup labs side by side', () => {
    render(<TimetableViewer setup={setup} lessons={lessons} />);
    expect(screen.getByTitle('Săptămâna impară')).toBeInTheDocument();
    expect(screen.getByTitle('Săptămâna pară')).toBeInTheDocument();
    const sg1 = document.querySelector('[data-lesson-id="a_lab1#0#s1"]');
    const sg2 = document.querySelector('[data-lesson-id="a_lab1#0#s2"]');
    expect(sg1?.closest('td')).toBe(sg2?.closest('td'));
    expect(within(sg1 as HTMLElement).getByText('sg.1')).toBeInTheDocument();
  });

  it('filters groups by program', () => {
    render(<TimetableViewer setup={setup} lessons={lessons} />);
    fireEvent.change(screen.getByLabelText('Program'), { target: { value: 'p_si' } });
    expect(screen.queryByRole('columnheader', { name: /TI-251/ })).toBeNull();
    expect(screen.getByRole('columnheader', { name: /SI-251/ })).toBeInTheDocument();
  });

  it('switches to the teacher week view', () => {
    render(<TimetableViewer setup={setup} lessons={lessons} />);
    fireEvent.click(screen.getByRole('tab', { name: /Profesori/ }));
    expect(screen.getByRole('columnheader', { name: 'Luni' })).toBeInTheDocument();
    // t1 teaches the lecture and the seminar
    expect(document.querySelectorAll('[data-lesson-id]')).toHaveLength(2);
  });

  it('calls onMove when a lesson is dropped on another cell', () => {
    const onMove = vi.fn();
    render(<TimetableViewer setup={setup} lessons={lessons} editable onMove={onMove} />);
    const card = document.querySelector('[data-lesson-id="a_lec#0"]') as HTMLElement;
    const data = new Map<string, string>();
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? '', effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(card, { dataTransfer });
    const rows = document.querySelectorAll('tbody tr');
    // rows: slot 0 (1 row), slot 1 split odd/even (2 rows), slot 2 (1 row) → index 4 = Luni, slot 3
    const target = rows[4].querySelector('td') as HTMLElement;
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(onMove).toHaveBeenCalledWith('a_lec#0', 0, 3);
  });

  it('highlights lessons involved in error violations', () => {
    render(
      <TimetableViewer
        setup={setup}
        lessons={lessons}
        violations={[{ severity: 'error', code: 'teacher_clash', message: 'Suprapunere', lesson_ids: ['a_sem1#0'] }]}
      />,
    );
    expect(document.querySelector('[data-lesson-id="a_sem1#0"]')?.className).toMatch(/ring-rose-500/);
    expect(document.querySelector('[data-lesson-id="a_lec#0"]')?.className).not.toMatch(/ring-rose-500/);
  });
});
