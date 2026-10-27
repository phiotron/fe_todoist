/** Spec 5.9. Lengths count code points, like the server (`codePointCount` / `char_length`). */
export const FILTER_NAME_MAX = 120;
export const FILTER_QUERY_MAX = 1024;

export type TextRuleProblem = 'required' | 'tooLong';

function checkTrimmed(raw: string, max: number): TextRuleProblem | null {
  const value = raw.trim();
  if (!value) return 'required';
  if (Array.from(value).length > max) return 'tooLong';
  return null;
}

export function checkFilterName(raw: string): TextRuleProblem | null {
  return checkTrimmed(raw, FILTER_NAME_MAX);
}

export function checkFilterQuery(raw: string): TextRuleProblem | null {
  return checkTrimmed(raw, FILTER_QUERY_MAX);
}

const EXCERPT_LENGTH = 12;

/** Up to 12 characters of the query from the error position (… when more follow), for the syntax message. */
export function syntaxErrorExcerpt(query: string, position: number): string {
  const rest = query.slice(position);
  return rest.length > EXCERPT_LENGTH ? `${rest.slice(0, EXCERPT_LENGTH)}…` : rest;
}
