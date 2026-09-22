import { describe, expect, it } from 'vitest';
import { applyPaste, isHeaderRow, pasteCell } from './gridPaste';
import type { GridColumn } from './gridPaste';

interface Row {
  id: string;
  name: string;
  n: number;
  kind: string;
  flag: boolean;
}

const cols: GridColumn<Row>[] = [
  { key: 'name', header: 'Nume', type: 'text', get: (r) => r.name, set: (r, v) => ({ ...r, name: String(v) }) },
  { key: 'n', header: 'Număr', type: 'number', get: (r) => r.n, set: (r, v) => ({ ...r, n: Number(String(v).replace(',', '.')) || 0 }) },
  { key: 'skip', header: 'Info', type: 'custom', paste: false, get: () => '', set: (r) => r },
  {
    key: 'kind',
    header: 'Tip',
    type: 'select',
    options: [
      { value: 'lecture', label: 'Aulă (curs)' },
      { value: 'lab', label: 'Laborator' },
    ],
    get: (r) => r.kind,
    set: (r, v) => ({ ...r, kind: String(v) }),
  },
  { key: 'flag', header: 'Activ', type: 'checkbox', get: (r) => r.flag, set: (r, v) => ({ ...r, flag: Boolean(v) }) },
];

let counter = 0;
const make = (): Row => ({ id: `r${counter++}`, name: '', n: 0, kind: 'lecture', flag: false });

describe('applyPaste', () => {
  it('appends rows, skipping paste:false columns', () => {
    const res = applyPaste([], [['A', '1,5', 'laborator', 'da'], ['B', '2', 'curs', 'nu']], cols, 0, 0, make);
    expect(res.added).toBe(2);
    expect(res.rows.map((r) => [r.name, r.n, r.kind, r.flag])).toEqual([
      ['A', 1.5, 'lab', true],
      ['B', 2, 'lecture', false],
    ]);
  });

  it('overwrites existing rows starting at a given cell', () => {
    const rows = [make(), make()];
    const res = applyPaste(rows, [['7'], ['8'], ['9']], cols, 1, 1, make);
    expect(res.updated).toBe(1);
    expect(res.added).toBe(2);
    expect(res.rows.map((r) => r.n)).toEqual([0, 7, 8, 9]);
    expect(res.rows[0]).toBe(rows[0]);
  });

  it('drops a header row that matches the column titles', () => {
    const res = applyPaste([], [['Nume', 'Număr'], ['X', '3']], cols, 0, 0, make);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].name).toBe('X');
  });

  it('does not mutate the input array', () => {
    const rows = [make()];
    const copy = [...rows];
    applyPaste(rows, [['Z']], cols, 0, 0, make);
    expect(rows).toEqual(copy);
  });
});

describe('pasteCell / isHeaderRow', () => {
  it('leaves select unchanged when nothing matches', () => {
    const r = make();
    expect(pasteCell(cols[3], r, 'piscină')).toBe(r);
  });

  it('matches select options ignoring diacritics', () => {
    expect(pasteCell(cols[3], make(), 'aula (curs)').kind).toBe('lecture');
  });

  it('header detection needs a majority of matches', () => {
    expect(isHeaderRow(['Nume', 'foo'], cols)).toBe(true);
    expect(isHeaderRow(['TI-251', '25'], cols)).toBe(false);
  });
});
