import type { KarmaLevelName, KarmaTrendPoint } from '../../api/productivity';

/** Goals offered by "Edit goal" (backend accepts daily 1–200, weekly 1–1000); the current value is always listed too. */
export const DAILY_GOAL_CHOICES: readonly number[] = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
export const WEEKLY_GOAL_CHOICES: readonly number[] = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200];

export const DEFAULT_DAILY_GOAL = 5;
export const DEFAULT_WEEKLY_GOAL = 30;
/** Saturday + Sunday (backend default, spec contract 2). */
export const DEFAULT_DAYS_OFF: readonly number[] = [6, 7];

/** The choices plus the current value (kept in order) when it is not one of them. */
export function withCurrent(choices: readonly number[], current: number): number[] {
  return choices.includes(current) ? [...choices] : [...choices, current].sort((a, b) => a - b);
}

/** 0..1 fill of a progress bar. */
export function progressRatio(done: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(1, Math.max(0, done / goal));
}

/** Tasks still missing to reach the goal (0 when reached). */
export function remaining(done: number, goal: number): number {
  return Math.max(0, goal - done);
}

/** 0..1 height of every bar; the tallest value (or `floor`, e.g. the goal) is a full bar. */
export function barRatios(values: readonly number[], floor = 1): number[] {
  const max = Math.max(floor, ...values, 1);
  return values.map((value) => Math.max(0, value) / max);
}

/** Trend points → 0..1 heights between the lowest and the highest karma of the window (flat window → half height). */
export function trendRatios(points: readonly KarmaTrendPoint[]): number[] {
  if (points.length === 0) return [];
  const values = points.map((point) => point.karma);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((value) => 0.1 + (0.9 * (value - min)) / (max - min));
}

/** The 8 levels with their thresholds (same as the backend KarmaLevel; GET productivity also sends them). */
export const KARMA_LEVELS: readonly { level: KarmaLevelName; minKarma: number }[] = [
  { level: 'BEGINNER', minKarma: 0 },
  { level: 'NOVICE', minKarma: 500 },
  { level: 'INTERMEDIATE', minKarma: 2500 },
  { level: 'PROFESSIONAL', minKarma: 5000 },
  { level: 'EXPERT', minKarma: 7500 },
  { level: 'MASTER', minKarma: 10000 },
  { level: 'GRAND_MASTER', minKarma: 20000 },
  { level: 'ENLIGHTENED', minKarma: 50000 },
];

export function isKarmaLevel(value: string): value is KarmaLevelName {
  return [
    'BEGINNER',
    'NOVICE',
    'INTERMEDIATE',
    'PROFESSIONAL',
    'EXPERT',
    'MASTER',
    'GRAND_MASTER',
    'ENLIGHTENED',
  ].includes(value);
}
