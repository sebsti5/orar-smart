import type { SaveState } from '../../hooks/useSetupDraft';
import { Spinner } from '../../components/Spinner';

export function SaveIndicator({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry: () => void }) {
  if (state === 'saving' || state === 'dirty') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
        <Spinner className="h-3.5 w-3.5" /> Se salvează…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-rose-600" aria-live="polite" title={error ?? undefined}>
        Nu s-a salvat{error ? `: ${error}` : ''}
        <button type="button" className="font-medium underline" onClick={onRetry}>
          Reîncearcă
        </button>
      </span>
    );
  }
  if (state === 'saved') {
    return <span className="text-xs font-medium text-emerald-600" aria-live="polite">Salvat ✓</span>;
  }
  return <span className="text-xs text-slate-400">Salvare automată</span>;
}
