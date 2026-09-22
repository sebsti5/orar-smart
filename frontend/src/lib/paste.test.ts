import { describe, expect, it } from 'vitest';
import { isTabular, looksLikeHeader, parseNumber, parseTable } from './paste';

describe('parseTable', () => {
  it('parses Excel TSV with CRLF and trailing newline', () => {
    expect(parseTable('TI-251\t25\r\nTI-252\t24\r\n')).toEqual([
      ['TI-251', '25'],
      ['TI-252', '24'],
    ]);
  });

  it('keeps quoted cells with tabs, newlines and escaped quotes', () => {
    const text = '"Analiza\nmatematică"\t"a ""b"""\t2\nFizica\t\t1';
    expect(parseTable(text)).toEqual([
      ['Analiza\nmatematică', 'a "b"', '2'],
      ['Fizica', '', '1'],
    ]);
  });

  it('falls back to ; and , separated text', () => {
    expect(parseTable('a;b\nc;d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parseTable('a,b')).toEqual([['a', 'b']]);
  });

  it('drops fully empty lines and trims cells', () => {
    expect(parseTable(' x \t y \n\n\t\n z ')).toEqual([['x', 'y'], ['z']]);
  });
});

describe('helpers', () => {
  it('detects tabular clipboard content', () => {
    expect(isTabular('TI-251')).toBe(false);
    expect(isTabular('TI-251\n')).toBe(false);
    expect(isTabular('a\tb')).toBe(true);
    expect(isTabular('a\nb')).toBe(true);
  });

  it('parses Romanian decimals', () => {
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber(' 2 ')).toBe(2);
    expect(parseNumber('')).toBeNaN();
    expect(parseNumber('abc')).toBeNaN();
  });

  it('recognises a header row', () => {
    expect(looksLikeHeader([['Grupa', 'Studenți'], ['TI-251', '25']])).toBe(true);
    expect(looksLikeHeader([['TI-251', '25'], ['TI-252', '24']])).toBe(false);
  });
});
