/** Spacing on a 4-point grid (design README section 2). */
export const space = { xxs: 2, xs: 4, s: 8, m: 12, l: 16, xl: 24 } as const;

/** Horizontal content margin of every screen. */
export const gutter = 20;

export const radius = { chip: 8, control: 10, card: 12, dialog: 16, sheet: 20, round: 999 } as const;

/** Sizes: touch targets are never below 44 (a11y). */
export const size = {
  touch: 44,
  input: 48,
  inputSmall: 36,
  button: 44,
  buttonSmall: 32,
  chip: 32,
  chipLarge: 36,
  checkbox: 22,
  checkboxLarge: 26,
  listRow: 52,
  menuRow: 48,
  shortcutRow: 44,
  fab: 56,
  avatarS: 22,
  avatar: 28,
  avatarL: 40,
  avatarXL: 64,
  stateIcon: 96,
  tabItem: 48,
  icon: 20,
  iconSmall: 16,
  iconLarge: 24,
  swatch: 32,
  calendarCell: 44,
  calendarDay: 40,
  weekDay: 36,
} as const;

/** Fixed placements of the design (390×844 frame). */
export const layout = {
  fabRight: 20,
  /** FAB and toast sit 100 above the bottom edge, i.e. above the tab bar. */
  fabBottom: 100,
  toastBottom: 100,
  /** Space under the status bar before a screen title (the design keeps 48 = status bar + 8). */
  headerGap: 8,
  /** Bottom padding of the tab bar (home indicator / gesture area), grown by the real safe area. */
  tabBarBottom: 22,
} as const;

/** "0 8px 28px rgba(31,35,40,.16)" as React Native shadow props (+ Android elevation). */
export const shadow = {
  shadowColor: '#1F2328',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.16,
  shadowRadius: 14,
  elevation: 8,
} as const;
