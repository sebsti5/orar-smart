/**
 * Parse text copied from Excel / Google Sheets / LibreOffice (TSV).
 * Handles CRLF, quoted cells with tabs/newlines and "" escapes, and drops
 * the trailing empty line spreadsheets append. Falls back to ';' or ','
 * separated text when there's no tab at all (CSV pasted from a file).
 */
export function parseTable(text: string): string[][] {
  const src = text.replace(/\r\n?/g, '\n');
  const sep = detectSeparator(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let atCellStart = true;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && atCellStart) {
      quoted = true;
      atCellStart = false;
    } else if (ch === sep) {
      row.push(cell.trim());
      cell = '';
      atCellStart = true;
    } else if (ch === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      atCellStart = true;
    } else {
      cell += ch;
      atCellStart = false;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}

function detectSeparator(src: string): string {
  const firstLine = src.split('\n', 1)[0] ?? '';
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(';')) return ';';
  if (firstLine.includes(',')) return ',';
  return '\t';
}

/** True when the pasted text is more than a single plain value. */
export function isTabular(text: string): boolean {
  return /[\t\n]/.test(text.replace(/\r?\n$/, ''));
}

/** Parse a number the Romanian way too ("1,5" → 1.5). NaN if not a number. */
export function parseNumber(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return Number.NaN;
  return Number(cleaned);
}

/**
 * Detect a header row: returns true if the first row looks like labels
 * (no numeric cell where the second row has one).
 */
export function looksLikeHeader(rows: string[][]): boolean {
  if (rows.length < 2) return false;
  const [head, next] = rows;
  return head.some((h, i) => {
    const n = next[i] ?? '';
    return h !== '' && Number.isNaN(parseNumber(h)) && !Number.isNaN(parseNumber(n));
  });
}
