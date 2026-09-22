import { KIND_STYLE, cx } from '../../lib/colors';
import { KINDS, KIND_LABEL } from '../../lib/labels';

export function Legend({ parity }: { parity: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
      {KINDS.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className={cx('h-2.5 w-2.5 rounded-full', KIND_STYLE[k].dot)} />
          {KIND_LABEL[k]}
        </span>
      ))}
      {parity && <span>· I = săpt. impară, P = săpt. pară</span>}
      <span>· sg. = subgrupă</span>
    </div>
  );
}
