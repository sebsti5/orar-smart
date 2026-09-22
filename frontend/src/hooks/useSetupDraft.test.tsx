import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { fixtureSetup } from '../dev/fixtures';
import { AUTOSAVE_MS, useSetupDraft } from './useSetupDraft';

const analysis = { issues: [], loads: [], total_sessions: 3, can_generate: true };

beforeEach(() => {
  vi.spyOn(api, 'getSetup').mockResolvedValue(fixtureSetup());
  vi.spyOn(api, 'analysis').mockResolvedValue(analysis);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useSetupDraft', () => {
  it('debounces edits into a single PUT and reports "saved"', async () => {
    const put = vi.spyOn(api, 'putSetup').mockImplementation(async (s) => ({ setup: s, analysis: { ...analysis, total_sessions: 9 } }));
    const { result } = renderHook(() => useSetupDraft());
    await waitFor(() => expect(result.current.setup).not.toBeNull());

    vi.useFakeTimers();
    act(() => result.current.update((s) => ({ ...s, general: { ...s.general, name: 'A' } })));
    act(() => result.current.update((s) => ({ ...s, general: { ...s.general, name: 'AB' } })));
    expect(result.current.saveState).toBe('dirty');
    expect(put).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 10);
    });
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0].general.name).toBe('AB');
    expect(result.current.saveState).toBe('saved');
    expect(result.current.analysis?.total_sessions).toBe(9);
  });

  it('flush saves immediately and surfaces errors', async () => {
    vi.spyOn(api, 'putSetup').mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSetupDraft());
    await waitFor(() => expect(result.current.setup).not.toBeNull());
    act(() => result.current.update((s) => ({ ...s, general: { ...s.general, name: 'X' } })));
    let ok = true;
    await act(async () => {
      ok = await result.current.flush();
    });
    expect(ok).toBe(false);
    expect(result.current.saveState).toBe('error');
    expect(result.current.saveError).toBe('Nu am putut salva.');
  });
});
