import { useMemo } from 'react';
import type { SwipeAction } from '../settings/settingsModel';
import { useSettingsContext } from '../settings/SettingsProvider';

/** Spec 9.2 swipe actions: one source of truth, the setting values of the account (settingsModel). */
export type { SwipeAction };

export interface SwipeSettings {
  /** Swiping the row to the right. */
  right: SwipeAction;
  /** Swiping the row to the left. */
  left: SwipeAction;
}

export const DEFAULT_SWIPE: SwipeSettings = { right: 'COMPLETE', left: 'SCHEDULE' };

/** Swipe actions of the account (spec 9.2): right defaults to Complete, left to Schedule. */
export function useSwipeSettings(): SwipeSettings {
  const settings = useSettingsContext()?.settings;
  const left = settings?.swipeLeft ?? DEFAULT_SWIPE.left;
  const right = settings?.swipeRight ?? DEFAULT_SWIPE.right;
  return useMemo(() => ({ left, right }), [left, right]);
}

/**
 * ReanimatedSwipeable's onSwipeableOpen tells which action PANEL opened: the left panel shows when the row moves
 * right. If a device shows the opposite, swap the two results here (one place).
 */
export function swipeSide(openedPanel: string): 'left' | 'right' {
  return openedPanel === 'left' ? 'right' : 'left';
}
