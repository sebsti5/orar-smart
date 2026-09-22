import { useState } from 'react';
import type { Issue } from '../../types';
import { SEVERITY_STYLE, cx } from '../../lib/colors';

export function StepIssues({ issues }: { issues: Issue[] }) {
  const [open, setOpen] = useState(false);
  const relevant = issues.filter((i) => i.severity !== 'info');
  if (relevant.length === 0) return null;
  const errors = relevant.filter((i) => i.severity === 'error').length;
  const shown = open ? relevant : relevant.slice(0, 2);
  return (
    <div className={cx('mb-5 rounded-xl border px-4 py-3', errors ? SEVERITY_STYLE.error.box : SEVERITY_STYLE.warning.box)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">
          {errors ? `${errors} ${errors === 1 ? 'problemă de rezolvat' : 'probleme de rezolvat'}` : 'Câteva lucruri de verificat'} în acest pas
        </p>
        {relevant.length > 2 && (
          <button type="button" className="text-xs font-medium text-slate-600 hover:underline" onClick={() => setOpen(!open)}>
            {open ? 'Mai puțin' : `Vezi toate (${relevant.length})`}
          </button>
        )}
      </div>
      <ul className="mt-2 space-y-1">
        {shown.map((i, k) => (
          <li key={`${i.code}-${i.entity_id ?? ''}-${k}`} className="flex gap-2 text-sm text-slate-700">
            <span aria-hidden>{SEVERITY_STYLE[i.severity].icon}</span>
            <span>{i.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
