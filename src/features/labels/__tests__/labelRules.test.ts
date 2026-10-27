import { LABELS_PER_TASK_MAX, LABEL_NAME_MAX, checkLabelName, normalizeLabelName, sameLabelName } from '../labelRules';

describe('label name rules (spec 5.9, mirrors backend LabelNames)', () => {
  it('uses the spec limits', () => {
    expect(LABEL_NAME_MAX).toBe(60);
    expect(LABELS_PER_TASK_MAX).toBe(100);
  });

  it('accepts names after trimming', () => {
    expect(checkLabelName('  gấp ')).toBeNull();
    expect(checkLabelName('việc_nhà-2026')).toBeNull();
    expect(checkLabelName('a'.repeat(60))).toBeNull();
  });

  it('requires a name', () => {
    expect(checkLabelName('')).toBe('required');
    expect(checkLabelName('   ')).toBe('required');
  });

  it('limits the length to 60 characters', () => {
    expect(checkLabelName('a'.repeat(61))).toBe('tooLong');
  });

  it('counts code points, not UTF-16 units', () => {
    expect(checkLabelName('😀'.repeat(60))).toBeNull();
    expect(checkLabelName('😀'.repeat(61))).toBe('tooLong');
  });

  it('counts the NFC form of the name', () => {
    // "ọ" written as o + U+0323 is two code points raw, one after NFC.
    expect(checkLabelName('o\u0323'.repeat(60))).toBeNull();
    expect(checkLabelName('o\u0323'.repeat(61))).toBe('tooLong');
  });

  it('checks the length before the forbidden characters (same order as the server)', () => {
    expect(checkLabelName('@'.repeat(61))).toBe('tooLong');
  });

  it.each([
    'a b',
    'a\tb',
    '@a',
    'a%',
    '#a',
    'a/b',
    'a,b',
    '(a)',
    'a|b',
    'a&b',
    '!a',
    'a\\b',
    'a*',
    'a\u00A0b',
    'a\u3000b',
  ])('rejects %p (whitespace or a filter character)', (name) => {
    expect(checkLabelName(name)).toBe('invalidChars');
  });

  it('does not trim a non-breaking space at the edge: the server rejects it as a forbidden character', () => {
    expect(checkLabelName('a\u00A0')).toBe('invalidChars');
    expect(checkLabelName('\u00A0a')).toBe('invalidChars');
  });

  it('trims the edges like the server (Java strip), including the ideographic space', () => {
    expect(checkLabelName('\u3000gấp\u2003')).toBeNull();
    expect(normalizeLabelName(' \t\n gấp \r')).toBe('gấp');
  });

  it('normalizes to NFC', () => {
    expect(normalizeLabelName('  Ho\u0323p ')).toBe('H\u1ECDp');
  });

  it('compares names ignoring case, outer spaces and Unicode composition', () => {
    expect(sameLabelName(' Gấp', 'gấp ')).toBe(true);
    expect(sameLabelName('gấp', 'gap')).toBe(false);
    expect(sameLabelName('H\u1ECDp', 'ho\u0323p')).toBe(true);
  });
});
