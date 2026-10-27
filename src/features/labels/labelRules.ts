/** Spec 5.9 / 2.1. Mirrors the backend `LabelNames` (NFC, trim, 1–60 code points, forbidden characters). */
export const LABEL_NAME_MAX = 60;
export const LABELS_PER_TASK_MAX = 100;

/**
 * Whitespace and @ % # / , ( ) | & ! \ * belong to the filter syntax, so label names cannot hold them.
 * The whitespace part is the Unicode White_Space property (what Java's `\s` matches with UNICODE_CHARACTER_CLASS),
 * written out because JS `\s` also matches U+FEFF and not U+0085.
 */
const LABEL_NAME_FORBIDDEN = /[\t-\r \u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000@%#/,()|&!\\*]/;

/** Java `String.strip()` (Character.isWhitespace): unlike JS `trim()` it keeps U+00A0 / U+2007 / U+202F at the edges. */
const EDGE_WHITESPACE = '[\\t-\\r\\x1C-\\x1F \u1680\u2000-\u2006\u2008-\u200A\u2028\u2029\u205F\u3000]';
const EDGE_TRIM = new RegExp(`^${EDGE_WHITESPACE}+|${EDGE_WHITESPACE}+$`, 'g');

export type LabelNameProblem = 'required' | 'tooLong' | 'invalidChars';

/** The name as the server stores it: NFC, trimmed at both ends. */
export function normalizeLabelName(raw: string): string {
  return raw.normalize('NFC').replace(EDGE_TRIM, '');
}

export function checkLabelName(raw: string): LabelNameProblem | null {
  const name = normalizeLabelName(raw);
  const length = Array.from(name).length;
  if (length < 1) return 'required';
  if (length > LABEL_NAME_MAX) return 'tooLong';
  if (LABEL_NAME_FORBIDDEN.test(name)) return 'invalidChars';
  return null;
}

/** Label names are unique per account ignoring case (spec 5.9, server `label-name-taken`). */
export function sameLabelName(a: string, b: string): boolean {
  return normalizeLabelName(a).toLowerCase() === normalizeLabelName(b).toLowerCase();
}
