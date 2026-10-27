import type { TextStyle } from 'react-native';

/** Figtree families as registered by useFonts (src/app/_layout.tsx). One family per weight: no fontWeight on Android. */
export const fonts = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
} as const;

type TextToken = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'> & { fontFamily: string };

/** Text roles of design README section 2 ("Chữ"). */
export const type = {
  /** Screen title (Today, Inbox…): 26/700, -0.01em. */
  screenTitle: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.26 },
  /** Title of a pushed screen's top bar: 20/700. */
  barTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  /** Browse title: 22/700. */
  browseTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  /** Task name in the detail screen: 22/700. */
  detailTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  /** Empty / error state title: 20/700. */
  stateTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  dialogTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  /** Task name typed in Quick Add: 18/600. */
  composerTitle: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  /** Task name in a list: 16/500. */
  taskTitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  /** Sub-task name in the detail screen: 15/500. */
  subtaskTitle: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  /** Description text in the detail screen: 14. */
  bodySmall: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  /** Meta line: dates, project, counts. */
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  metaStrong: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  /** Form label (.lab): 13/600. */
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  /** Section header (.sec): 14/700. */
  section: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
  /** Bottom tab label: 11/600. */
  tab: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
  button: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  buttonSmall: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  chip: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  menuItem: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 18 },
} satisfies Record<string, TextToken>;
