import {
  FILTER_NAME_MAX,
  FILTER_QUERY_MAX,
  checkFilterName,
  checkFilterQuery,
  syntaxErrorExcerpt,
} from '../filterRules';

describe('filter rules (spec 5.9)', () => {
  it('uses the spec limits', () => {
    expect(FILTER_NAME_MAX).toBe(120);
    expect(FILTER_QUERY_MAX).toBe(1024);
  });

  it('checks the name after trimming', () => {
    expect(checkFilterName(' Gấp ')).toBeNull();
    expect(checkFilterName('  ')).toBe('required');
    expect(checkFilterName('a'.repeat(120))).toBeNull();
    expect(checkFilterName('a'.repeat(121))).toBe('tooLong');
  });

  it('checks the query after trimming', () => {
    expect(checkFilterQuery(' today | overdue ')).toBeNull();
    expect(checkFilterQuery('')).toBe('required');
    expect(checkFilterQuery('a'.repeat(1024))).toBeNull();
    expect(checkFilterQuery('a'.repeat(1025))).toBe('tooLong');
  });

  it('counts code points like the server', () => {
    expect(checkFilterName('😀'.repeat(120))).toBeNull();
    expect(checkFilterName('😀'.repeat(121))).toBe('tooLong');
    expect(checkFilterQuery('😀'.repeat(1024))).toBeNull();
    expect(checkFilterQuery('😀'.repeat(1025))).toBe('tooLong');
  });

  it('cuts at most 12 characters from the error position, with an ellipsis when more follow', () => {
    expect(syntaxErrorExcerpt('p1 & & today', 5)).toBe('& today');
    expect(syntaxErrorExcerpt('a & ' + 'b'.repeat(20), 2)).toBe(`& ${'b'.repeat(10)}…`);
    expect(syntaxErrorExcerpt('today', 5)).toBe('');
  });
});
