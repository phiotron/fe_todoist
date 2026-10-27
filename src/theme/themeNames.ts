/** Names of the 7 colour themes (spec 9.3) and of the appearance modes. Colours live in themes.ts (Task 8). */
export type ThemeName = 'TASKLY' | 'MOONSTONE' | 'TANGERINE' | 'KALE' | 'BLUEBERRY' | 'LAVENDER' | 'RASPBERRY';
export type Appearance = 'AUTO' | 'LIGHT' | 'DARK';
export type ColorScheme = 'light' | 'dark';

export const THEME_NAMES: readonly ThemeName[] = [
  'TASKLY',
  'MOONSTONE',
  'TANGERINE',
  'KALE',
  'BLUEBERRY',
  'LAVENDER',
  'RASPBERRY',
];
export const APPEARANCES: readonly Appearance[] = ['AUTO', 'LIGHT', 'DARK'];
export const DEFAULT_THEME: ThemeName = 'TASKLY';
export const DEFAULT_APPEARANCE: Appearance = 'AUTO';

/** AUTO follows the OS; anything the OS reports other than "dark" (null, "unspecified") means light. */
export function resolveColorScheme(appearance: Appearance, system: string | null | undefined): ColorScheme {
  if (appearance === 'LIGHT') return 'light';
  if (appearance === 'DARK') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
}
