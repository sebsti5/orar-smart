import type { ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface GridColumn<T> {
  key: string;
  header: string;
  hint?: string;
  width?: string;
  placeholder?: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'custom';
  get: (row: T) => string | number | boolean | null | undefined;
  /** Receives the raw string (text/number/select) or boolean (checkbox). */
  set: (row: T, value: string | boolean) => T;
  options?: SelectOption[] | ((row: T) => SelectOption[]);
  validate?: (row: T) => string | null;
  render?: (row: T, onChange: (next: T) => void) => ReactNode;
  /** false = skipped when pasting; function = custom parse of a pasted cell. */
  paste?: false | ((row: T, raw: string) => T);
}

const TRUTHY = new Set(['1', 'da', 'yes', 'true', 'x', '✓', 'y', 'adevărat']);

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** Apply one pasted cell to a row according to its column. */
export function pasteCell<T>(col: GridColumn<T>, row: T, raw: string): T {
  if (col.paste === false) return row;
  if (typeof col.paste === 'function') return col.paste(row, raw);
  if (col.type === 'checkbox') return col.set(row, TRUTHY.has(norm(raw)));
  if (col.type === 'select') {
    const opts = typeof col.options === 'function' ? col.options(row) : (col.options ?? []);
    const n = norm(raw);
    const hit =
      opts.find((o) => norm(o.value) === n || norm(o.label) === n) ??
      opts.find((o) => n && (norm(o.label).startsWith(n) || norm(o.label).includes(n)));
    return hit ? col.set(row, hit.value) : row;
  }
  if (col.type === 'custom') return row;
  return col.set(row, raw);
}

/** True when the pasted first row is a header matching the target columns. */
export function isHeaderRow<T>(cells: string[], cols: GridColumn<T>[]): boolean {
  let hits = 0;
  let filled = 0;
  cells.forEach((cell, i) => {
    const col = cols[i];
    if (!cell || !col) return;
    filled += 1;
    const c = norm(cell);
    const h = norm(col.header);
    if (c === h || h.includes(c) || c.includes(h)) hits += 1;
  });
  return filled > 0 && hits * 2 >= filled;
}

export interface PasteResult<T> {
  rows: T[];
  added: number;
  updated: number;
}

/**
 * Write a pasted 2-D block into `rows`, starting at (rowIndex, colIndex).
 * Columns with paste:false are skipped (the pasted cell goes to the next
 * pasteable column). Missing rows are created with `makeRow`.
 */
export function applyPaste<T>(
  rows: T[],
  table: string[][],
  columns: GridColumn<T>[],
  rowIndex: number,
  colIndex: number,
  makeRow: (index: number, current: T[]) => T,
): PasteResult<T> {
  const targetCols = columns.slice(colIndex).filter((c) => c.paste !== false);
  const data = table.length > 0 && isHeaderRow(table[0], targetCols) ? table.slice(1) : table;
  const out = [...rows];
  let added = 0;
  let updated = 0;
  data.forEach((cells, i) => {
    const at = rowIndex + i;
    const exists = at < out.length;
    let row = exists ? out[at] : makeRow(at, out);
    cells.forEach((raw, j) => {
      const col = targetCols[j];
      if (col) row = pasteCell(col, row, raw);
    });
    if (exists) {
      out[at] = row;
      updated += 1;
    } else {
      out.push(row);
      added += 1;
    }
  });
  return { rows: out, added, updated };
}
