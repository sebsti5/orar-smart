import { describe, expect, it } from 'vitest';
import {
  academicStartYear,
  admissionYYForStudyYear,
  detectGroup,
  nextGroupNames,
  parseGroupName,
  studyYearFromAdmission,
  suggestAbbreviation,
} from './groupName';

const programs = [
  { id: 'p_ti', name: 'Tehnologia Informației', abbreviation: 'TI' },
  { id: 'p_si', name: 'Securitatea Informațională', abbreviation: 'SI' },
];

describe('parseGroupName', () => {
  it.each([
    ['TI-241', { abbreviation: 'TI', admissionYY: 24, index: 1 }],
    ['ti-252', { abbreviation: 'TI', admissionYY: 25, index: 2 }],
    ['SI 243', { abbreviation: 'SI', admissionYY: 24, index: 3 }],
    ['CR-2411', { abbreviation: 'CR', admissionYY: 24, index: 11 }],
    ['IA-241FR', { abbreviation: 'IA', admissionYY: 24, index: 1 }],
  ])('%s', (name, expected) => {
    expect(parseGroupName(name)).toEqual(expected);
  });

  it('returns null for names without the pattern', () => {
    expect(parseGroupName('Grupa A')).toBeNull();
    expect(parseGroupName('')).toBeNull();
  });
});

describe('study year', () => {
  it('derives the study year from the academic year', () => {
    expect(academicStartYear('2026/2027')).toBe(2026);
    expect(studyYearFromAdmission(26, '2026/2027')).toBe(1);
    expect(studyYearFromAdmission(25, '2026/2027')).toBe(2);
    expect(studyYearFromAdmission(24, '2026/2027')).toBe(3);
    expect(studyYearFromAdmission(24, '2025/2026')).toBe(2);
  });

  it('clamps nonsense to 1..8', () => {
    expect(studyYearFromAdmission(27, '2026/2027')).toBe(1);
    expect(studyYearFromAdmission(10, '2026/2027')).toBe(8);
  });

  it('inverts to the admission year', () => {
    expect(admissionYYForStudyYear(1, '2026/2027')).toBe(26);
    expect(admissionYYForStudyYear(2, '2026/2027')).toBe(25);
  });
});

describe('detectGroup', () => {
  it('maps the abbreviation to a known program and year', () => {
    const d = detectGroup('TI-251', programs, '2026/2027');
    expect(d?.program?.id).toBe('p_ti');
    expect(d?.year).toBe(2);
  });

  it('reports unknown programs by abbreviation', () => {
    const d = detectGroup('RM-261', programs, '2026/2027');
    expect(d?.program).toBeNull();
    expect(d?.abbreviation).toBe('RM');
    expect(d?.year).toBe(1);
  });
});

describe('nextGroupNames', () => {
  it('generates UTM-style names for a study year', () => {
    expect(nextGroupNames('TI', 1, 4, '2025/2026', [])).toEqual(['TI-251', 'TI-252', 'TI-253', 'TI-254']);
  });

  it('skips names that already exist', () => {
    expect(nextGroupNames('ti', 1, 2, '2026/2027', ['TI-261'])).toEqual(['TI-262', 'TI-263']);
  });
});

describe('suggestAbbreviation', () => {
  it.each([
    ['Tehnologia Informației', 'TI'],
    ['Securitatea Informațională', 'SI'],
    ['Știința și Ingineria Calculatoarelor', 'SIC'],
    ['Robotică', 'RO'],
    ['', ''],
  ])('%s → %s', (name, abbr) => {
    expect(suggestAbbreviation(name)).toBe(abbr);
  });
});
