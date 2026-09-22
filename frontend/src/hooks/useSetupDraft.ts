import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../api';
import { normalizeSetup } from '../lib/setupDefaults';
import type { Analysis, InstitutionSetup } from '../types';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export const AUTOSAVE_MS = 800;

export interface SetupDraft {
  setup: InstitutionSetup | null;
  analysis: Analysis | null;
  loadError: string | null;
  saveState: SaveState;
  saveError: string | null;
  update: (fn: (s: InstitutionSetup) => InstitutionSetup) => void;
  replace: (s: InstitutionSetup, a: Analysis | null) => void;
  flush: () => Promise<boolean>;
  reload: () => Promise<void>;
}

/**
 * Local copy of the institution setup with debounced autosave (PUT /setup).
 * Every successful PUT refreshes the analysis.
 */
export function useSetupDraft(): SetupDraft {
  const [setup, setSetup] = useState<InstitutionSetup | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const pending = useRef<InstitutionSetup | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    const toSave = pending.current;
    if (!toSave) return true;
    pending.current = null;
    setSaveState('saving');
    const run = (async () => {
      try {
        const res = await api.putSetup(toSave);
        setAnalysis(res.analysis);
        setSaveError(null);
        setSaveState(pending.current ? 'dirty' : 'saved');
        return true;
      } catch (e) {
        setSaveError(e instanceof ApiError ? e.detail : 'Nu am putut salva.');
        setSaveState('error');
        if (!pending.current) pending.current = toSave; // retry on next change / flush
        return false;
      }
    })();
    inflight.current = run;
    const ok = await run;
    inflight.current = null;
    return ok;
  }, []);

  const schedule = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void save();
    }, AUTOSAVE_MS);
  }, [save]);

  const update = useCallback(
    (fn: (s: InstitutionSetup) => InstitutionSetup) => {
      setSetup((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        pending.current = next;
        return next;
      });
      setSaveState('dirty');
      schedule();
    },
    [schedule],
  );

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    return save();
  }, [save]);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const [s, a] = await Promise.all([api.getSetup(), api.analysis().catch(() => null)]);
      setSetup(normalizeSetup(s));
      setAnalysis(a);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.detail : 'Nu am putut încărca datele.');
    }
  }, []);

  const replace = useCallback((s: InstitutionSetup, a: Analysis | null) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    pending.current = null;
    setSetup(normalizeSetup(s));
    if (a) setAnalysis(a);
    setSaveState('saved');
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Save on tab close / unmount so no edit is lost.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        void save();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (pending.current) void save();
    };
  }, [save]);

  return { setup, analysis, loadError, saveState, saveError, update, replace, flush, reload };
}
