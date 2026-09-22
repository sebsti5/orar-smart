import type { ReactNode } from 'react';
import { cx } from '../lib/colors';

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        className ?? 'bg-slate-100 text-slate-600',
      )}
    >
      {children}
    </span>
  );
}

export function Chip({
  children,
  onRemove,
  className,
}: {
  children: ReactNode;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700',
        className,
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="-mr-0.5 rounded px-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Elimină"
        >
          ×
        </button>
      )}
    </span>
  );
}
