import type { Program } from '../types';

export interface ParsedGroupName {
  abbreviation: string; // "TI"
  admissionYY: number; // 24 for TI-241
  index: number; // 1 for TI-241
}

const GROUP_RE = /^\s*([A-Za-zĂÂÎȘŞȚŢăâîșşțţ]{1,6})\s*[-–_ ]?\s*(\d{2})(\d{1,2})(?!\d)/;

/** "TI-241" → { abbreviation: "TI", admissionYY: 24, index: 1 }. */
export function parseGroupName(name: string): ParsedGroupName | null {
  const m = GROUP_RE.exec(name);
  if (!m) return null;
  return {
    abbreviation: m[1].toUpperCase(),
    admissionYY: Number(m[2]),
    index: Number(m[3]),
  };
}

/** "2026/2027" → 2026. Falls back to the current academic year. */
export function academicStartYear(academicYear: string, now: Date = new Date()): number {
  const m = /(\d{4})/.exec(academicYear);
  if (m) return Number(m[1]);
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Study year from the admission year encoded in the group name.
 * TI-251 in 2026/2027 → 26 − 25 + 1 = 2. Clamped to 1..8.
 */
export function studyYearFromAdmission(admissionYY: number, academicYear: string): number {
  const startYY = academicStartYear(academicYear) % 100;
  let diff = startYY - admissionYY;
  if (diff < -50) diff += 100; // century wrap (e.g. 2001/2002 vs "99")
  return Math.min(8, Math.max(1, diff + 1));
}

/** Two-digit admission year for a given study year: year 1 in 2026/2027 → 26. */
export function admissionYYForStudyYear(studyYear: number, academicYear: string): number {
  const startYY = academicStartYear(academicYear) % 100;
  return (startYY - studyYear + 1 + 100) % 100;
}

export interface GroupDetection {
  program: Program | null;
  abbreviation: string;
  year: number;
}

/** Figure out program + study year from a typed/pasted group name. */
export function detectGroup(
  name: string,
  programs: Program[],
  academicYear: string,
): GroupDetection | null {
  const parsed = parseGroupName(name);
  if (!parsed) return null;
  const program =
    programs.find((p) => p.abbreviation.toUpperCase() === parsed.abbreviation) ?? null;
  return {
    program,
    abbreviation: parsed.abbreviation,
    year: studyYearFromAdmission(parsed.admissionYY, academicYear),
  };
}

/** Next free group names: TI + year 1 + 4 in 2026/2027 → TI-261..TI-264. */
export function nextGroupNames(
  abbreviation: string,
  studyYear: number,
  count: number,
  academicYear: string,
  existingNames: string[],
): string[] {
  const yy = String(admissionYYForStudyYear(studyYear, academicYear)).padStart(2, '0');
  const taken = new Set(existingNames.map((n) => n.trim().toUpperCase()));
  const out: string[] = [];
  for (let i = 1; out.length < count && i < 100; i += 1) {
    const name = `${abbreviation.toUpperCase()}-${yy}${i}`;
    if (!taken.has(name)) out.push(name);
  }
  return out;
}

const STOP_WORDS = new Set(['si', 'și', 'de', 'a', 'al', 'ale', 'in', 'în', 'la', 'cu', 'pe', 'the', 'and', 'of']);

/** "Tehnologia Informației" → "TI"; "Securitatea Informațională" → "SI". */
export function suggestAbbreviation(name: string): string {
  const words = name
    .split(/[\s\-–/]+/)
    .map((w) => w.trim())
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return '';
  const raw = words.length === 1 ? words[0].slice(0, 2) : words.slice(0, 4).map((w) => w[0]).join('');
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}
