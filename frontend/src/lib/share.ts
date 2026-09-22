/** Public, read-only link for an institution's published timetable. */
export function publicLink(token: string, origin: string = window.location.origin): string {
  return `${origin}/p/${encodeURIComponent(token)}`;
}
