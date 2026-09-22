import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cx } from '../lib/colors';

export const inputClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50';

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : (
        hint && <p className="text-xs leading-relaxed text-slate-500">{hint}</p>
      )}
    </div>
  );
}

/** Full width unless the caller sets its own width. */
function widthOf(className?: string): string {
  return className && /(^|\s)(w-|flex-1)/.test(className) ? '' : 'w-full';
}

export function TextInput({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cx(inputClass, widthOf(className), invalid && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100', className)}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputClass, widthOf(className), 'pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-indigo-600' : 'bg-slate-200',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  ariaLabel?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const btn =
    'flex h-10 w-10 items-center justify-center text-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:text-slate-300';
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(clamp(value - step))} aria-label="Scade">
        −
      </button>
      <input
        aria-label={ariaLabel}
        className="h-10 w-12 border-x border-slate-100 text-center text-sm font-semibold tabular-nums text-slate-800 focus:outline-none"
        value={value}
        inputMode="numeric"
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
      />
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(clamp(value + step))} aria-label="Crește">
        +
      </button>
    </div>
  );
}
