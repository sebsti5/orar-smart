import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, extractDetail } from './api';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(body === undefined ? '' : JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('extractDetail', () => {
  it('uses FastAPI string details as-is', () => {
    expect(extractDetail(400, { detail: 'Email deja folosit.' })).toBe('Email deja folosit.');
  });

  it('summarises 422 validation lists in Romanian', () => {
    const msg = extractDetail(422, { detail: [{ loc: ['body', 'groups', 0, 'students'], msg: 'too big' }] });
    expect(msg).toContain('Unele date nu sunt valide.');
    expect(msg).toContain('groups › 0 › students: too big');
  });

  it('falls back to a status message', () => {
    expect(extractDetail(429, null)).toMatch(/Prea multe/);
    expect(extractDetail(418, {})).toBe('Eroare neașteptată (418).');
  });
});

describe('api client', () => {
  it('sends JSON with credentials and parses the body', async () => {
    const fn = mockFetch(200, { email: 'a@b.md', institution_name: 'UTM' });
    const me = await api.login({ email: 'a@b.md', password: 'x' });
    expect(me.institution_name).toBe('UTM');
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.md', password: 'x' });
  });

  it('throws ApiError with the server detail', async () => {
    mockFetch(401, { detail: 'Neautentificat' });
    await expect(api.me()).rejects.toMatchObject({ status: 401, detail: 'Neautentificat' });
  });

  it('throws a friendly ApiError when offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await api.me().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(0);
  });

  it('normalizes numeric timetable ids to strings', async () => {
    mockFetch(200, [{ id: 7, name: 'x', created_at: '', status: 'done', published: false, progress: { phase: '', message: '' } }]);
    const list = await api.listTimetables();
    expect(list[0].id).toBe('7');
  });

  it('builds the export URL', () => {
    expect(api.exportUrl('12')).toBe('/api/timetables/12/export.xlsx');
  });
});
