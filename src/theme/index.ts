import { gutter, layout, radius, shadow, size, space } from './metrics';
import { palette, type Palette } from './palette';
import { type } from './typography';

export { AVATAR_COLORS, PROJECT_PALETTE, darkPalette, lightPalette, palette, type Palette } from './palette';
export { fonts, type } from './typography';
export { gutter, layout, radius, shadow, size, space } from './metrics';

export interface Theme {
  palette: Palette;
  type: typeof type;
  space: typeof space;
  gutter: typeof gutter;
  radius: typeof radius;
  size: typeof size;
  layout: typeof layout;
  shadow: typeof shadow;
}

const LIGHT: Theme = { palette, type, space, gutter, radius, size, layout, shadow };

/**
 * The active theme. M1: always the light base theme "TASKLY". M3 replaces the body (7 named themes × automatic /
 * light / dark from me/settings) and keeps the signature.
 */
export function useTheme(): Theme {
  return LIGHT;
}
