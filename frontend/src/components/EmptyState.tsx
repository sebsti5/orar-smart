import type { ReactNode } from 'react';

export function EmptyState({
  icon = '✨',
  title,
  description,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-soft">
        {icon}
      </div>
      <h4 className="text-base font-semibold text-slate-800">{title}</h4>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
