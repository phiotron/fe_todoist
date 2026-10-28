import type { SystemAccentColors } from '../lib/native/tasklyAndroid';
import { darkPalette, lightPalette, type Palette } from './palette';
import type { ColorScheme } from './themeNames';

const HEX = /^#[0-9a-fA-F]{6}$/;

function channel(hex: string, from: number): number {
  return parseInt(hex.slice(from, from + 2), 16) / 255;
}

/** WCAG relative luminance of #RRGGBB. */
export function luminance(hex: string): number {
  const linear = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(channel(hex, 1)) + 0.7152 * linear(channel(hex, 3)) + 0.0722 * linear(channel(hex, 5));
}

/** The dark theme's text-on-accent colour on a light accent, the light theme's on a dark one (both are palette tokens). */
export function onColor(background: string): string {
  return luminance(background) > 0.4 ? darkPalette.onacc : lightPalette.onacc;
}

/** Valid colours only: a missing or malformed one means "do not use Dynamic Color". */
export function isUsable(colors: SystemAccentColors | null | undefined): colors is SystemAccentColors {
  return (
    !!colors &&
    [
      colors.accentLight,
      colors.accentLightStrong,
      colors.accentLightSoft,
      colors.accentDark,
      colors.accentDarkStrong,
      colors.accentDarkSoft,
    ].every((value) => HEX.test(value))
  );
}

/**
 * Dynamic Color (Android 12+): the accent family of the palette (acc, acc2, soft, onacc, toastAccent) is taken from the
 * system colours; everything else (text, lines, priorities, danger) keeps the theme's own values so contrast and meaning
 * do not change. Returns the palette unchanged when the colours are missing or malformed.
 */
export function applyDynamicColor(palette: Palette, scheme: ColorScheme, colors: SystemAccentColors | null | undefined): Palette {
  if (!isUsable(colors)) return palette;
  const dark = scheme === 'dark';
  const acc = dark ? colors.accentDark : colors.accentLight;
  return {
    ...palette,
    acc,
    acc2: dark ? colors.accentDarkStrong : colors.accentLightStrong,
    soft: dark ? colors.accentDarkSoft : colors.accentLightSoft,
    onacc: onColor(acc),
    toastAccent: dark ? colors.accentLight : colors.accentDark,
  };
}
