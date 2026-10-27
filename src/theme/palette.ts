/**
 * Colour tokens of the approved design (design-mobile/screens/taskly.css), same names as the CSS variables.
 * Never write a hex colour outside src/theme: screens and components read these tokens.
 */
export const lightPalette = {
  bg: '#FFFFFF',
  bg2: '#FAF9F7',
  side: '#F5F3EF',
  line: '#E7E4DE',
  line2: '#CFCBC3',
  ink: '#1F2328',
  ink2: '#4F555D',
  mute: '#646A72',
  acc: '#0F766E',
  acc2: '#0B5F58',
  soft: '#E2F1EF',
  onacc: '#FFFFFF',
  p1: '#C2362B',
  p1s: '#FCEAE8',
  p2: '#B45309',
  p2s: '#FDF0DC',
  p3: '#1D5FD0',
  p3s: '#E6EEFB',
  p4: '#6B7078',
  ok: '#1E7A3F',
  warn: '#B3261E',
  vio: '#6B3FA0',
  tog: '#80868E',
  /** White text on the danger button (.btn.dng). */
  onwarn: '#FFFFFF',
  /** .scrim and the lighter backdrop behind dialogs (M-Confirm). */
  scrim: 'rgba(20, 22, 25, 0.5)',
  scrimLight: 'rgba(20, 22, 25, 0.35)',
  /** Undo toast of M-Empty: dark surface, light accent. */
  toastBg: '#1F2328',
  toastText: '#FFFFFF',
  toastAccent: '#7FD3C9',
  /** Toggle knob. */
  knob: '#FFFFFF',
};

export type Palette = { [K in keyof typeof lightPalette]: string };

/** .dark of taskly.css — not drawn on mobile yet; M3 switches to it with the appearance setting. */
export const darkPalette: Palette = {
  bg: '#171A1D',
  bg2: '#1E2226',
  side: '#1E2226',
  line: '#2D3238',
  line2: '#454B53',
  ink: '#ECEEF0',
  ink2: '#B4BAC1',
  mute: '#9AA1A9',
  acc: '#4FB8AD',
  acc2: '#7FD3C9',
  soft: '#1D3A37',
  onacc: '#0B1F1D',
  p1: '#F0766C',
  p1s: '#3A2220',
  p2: '#E3A04A',
  p2s: '#3A2E1B',
  p3: '#6FA2F2',
  p3s: '#1F2E47',
  p4: '#9AA1A9',
  ok: '#5DC57E',
  warn: '#F07A72',
  vio: '#B794F0',
  tog: '#6B727A',
  onwarn: '#FFFFFF',
  scrim: 'rgba(0, 0, 0, 0.6)',
  scrimLight: 'rgba(0, 0, 0, 0.45)',
  toastBg: '#ECEEF0',
  toastText: '#171A1D',
  toastAccent: '#0F766E',
  knob: '#FFFFFF',
};

/** M1 only draws the light base theme "TASKLY". */
export const palette: Palette = lightPalette;

/** Avatar backgrounds (white initials), picked by a stable hash of the user id. */
export const AVATAR_COLORS = ['#0F766E', '#7C3AED', '#B45309', '#1D5FD0', '#BE185D'] as const;

/**
 * Taskly's own hex values for the 20 colour keys shared by projects, labels and filters (spec 10.1). Six keys reuse the
 * design's project colours (teal, orange, violet, blue, magenta, charcoal); the rest are Taskly's choice, all dark
 * enough for a coloured "#" icon on white.
 */
export const PROJECT_PALETTE = {
  berry_red: '#A3274F',
  red: '#C2362B',
  orange: '#B45309',
  yellow: '#A47E06',
  olive_green: '#6F7A1F',
  lime_green: '#4F8A22',
  green: '#1E7A3F',
  mint_green: '#2E8B78',
  teal: '#0F766E',
  sky_blue: '#1678A8',
  light_blue: '#4A7FBF',
  blue: '#1D5FD0',
  grape: '#5B3FB8',
  violet: '#7C3AED',
  lavender: '#8B5FB8',
  magenta: '#BE185D',
  salmon: '#C25548',
  charcoal: '#4F555D',
  grey: '#7A8088',
  taupe: '#806F60',
} as const;
