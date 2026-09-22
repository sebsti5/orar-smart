/** "3-611" → building "3"; "B-204" → "B". Empty when there's no prefix. */
export function buildingFromRoomName(name: string): string {
  const m = /^\s*([A-Za-z0-9]{1,4})\s*-\s*\d/.exec(name);
  return m ? m[1] : '';
}
