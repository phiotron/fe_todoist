import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SystemAccentColors } from '../lib/native/tasklyAndroid';
import { applyDynamicColor } from './dynamicColor';
import { gutter, layout, radius, shadow, size, space } from './metrics';
import { lightPalette, type Palette } from './palette';
import { legacyColorsOf, paletteFor, type LegacyColors } from './themes';
import { DEFAULT_THEME, resolveColorScheme, type Appearance, type ColorScheme, type ThemeName } from './themeNames';
import { type } from './typography';
import { useSystemColorScheme } from './useSystemColorScheme';

export interface Theme {
  /** Named colour theme (spec 9.3). */
  name: ThemeName;
  scheme: ColorScheme;
  palette: Palette;
  /** Alias for the names M4 / M5 use (`colors.primary`, `colors.text`…); see legacyColorsOf. */
  colors: LegacyColors;
  type: typeof type;
  space: typeof space;
  gutter: typeof gutter;
  radius: typeof radius;
  size: typeof size;
  layout: typeof layout;
  shadow: typeof shadow;
}

const STATIC: Pick<Theme, 'type' | 'space' | 'gutter' | 'radius' | 'size' | 'layout' | 'shadow'> = {
  type,
  space,
  gutter,
  radius,
  size,
  layout,
  shadow,
};

// Without a provider (isolated component tests of M1–M5) everything renders with TASKLY light, as in M1.
const ThemeContext = createContext<Theme>({
  ...STATIC,
  name: DEFAULT_THEME,
  scheme: 'light',
  palette: lightPalette,
  colors: legacyColorsOf(lightPalette),
});

interface ThemeProviderProps {
  theme: ThemeName;
  appearance: Appearance;
  /** M12 Dynamic Color: system accent colours (null / absent = the theme's own accent). */
  dynamicColors?: SystemAccentColors | null;
  children: ReactNode;
}

export function ThemeProvider({ theme, appearance, dynamicColors, children }: ThemeProviderProps) {
  const system = useSystemColorScheme();
  const scheme = resolveColorScheme(appearance, system);
  const value = useMemo<Theme>(
    () => {
      const palette = applyDynamicColor(paletteFor(theme, scheme), scheme, dynamicColors);
      return { ...STATIC, name: theme, scheme, palette, colors: legacyColorsOf(palette) };
    },
    [theme, scheme, dynamicColors],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active theme: 7 named themes × automatic / light / dark (spec 9.3). Same signature as M1. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

// One style set per (factory, palette), shared by every component instance: a task row used to run StyleSheet.create
// again for each of its 300 instances (3 factories per row). Keys are weak, so a palette change / inline factory is freed.
const styleCache = new WeakMap<object, WeakMap<object, unknown>>();

/** Pass a module-level factory: a new function on every render would rebuild the styles each time. */
export function useThemedStyles<T>(factory: (palette: Palette) => T): T {
  const { palette } = useTheme();
  return useMemo(() => {
    let byPalette = styleCache.get(factory);
    if (!byPalette) {
      byPalette = new WeakMap();
      styleCache.set(factory, byPalette);
    }
    if (byPalette.has(palette)) return byPalette.get(palette) as T;
    const styles = factory(palette);
    byPalette.set(palette, styles);
    return styles;
  }, [factory, palette]);
}
