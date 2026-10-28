import type { QuickAddToken } from '../../lib/quickadd';

/**
 * Text interactions of the Quick Add name (spec 3.2 M6b): Backspace right after a highlighted part or a tap inside it
 * turns it back into plain text; pasting several lines asks "one task or one per line".
 */

/** Exactly one character deleted, and it was the last one of a token → that token (caller restores the text). */
export function backspacedToken(before: string, after: string, tokens: readonly QuickAddToken[]): QuickAddToken | null {
  if (after.length !== before.length - 1) return null;
  let first = 0;
  while (first < after.length && before[first] === after[first]) first += 1;
  if (before.slice(first + 1) !== after.slice(first)) return null;
  // With repeated letters ("tmrww") the deleted one can be anywhere in the run: accept any position of the run.
  let last = first;
  while (last + 1 < before.length && before[last + 1] === before[first]) last += 1;
  return tokens.find((token) => token.end - 1 >= first && token.end - 1 <= last) ?? null;
}

/** A tap leaves a caret (no selection): strictly inside a token → that token. */
export function tappedToken(selection: { start: number; end: number }, tokens: readonly QuickAddToken[]): QuickAddToken | null {
  if (selection.start !== selection.end) return null;
  return tokens.find((token) => selection.start > token.start && selection.start < token.end) ?? null;
}

/** Pasted text with at least two non-empty lines → the trimmed lines; otherwise null. */
export function pastedLines(before: string, after: string): string[] | null {
  if (!/[\r\n]/.test(after) || /[\r\n]/.test(before)) return null;
  const lines = after
    .split(/\r?\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length >= 2 ? lines : null;
}

export interface TextSegment {
  text: string;
  highlighted: boolean;
}

/** The text as plain / highlighted runs for the styled TextInput children. */
export function segments(text: string, tokens: readonly QuickAddToken[]): TextSegment[] {
  const result: TextSegment[] = [];
  let cursor = 0;
  for (const token of [...tokens].sort((a, b) => a.start - b.start)) {
    if (token.start > cursor) result.push({ text: text.slice(cursor, token.start), highlighted: false });
    result.push({ text: text.slice(token.start, token.end), highlighted: true });
    cursor = token.end;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor), highlighted: false });
  return result;
}
