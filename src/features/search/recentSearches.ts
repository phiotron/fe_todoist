/** Spec 3.1: the 5 latest keywords, kept on the device only (spec 9.3). */
export const RECENT_SEARCH_LIMIT = 5;

const sameTerm = (a: string, b: string) => a.toLocaleLowerCase('vi') === b.toLocaleLowerCase('vi');

/** Newest first, no duplicates (ignoring case), at most 5. A blank term leaves the list unchanged. */
export function addRecentSearch(list: readonly string[], raw: string): string[] {
  const term = raw.trim();
  if (!term) return [...list];
  return [term, ...list.filter((item) => !sameTerm(item, term))].slice(0, RECENT_SEARCH_LIMIT);
}

export function removeRecentSearch(list: readonly string[], term: string): string[] {
  return list.filter((item) => item !== term);
}

/** Reads what was stored; anything unexpected (corrupt JSON, other shape) becomes an empty list. */
export function parseRecentSearches(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, RECENT_SEARCH_LIMIT);
  } catch {
    return [];
  }
}

/** One list per account, so another user signing in on this device never sees it. */
export function recentSearchesStorageKey(userId: string): string {
  return `taskly.recentSearches.${userId}`;
}
