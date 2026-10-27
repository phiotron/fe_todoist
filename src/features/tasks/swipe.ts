/** Spec 9.2 swipe actions (M3 setting values). M1 handles COMPLETE, SCHEDULE, SELECT and NONE. */
export type SwipeAction = 'COMPLETE' | 'SCHEDULE' | 'DELETE' | 'REMINDERS' | 'SELECT' | 'NONE';

export interface SwipeSettings {
  /** Swiping the row to the right. */
  right: SwipeAction;
  /** Swiping the row to the left. */
  left: SwipeAction;
}

export const DEFAULT_SWIPE: SwipeSettings = { right: 'COMPLETE', left: 'SCHEDULE' };

/** M1: the spec defaults. M3 replaces the body with me/settings swipeRight / swipeLeft (same signature). */
export function useSwipeSettings(): SwipeSettings {
  return DEFAULT_SWIPE;
}

/**
 * ReanimatedSwipeable's onSwipeableOpen tells which action PANEL opened: the left panel shows when the row moves
 * right. If a device shows the opposite, swap the two results here (one place).
 */
export function swipeSide(openedPanel: string): 'left' | 'right' {
  return openedPanel === 'left' ? 'right' : 'left';
}
