import { applyDynamicColor, isUsable, luminance, onColor } from '../dynamicColor';
import { darkPalette, lightPalette } from '../palette';
import type { SystemAccentColors } from '../../lib/native/tasklyAndroid';

const COLORS: SystemAccentColors = {
  accentLight: '#9C4146',
  accentLightStrong: '#7D2A30',
  accentLightSoft: '#FFDADA',
  accentDark: '#FFB3B4',
  accentDarkStrong: '#FFDADA',
  accentDarkSoft: '#5E1319',
};

describe('Dynamic Color', () => {
  it('replaces only the accent family; text, lines, priorities and danger keep the theme values', () => {
    const light = applyDynamicColor(lightPalette, 'light', COLORS);

    expect(light.acc).toBe(COLORS.accentLight);
    expect(light.acc2).toBe(COLORS.accentLightStrong);
    expect(light.soft).toBe(COLORS.accentLightSoft);
    expect({ ...light, acc: 0, acc2: 0, soft: 0, onacc: 0, toastAccent: 0 }).toEqual({
      ...lightPalette,
      acc: 0,
      acc2: 0,
      soft: 0,
      onacc: 0,
      toastAccent: 0,
    });
  });

  it('uses the dark system accents in the dark scheme', () => {
    const dark = applyDynamicColor(darkPalette, 'dark', COLORS);

    expect(dark.acc).toBe(COLORS.accentDark);
    expect(dark.acc2).toBe(COLORS.accentDarkStrong);
    expect(dark.soft).toBe(COLORS.accentDarkSoft);
    expect(dark.ink).toBe(darkPalette.ink);
  });

  it('keeps text on the accent readable: dark text on a light accent, light text on a dark one', () => {
    expect(onColor('#FFB3B4')).toBe(darkPalette.onacc);
    expect(onColor('#7D2A30')).toBe(lightPalette.onacc);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(luminance('#000000')).toBeCloseTo(0, 5);
  });

  it('leaves the palette alone when the colours are missing or malformed', () => {
    expect(applyDynamicColor(lightPalette, 'light', null)).toBe(lightPalette);
    expect(applyDynamicColor(lightPalette, 'light', undefined)).toBe(lightPalette);
    expect(applyDynamicColor(lightPalette, 'light', { ...COLORS, accentLight: 'red' })).toBe(lightPalette);
    expect(isUsable({ ...COLORS, accentDarkSoft: '#12345' })).toBe(false);
    expect(isUsable(COLORS)).toBe(true);
  });
});
