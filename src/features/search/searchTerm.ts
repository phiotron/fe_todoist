/** Spec 5.9: a search keyword is at most 100 characters. */
export const SEARCH_MAX_LENGTH = 100;

/** Spec 9.3: search ~300 ms after the user stops typing. */
export const SEARCH_DEBOUNCE_MS = 300;

export type SearchTermCheck =
  | { kind: 'empty' }
  | { kind: 'tooLong'; length: number }
  | { kind: 'ok'; term: string };

/**
 * Mirrors the server rules before any request: the term is trimmed, an empty term never reaches the API,
 * and more than 100 UTF-16 units (Java String.length, same as JS .length) would be a 400.
 */
export function checkSearchTerm(raw: string): SearchTermCheck {
  const term = raw.trim();
  if (term.length === 0) return { kind: 'empty' };
  if (term.length > SEARCH_MAX_LENGTH) return { kind: 'tooLong', length: term.length };
  return { kind: 'ok', term };
}
