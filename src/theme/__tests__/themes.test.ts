import { darkPalette, lightPalette, type Palette } from '../palette';
import { PALETTES, legacyColorsOf, paletteFor } from '../themes';
import { THEME_NAMES } from '../themeNames';

const COLOR_VALUE = /^(#[0-9A-F]{6}|rgba\(\d+, \d+, \d+, (0|1|0?\.\d+)\))$/;
const ACCENT_KEYS: (keyof Palette)[] = ['acc', 'acc2', 'soft', 'onacc', 'toastAccent'];

function withoutAccent(palette: Palette): Partial<Palette> {
  const rest: Partial<Palette> = { ...palette };
  for (const key of ACCENT_KEYS) delete rest[key];
  return rest;
}

describe('7 named themes on the design tokens', () => {
  it('TASKLY is exactly the approved design (M1 light / dark palettes)', () => {
    expect(PALETTES.TASKLY.light).toBe(lightPalette);
    expect(PALETTES.TASKLY.dark).toBe(darkPalette);
    expect(lightPalette.acc).toBe('#0F766E');
  });

  it('every theme has every token, written as #RRGGBB or rgba()', () => {
    for (const theme of THEME_NAMES) {
      for (const palette of [PALETTES[theme].light, PALETTES[theme].dark]) {
        expect(Object.keys(palette).sort()).toEqual(Object.keys(lightPalette).sort());
        for (const value of Object.values(palette)) expect(value).toMatch(COLOR_VALUE);
      }
    }
  });

  it('the other themes change only the accent; priorities and surfaces stay the design ones', () => {
    for (const theme of THEME_NAMES) {
      expect(withoutAccent(PALETTES[theme].light)).toEqual(withoutAccent(lightPalette));
      expect(withoutAccent(PALETTES[theme].dark)).toEqual(withoutAccent(darkPalette));
    }
    expect(new Set(THEME_NAMES.map((theme) => PALETTES[theme].light.acc)).size).toBe(7);
    expect(new Set(THEME_NAMES.map((theme) => PALETTES[theme].dark.acc)).size).toBe(7);
  });

  it('the Undo toast accent follows the TASKLY rule in every theme', () => {
    for (const theme of THEME_NAMES) {
      expect(PALETTES[theme].light.toastAccent).toBe(PALETTES[theme].dark.acc2);
      expect(PALETTES[theme].dark.toastAccent).toBe(PALETTES[theme].light.acc);
    }
  });

  it('paletteFor returns the palette of a theme and scheme', () => {
    expect(paletteFor('BLUEBERRY', 'dark')).toBe(PALETTES.BLUEBERRY.dark);
    expect(paletteFor('TASKLY', 'light')).toBe(lightPalette);
  });

  it('legacyColorsOf maps the names M4 / M5 use onto the design tokens', () => {
    expect(legacyColorsOf(PALETTES.KALE.dark)).toEqual({
      primary: PALETTES.KALE.dark.acc,
      onPrimary: PALETTES.KALE.dark.onacc,
      text: darkPalette.ink,
      muted: darkPalette.mute,
      danger: darkPalette.warn,
      border: darkPalette.line2,
      background: darkPalette.bg,
      surface: darkPalette.bg2,
      overlay: darkPalette.scrim,
    });
  });
});
