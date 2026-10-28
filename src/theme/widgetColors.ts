import { darkPalette, lightPalette } from './palette';

/**
 * Colours of the home-screen widgets (M12), taken from the same tokens as the app. The widget library draws native
 * views, so it needs plain #RRGGBB strings (one set for light, one for dark).
 */
export interface WidgetColors {
  bg: string;
  ink: string;
  mute: string;
  acc: string;
  onacc: string;
  line: string;
}

function pick(palette: typeof lightPalette): WidgetColors {
  return { bg: palette.bg, ink: palette.ink, mute: palette.mute, acc: palette.acc, onacc: palette.onacc, line: palette.line };
}

export const widgetColors = { light: pick(lightPalette), dark: pick(darkPalette) };
