import { APPEARANCES, DEFAULT_APPEARANCE, DEFAULT_THEME, THEME_NAMES, resolveColorScheme, type Appearance } from '../themeNames';

describe('theme names', () => {
  it('7 named themes (spec 9.3) and Automatic / Light / Dark', () => {
    expect(THEME_NAMES).toEqual(['TASKLY', 'MOONSTONE', 'TANGERINE', 'KALE', 'BLUEBERRY', 'LAVENDER', 'RASPBERRY']);
    expect(APPEARANCES).toEqual(['AUTO', 'LIGHT', 'DARK']);
    expect(DEFAULT_THEME).toBe('TASKLY');
    expect(DEFAULT_APPEARANCE).toBe('AUTO');
  });

  it.each([
    ['LIGHT', 'dark', 'light'],
    ['DARK', 'light', 'dark'],
    ['AUTO', 'dark', 'dark'],
    ['AUTO', 'light', 'light'],
    ['AUTO', null, 'light'],
    ['AUTO', 'unspecified', 'light'],
  ] as [Appearance, string | null, string][])('%s with OS %s → %s', (appearance, system, expected) => {
    expect(resolveColorScheme(appearance, system)).toBe(expected);
  });
});
