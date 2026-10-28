import type { ProductivityResponse } from '../../api/productivity';

export interface GoalState {
  today: string;
  weekStart: string;
  dailyReached: boolean;
  weeklyReached: boolean;
}

export function goalStateOf(data: ProductivityResponse): GoalState {
  return {
    today: data.today,
    weekStart: data.weekly.weekStart,
    dailyReached: data.daily.reached,
    weeklyReached: data.weekly.reached,
  };
}

/**
 * Which goals were reached SINCE the previous answer (same day / same week, was not reached, is reached now): only
 * those get a celebration. The first answer of a session (previous = null) never celebrates, and neither does a new
 * day / week that starts already reached (e.g. a lowered goal).
 */
export function newlyReached(previous: GoalState | null, next: GoalState): { daily: boolean; weekly: boolean } {
  if (!previous) return { daily: false, weekly: false };
  return {
    daily: previous.today === next.today && !previous.dailyReached && next.dailyReached,
    weekly: previous.weekStart === next.weekStart && !previous.weeklyReached && next.weeklyReached,
  };
}
