import {
  RECENT_SEARCH_LIMIT,
  addRecentSearch,
  parseRecentSearches,
  recentSearchesStorageKey,
  removeRecentSearch,
} from '../recentSearches';

describe('recent searches (spec 3.1: the last 5 keywords)', () => {
  it('keeps at most 5, newest first', () => {
    expect(RECENT_SEARCH_LIMIT).toBe(5);
    let list: string[] = [];
    for (const term of ['a', 'b', 'c', 'd', 'e', 'f']) list = addRecentSearch(list, term);
    expect(list).toEqual(['f', 'e', 'd', 'c', 'b']);
  });

  it('trims, ignores blanks and moves a repeated term to the front ignoring case', () => {
    expect(addRecentSearch(['b', 'Họp'], '  họp ')).toEqual(['họp', 'b']);
    expect(addRecentSearch(['b'], '   ')).toEqual(['b']);
  });

  it('never mutates the given list', () => {
    const list = ['a'];
    addRecentSearch(list, 'b');
    removeRecentSearch(list, 'a');
    expect(list).toEqual(['a']);
  });

  it('removes one term', () => {
    expect(removeRecentSearch(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('reads the stored JSON defensively', () => {
    expect(parseRecentSearches(null)).toEqual([]);
    expect(parseRecentSearches('not json')).toEqual([]);
    expect(parseRecentSearches('{"a":1}')).toEqual([]);
    expect(parseRecentSearches(JSON.stringify(['a', 3, '', '  ', 'b', 'c', 'd', 'e', 'f']))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('keeps one list per account', () => {
    expect(recentSearchesStorageKey('u-1')).toBe('taskly.recentSearches.u-1');
  });
});
