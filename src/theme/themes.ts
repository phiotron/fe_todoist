import { darkPalette, lightPalette, type Palette } from './palette';
import { THEME_NAMES, type ColorScheme, type ThemeName } from './themeNames';

type Accent = Pick<Palette, 'acc' | 'acc2' | 'soft' | 'onacc'>;

/** Accent of the six other named themes (spec 9.3). Taskly's own colours, never Todoist's. */
const OTHER_ACCENTS: Record<Exclude<ThemeName, 'TASKLY'>, Record<ColorScheme, Accent>> = {
  MOONSTONE: {
    light: { acc: '#4F5D6E', acc2: '#3B4756', soft: '#E8ECF0', onacc: '#FFFFFF' },
    dark: { acc: '#A3B1C2', acc2: '#C9D3DE', soft: '#2A323B', onacc: '#14181D' },
  },
  TANGERINE: {
    light: { acc: '#C2410C', acc2: '#9A3412', soft: '#FDEBDD', onacc: '#FFFFFF' },
    dark: { acc: '#F59E4C', acc2: '#FBC48C', soft: '#3D2A18', onacc: '#2A1606' },
  },
  KALE: {
    light: { acc: '#2E7D32', acc2: '#1F5F23', soft: '#E3F1E4', onacc: '#FFFFFF' },
    dark: { acc: '#72C276', acc2: '#A5DCA8', soft: '#1E3520', onacc: '#0F2410' },
  },
  BLUEBERRY: {
    light: { acc: '#2453C7', acc2: '#1B3F99', soft: '#E4EBFA', onacc: '#FFFFFF' },
    dark: { acc: '#7FA6FF', acc2: '#B0C8FF', soft: '#1C2A47', onacc: '#0D1A33' },
  },
  LAVENDER: {
    light: { acc: '#6D45C2', acc2: '#53329A', soft: '#EEE8FA', onacc: '#FFFFFF' },
    dark: { acc: '#B9A2FF', acc2: '#D6C9FF', soft: '#2D2445', onacc: '#1E1433' },
  },
  RASPBERRY: {
    light: { acc: '#BE185D', acc2: '#9D174D', soft: '#FBE4EE', onacc: '#FFFFFF' },
    dark: { acc: '#F27BAA', acc2: '#F8A9C8', soft: '#47202F', onacc: '#330B1C' },
  },
};

function buildPalettes(): Record<ThemeName, Record<ColorScheme, Palette>> {
  // TASKLY is the approved design itself (M1 tokens), not a copy.
  const palettes = { TASKLY: { light: lightPalette, dark: darkPalette } } as Record<ThemeName, Record<ColorScheme, Palette>>;
  for (const theme of THEME_NAMES) {
    if (theme === 'TASKLY') continue;
    const accent = OTHER_ACCENTS[theme];
    palettes[theme] = {
      // Same rule as TASKLY: the light toast uses the dark accent text, the dark toast the light accent.
      light: { ...lightPalette, ...accent.light, toastAccent: accent.dark.acc2 },
      dark: { ...darkPalette, ...accent.dark, toastAccent: accent.light.acc },
    };
  }
  return palettes;
}

/** Built once: the same object for a theme + scheme, so memoised styles stay stable. */
export const PALETTES: Record<ThemeName, Record<ColorScheme, Palette>> = buildPalettes();

export function paletteFor(theme: ThemeName, scheme: ColorScheme): Palette {
  return PALETTES[theme][scheme];
}

/**
 * Names the M4 / M5 plans were written against (`useTheme().colors.primary`…) mapped onto the design tokens. Kept as
 * an alias so their components work unchanged; new code reads `palette` (design names) instead.
 */
export interface LegacyColors {
  primary: string;
  onPrimary: string;
  text: string;
  muted: string;
  danger: string;
  border: string;
  background: string;
  surface: string;
  overlay: string;
}

export function legacyColorsOf(palette: Palette): LegacyColors {
  return {
    primary: palette.acc,
    onPrimary: palette.onacc,
    text: palette.ink,
    muted: palette.mute,
    danger: palette.warn,
    border: palette.line2,
    background: palette.bg,
    surface: palette.bg2,
    overlay: palette.scrim,
  };
}
