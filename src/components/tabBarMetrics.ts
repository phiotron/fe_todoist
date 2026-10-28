import { layout, size, space } from '../theme';

/** AppTabBar: top padding over the 48 high items (its bottom padding is max(safe-area inset, layout.tabBarBottom)). */
export const TAB_BAR_PADDING_TOP = 6;
/** AppTabBar: hairline on top of the bar. */
export const TAB_BAR_BORDER = 1;

/** Real height of AppTabBar for a bottom safe-area inset (3-button navigation ≈ 48, gestures ≈ 0–24). */
export function tabBarHeight(insetBottom: number): number {
  return TAB_BAR_PADDING_TOP + size.tabItem + TAB_BAR_BORDER + Math.max(insetBottom, layout.tabBarBottom);
}

/** Gap between the top of the tab bar and the + : the design's 100 over a 77 high bar (390×844 frame). */
export const FAB_TAB_BAR_GAP = layout.fabBottom - tabBarHeight(0);

/** Bottom of the tab layout's + : always FAB_TAB_BAR_GAP above the real tab bar, so a tall navigation bar never covers it. */
export function fabBottomAboveTabBar(insetBottom: number): number {
  return tabBarHeight(insetBottom) + FAB_TAB_BAR_GAP;
}

/**
 * Bottom padding of a scrolling list under a + so its last row can scroll clear of it (+ 12 air). One value fits both
 * places: in a tab the + is FAB_TAB_BAR_GAP + 56 above the scene bottom (the scene ends at the tab bar); on a pushed
 * screen it is layout.fabBottom + 56 above the screen bottom.
 */
export const FAB_CLEARANCE = Math.max(layout.fabBottom, FAB_TAB_BAR_GAP) + size.fab + space.m;
