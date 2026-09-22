import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataGrid } from './DataGrid';
import type { GridColumn } from './DataGrid';

interface Row {
  id: string;
  name: string;
  students: number;
}

const columns: GridColumn<Row>[] = [
  { key: 'name', header: 'Grupa', type: 'text', placeholder: 'TI-251', get: (r) => r.name, set: (r, v) => ({ ...r, name: String(v) }) },
  { key: 'students', header: 'Studenți', type: 'number', get: (r) => r.students, set: (r, v) => ({ ...r, students: Number(v) || 0 }) },
];

let n = 0;
function Harness({ initial = [] as Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  return (
    <>
      <DataGrid rows={rows} columns={columns} onChange={setRows} rowKey={(r) => r.id} makeRow={() => ({ id: `r${n++}`, name: '', students: 0 })} />
      <output data-testid="json">{JSON.stringify(rows.map(({ name, students }) => [name, students]))}</output>
    </>
  );
}

describe('DataGrid', () => {
  it('adds a row and edits it inline', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Adaugă rând/ }));
    fireEvent.change(screen.getByPlaceholderText('TI-251'), { target: { value: 'TI-252' } });
    expect(screen.getByTestId('json').textContent).toBe('[["TI-252",0]]');
  });

  it('pasting an Excel block into a cell fills and appends rows', () => {
    render(<Harness initial={[{ id: 'a', name: '', students: 0 }]} />);
    const input = screen.getByPlaceholderText('TI-251');
    fireEvent.paste(input, { clipboardData: { getData: () => 'TI-251\t25\nTI-252\t24\n' } });
    expect(screen.getByTestId('json').textContent).toBe('[["TI-251",25],["TI-252",24]]');
  });

  it('commits number cells on blur', () => {
    render(<Harness initial={[{ id: 'a', name: 'X', students: 1 }]} />);
    const num = screen.getByDisplayValue('1');
    fireEvent.change(num, { target: { value: '30' } });
    expect(screen.getByTestId('json').textContent).toBe('[["X",1]]');
    fireEvent.blur(num);
    expect(screen.getByTestId('json').textContent).toBe('[["X",30]]');
  });

  it('removes a row', () => {
    render(<Harness initial={[{ id: 'a', name: 'X', students: 1 }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Șterge rândul' }));
    expect(screen.getByTestId('json').textContent).toBe('[]');
  });
});
