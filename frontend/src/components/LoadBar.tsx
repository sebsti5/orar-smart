import { cx, loadColor } from '../lib/colors';

export function formatPairs(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

export function LoadBar({
  label,
  required,
  capacity,
  compact = false,
  unit = 'perechi',
}: {
  label?: string;
  required: number;
  capacity: number;
  compact?: boolean;
  unit?: string;
}) {
  const ratio = capacity > 0 ? required / capacity : required > 0 ? Infinity : 0;
  const pct = Math.min(100, Math.round((Number.isFinite(ratio) ? ratio : 1) * 100));
  const over = ratio > 1;
  return (
    <div className={cx('min-w-0', compact ? 'w-32' : 'w-full')} title={`${formatPairs(required)} din ${formatPairs(capacity)} ${unit}`}>
      {label && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span className="truncate font-medium text-slate-700">{label}</span>
          <span className={cx('tabular-nums', over ? 'font-semibold text-rose-600' : 'text-slate-500')}>
            {formatPairs(required)} / {formatPairs(capacity)}
          </span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx('h-full rounded-full transition-all duration-500', loadColor(ratio))} style={{ width: `${pct}%` }} />
      </div>
      {compact && !label && (
        <div className={cx('mt-0.5 text-[11px] tabular-nums', over ? 'text-rose-600' : 'text-slate-500')}>
          {formatPairs(required)} / {formatPairs(capacity)}
        </div>
      )}
    </div>
  );
}
