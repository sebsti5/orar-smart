import type {
  Analysis,
  AuthUser,
  AutoAssignResponse,
  CreateTimetableRequest,
  InstitutionSetup,
  LoginRequest,
  MoveRequest,
  MoveResponse,
  PublicTimetable,
  RegisterRequest,
  SetupWithAnalysis,
  TimetableDetail,
  TimetableSummary,
} from './types';

export const API_BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Cererea nu este validă.',
  401: 'Trebuie să te autentifici din nou.',
  403: 'Nu ai acces la această resursă.',
  404: 'Nu am găsit ce căutai.',
  409: 'Există deja o înregistrare cu aceste date.',
  413: 'Datele trimise sunt prea mari.',
  422: 'Unele date nu sunt valide.',
  429: 'Prea multe încercări. Mai încearcă peste câteva minute.',
  500: 'A apărut o eroare pe server. Încearcă din nou.',
  502: 'Serverul nu răspunde momentan.',
  503: 'Serviciul este temporar indisponibil.',
};

interface ValidationItem {
  loc?: (string | number)[];
  msg?: string;
}

function isValidationList(v: unknown): v is ValidationItem[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null);
}

/** Turn a FastAPI error body into a human Romanian sentence. */
export function extractDetail(status: number, body: unknown): string {
  const fallback = STATUS_MESSAGES[status] ?? `Eroare neașteptată (${status}).`;
  if (typeof body !== 'object' || body === null) return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (isValidationList(detail) && detail.length > 0) {
    const parts = detail.slice(0, 3).map((d) => {
      const where = (d.loc ?? []).filter((p) => p !== 'body').join(' › ');
      return where ? `${where}: ${d.msg ?? 'invalid'}` : (d.msg ?? 'invalid');
    });
    const more = detail.length > 3 ? ` (+${detail.length - 3} alte probleme)` : '';
    return `${fallback} ${parts.join('; ')}${more}`;
  }
  return fallback;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Nu mă pot conecta la server. Verifică conexiunea la internet.');
  }
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!res.ok) throw new ApiError(res.status, extractDetail(res.status, parsed));
  return parsed as T;
}

// Timetable ids may arrive as numbers; the UI always handles them as strings.
function normSummary<T extends TimetableSummary>(t: T): T {
  return { ...t, id: String(t.id) };
}

export const api = {
  // auth
  register: (b: RegisterRequest) => request<AuthUser>('POST', '/auth/register', b),
  login: (b: LoginRequest) => request<AuthUser>('POST', '/auth/login', b),
  logout: () => request<{ ok: boolean }>('POST', '/auth/logout'),
  me: () => request<AuthUser>('GET', '/auth/me'),

  // setup
  getSetup: () => request<InstitutionSetup>('GET', '/setup'),
  putSetup: (s: InstitutionSetup) => request<SetupWithAnalysis>('PUT', '/setup', s),
  loadDemo: () => request<SetupWithAnalysis>('POST', '/setup/demo'),
  autoAssign: () => request<AutoAssignResponse>('POST', '/setup/auto-assign'),
  analysis: () => request<Analysis>('GET', '/analysis'),

  // timetables
  createTimetable: async (b: CreateTimetableRequest) =>
    normSummary(await request<TimetableSummary>('POST', '/timetables', b)),
  listTimetables: async () =>
    (await request<TimetableSummary[]>('GET', '/timetables')).map(normSummary),
  getTimetable: async (id: string) =>
    normSummary(await request<TimetableDetail>('GET', `/timetables/${encodeURIComponent(id)}`)),
  deleteTimetable: (id: string) =>
    request<{ ok: boolean }>('DELETE', `/timetables/${encodeURIComponent(id)}`),
  moveLesson: (id: string, b: MoveRequest) =>
    request<MoveResponse>('POST', `/timetables/${encodeURIComponent(id)}/move`, b),
  publish: async (id: string, published: boolean) =>
    normSummary(
      await request<TimetableSummary>('POST', `/timetables/${encodeURIComponent(id)}/publish`, {
        published,
      }),
    ),
  exportUrl: (id: string) => `${API_BASE}/timetables/${encodeURIComponent(id)}/export.xlsx`,

  // sharing
  shareToken: () => request<{ token: string }>('GET', '/share-token'),
  publicTimetable: async (token: string) => {
    const r = await request<PublicTimetable>('GET', `/public/${encodeURIComponent(token)}`);
    return { ...r, timetable: normSummary(r.timetable) };
  },
};

export type Api = typeof api;
