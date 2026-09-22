import { useState } from 'react';
import type { ClipboardEvent, KeyboardEvent, ReactNode } from 'react';
import { cx } from '../lib/colors';
import { isTabular, parseTable } from '../lib/paste';
import { applyPaste } from '../lib/gridPaste';
import type { GridColumn } from '../lib/gridPaste';
import { Button } from './Button';
import { Modal } from './Modal';

export type { GridColumn, SelectOption } from '../lib/gridPaste';

export interface DataGridProps<T> {
  rows: T[];
  columns: GridColumn<T>[];
  onChange: (rows: T[]) => void;
  makeRow: (index: number, current: T[]) => T;
  rowKey: (row: T) => string;
  addLabel?: string;
  empty?: ReactNode;
  rowActions?: (row: T, index: number) => ReactNode;
  rowError?: (row: T) => string | null;
  pasteHint?: string;
  toolbar?: ReactNode;
  onPasted?: (added: number, updated: number) => void;
}

export function DataGrid<T>({
  rows,
  columns,
  onChange,
  makeRow,
  rowKey,
  addLabel = 'Adaugă rând',
  empty,
  rowActions,
  rowError,
  pasteHint,
  toolbar,
  onPasted,
}: DataGridProps<T>) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const updateRow = (i: number, next: T) => onChange(rows.map((r, j) => (j === i ? next : r)));
  const removeRow = (i: number) => onChange(rows.filter((_, j) => j !== i));
  const addRow = () => onChange([...rows, makeRow(rows.length, rows)]);

  const pasteAt = (text: string, rowIndex: number, colIndex: number) => {
    const table = parseTable(text);
    if (table.length === 0) return;
    const res = applyPaste(rows, table, columns, rowIndex, colIndex, makeRow);
    onChange(res.rows);
    onPasted?.(res.added, res.updated);
  };

  const onCellPaste = (e: ClipboardEvent<HTMLElement>, r: number, c: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!isTabular(text)) return;
    e.preventDefault();
    pasteAt(text, r, c);
  };

  const onCellKey = (e: KeyboardEvent<HTMLElement>, r: number) => {
    if (e.key === 'Enter' && !e.shiftKey && r === rows.length - 1 && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      addRow();
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="soft" onClick={addRow} icon={<span>＋</span>}>
          {addLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPasteOpen(true)} icon={<span>📋</span>}>
          Lipește din Excel
        </Button>
        {toolbar}
        <span className="ml-auto hidden text-xs text-slate-400 md:inline">
          Sfat: copiază celule din Excel și lipește-le direct în tabel (Ctrl/⌘+V).
        </span>
      </div>

      {rows.length === 0 && empty ? (
        empty
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-left">
                <th className="w-10 px-2 py-2 text-xs font-medium text-slate-400">#</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-xs font-semibold text-slate-600" style={{ width: c.width }} title={c.hint}>
                    {c.header}
                    {c.hint && <span className="ml-1 cursor-help text-slate-300">ⓘ</span>}
                  </th>
                ))}
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => {
                const err = rowError?.(row) ?? null;
                return (
                  <tr key={rowKey(row)} className={cx('group border-t border-slate-100', err ? 'bg-rose-50/40' : 'hover:bg-slate-50/60')}>
                    <td className="px-2 py-1 text-xs tabular-nums text-slate-400" title={err ?? undefined}>
                      {err ? <span className="text-rose-500">●</span> : r + 1}
                    </td>
                    {columns.map((col, c) => (
                      <td key={col.key} className="px-1 py-1 align-middle" onPaste={(e) => onCellPaste(e, r, c)} onKeyDown={(e) => onCellKey(e, r)}>
                        <GridCellEditor col={col} row={row} onChange={(next) => updateRow(r, next)} />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {rowActions?.(row, r)}
                        <button
                          type="button"
                          onClick={() => removeRow(r)}
                          className="rounded-lg px-2 py-1 text-slate-300 opacity-60 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                          aria-label="Șterge rândul"
                          title="Șterge rândul"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Lipește din Excel"
        description={pasteHint ?? `Ordinea coloanelor: ${columns.filter((c) => c.paste !== false).map((c) => c.header).join(' · ')}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPasteOpen(false)}>
              Anulează
            </Button>
            <Button
              variant="primary"
              disabled={!pasteText.trim()}
              onClick={() => {
                pasteAt(pasteText, rows.length, 0);
                setPasteText('');
                setPasteOpen(false);
              }}
            >
              Adaugă rândurile
            </Button>
          </>
        }
      >
        <textarea
          autoFocus
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={10}
          placeholder="Selectează celulele în Excel, copiază (Ctrl/⌘+C) și lipește aici…"
          className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
        />
        <p className="mt-2 text-xs text-slate-500">Dacă prima linie conține titlurile coloanelor, o sar automat.</p>
      </Modal>
    </div>
  );
}

function GridCellEditor<T>({ col, row, onChange }: { col: GridColumn<T>; row: T; onChange: (r: T) => void }) {
  const base =
    'h-9 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm text-slate-800 transition hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100';
  const error = col.validate?.(row) ?? null;
  const errCls = error ? 'border-rose-300 bg-rose-50/60' : '';

  if (col.type === 'custom' && col.render) return <>{col.render(row, onChange)}</>;

  if (col.type === 'select') {
    const opts = typeof col.options === 'function' ? col.options(row) : (col.options ?? []);
    return (
      <select className={cx(base, errCls, 'pr-6')} value={String(col.get(row) ?? '')} onChange={(e) => onChange(col.set(row, e.target.value))} title={error ?? undefined}>
        {col.placeholder && <option value="">{col.placeholder}</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (col.type === 'checkbox') {
    return (
      <div className="flex justify-center">
        <input type="checkbox" className="h-4 w-4 rounded accent-indigo-600" checked={Boolean(col.get(row))} onChange={(e) => onChange(col.set(row, e.target.checked))} />
      </div>
    );
  }

  if (col.type === 'number') {
    return <NumberCell col={col} row={row} onChange={onChange} className={cx(base, 'text-right tabular-nums', errCls)} error={error} />;
  }

  return (
    <input
      className={cx(base, errCls)}
      value={String(col.get(row) ?? '')}
      placeholder={col.placeholder}
      onChange={(e) => onChange(col.set(row, e.target.value))}
      title={error ?? undefined}
    />
  );
}

function NumberCell<T>({
  col,
  row,
  onChange,
  className,
  error,
}: {
  col: GridColumn<T>;
  row: T;
  onChange: (r: T) => void;
  className: string;
  error: string | null;
}) {
  const shown = col.get(row);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    onChange(col.set(row, draft));
    setDraft(null);
  };
  return (
    <input
      className={className}
      inputMode="decimal"
      value={draft ?? (shown === null || shown === undefined ? '' : String(shown).replace('.', ','))}
      placeholder={col.placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
      title={error ?? col.hint}
    />
  );
}
