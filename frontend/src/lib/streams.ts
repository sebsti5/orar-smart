import type { Group, Program, Stream } from '../types';
import { newId } from './ids';

/** "TI-25 (1–4)" style name for a stream of groups. */
export function streamName(groups: Group[], programs: Program[]): string {
  if (groups.length === 0) return 'Serie nouă';
  const first = groups[0];
  const prog = programs.find((p) => p.id === first.program_id);
  const prefix = prog?.abbreviation ?? first.name.split('-')[0] ?? 'Serie';
  const m = /-(\d{2})/.exec(first.name);
  const yy = m ? m[1] : `an ${first.year}`;
  const idx = groups
    .map((g) => /-\d{2}(\d+)/.exec(g.name)?.[1])
    .filter((x): x is string => !!x)
    .map(Number)
    .sort((a, b) => a - b);
  const range = idx.length >= 2 ? ` (${idx[0]}–${idx[idx.length - 1]})` : '';
  return `${prefix}-${yy}${range}`;
}

/**
 * Suggest one stream per (program, year) with ≥ 2 groups that isn't already
 * covered by an existing stream with the same members.
 */
export function suggestStreams(groups: Group[], programs: Program[], existing: Stream[]): Stream[] {
  const buckets = new Map<string, Group[]>();
  for (const g of groups) {
    const k = `${g.program_id}|${g.year}`;
    buckets.set(k, [...(buckets.get(k) ?? []), g]);
  }
  const existingSigs = new Set(existing.map((s) => [...s.group_ids].sort().join(',')));
  const taken = existing.map((s) => s.id);
  const out: Stream[] = [];
  for (const members of buckets.values()) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name, 'ro', { numeric: true }));
    const ids = sorted.map((g) => g.id);
    if (existingSigs.has([...ids].sort().join(','))) continue;
    const name = streamName(sorted, programs);
    const id = newId('s', name, [...taken, ...out.map((s) => s.id)]);
    out.push({ id, name, group_ids: ids });
  }
  return out;
}

/** Groups that are in no stream (their lectures will be held alone). */
export function groupsWithoutStream(groups: Group[], streams: Stream[]): Group[] {
  const inStream = new Set(streams.flatMap((s) => s.group_ids));
  return groups.filter((g) => !inStream.has(g.id));
}

/** Warning text when a stream mixes programs or years. */
export function streamMixWarning(stream: Stream, groups: Group[]): string | null {
  const members = groups.filter((g) => stream.group_ids.includes(g.id));
  const programsSet = new Set(members.map((g) => g.program_id));
  const years = new Set(members.map((g) => g.year));
  if (years.size > 1) return 'Seria amestecă ani de studiu diferiți.';
  if (programsSet.size > 1) return 'Seria amestecă programe diferite — e în regulă doar dacă au cursuri comune.';
  return null;
}
