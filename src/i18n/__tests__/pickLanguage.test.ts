import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, isSupportedLanguage, pickLanguage } from '..';

describe('pickLanguage', () => {
  it('supports Vietnamese (default) and English', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['vi', 'en']);
    expect(DEFAULT_LANGUAGE).toBe('vi');
  });

  it.each([
    [['en'], 'en'],
    [['vi'], 'vi'],
    [['EN-us'], 'en'],
    [['en_GB'], 'en'],
    [['fr', 'en'], 'en'],
    [['fr'], 'vi'],
    [[null, undefined, ''], 'vi'],
    [[], 'vi'],
  ] as [(string | null | undefined)[], string][])('%p → %s', (codes, expected) => {
    expect(pickLanguage(codes)).toBe(expected);
  });

  it('isSupportedLanguage only accepts exact codes', () => {
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('vi')).toBe(true);
    expect(isSupportedLanguage('EN')).toBe(false);
    expect(isSupportedLanguage('fr')).toBe(false);
  });
});
