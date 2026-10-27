import { SEARCH_DEBOUNCE_MS, SEARCH_MAX_LENGTH, checkSearchTerm } from '../searchTerm';

describe('checkSearchTerm', () => {
  it('uses the spec limits: 100 characters, 300 ms', () => {
    expect(SEARCH_MAX_LENGTH).toBe(100);
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it('treats empty and whitespace-only input as empty', () => {
    expect(checkSearchTerm('')).toEqual({ kind: 'empty' });
    expect(checkSearchTerm('  \n\t ')).toEqual({ kind: 'empty' });
  });

  it('trims the term', () => {
    expect(checkSearchTerm('  họp nhóm ')).toEqual({ kind: 'ok', term: 'họp nhóm' });
  });

  it('accepts exactly 100 characters after trimming', () => {
    const term = 'a'.repeat(100);
    expect(checkSearchTerm(`   ${term}   `)).toEqual({ kind: 'ok', term });
  });

  it('rejects 101 characters', () => {
    expect(checkSearchTerm('a'.repeat(101))).toEqual({ kind: 'tooLong', length: 101 });
  });

  it('counts UTF-16 units like the server (Java String.length)', () => {
    expect(checkSearchTerm('😀'.repeat(50))).toEqual({ kind: 'ok', term: '😀'.repeat(50) });
    expect(checkSearchTerm('😀'.repeat(51))).toEqual({ kind: 'tooLong', length: 102 });
  });
});
