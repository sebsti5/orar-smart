/** Short client-generated ids, unique per kind (e.g. "g_ti261", "t_k3f9a"). */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomSuffix(len = 5): string {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Lowercase ASCII slug: diacritics stripped, non-alphanumerics removed. */
export function slug(text: string, max = 12): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, max);
}

/**
 * New id with a prefix. When `hint` is given the id is readable ("g_ti261"),
 * and `taken` is used to avoid collisions.
 */
export function newId(prefix: string, hint = '', taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const base = hint ? `${prefix}_${slug(hint)}` : '';
  if (base && base !== `${prefix}_` && !used.has(base)) return base;
  for (;;) {
    const candidate = `${base || prefix}_${randomSuffix()}`;
    if (!used.has(candidate)) return candidate;
  }
}
