import { apiFetch } from './client';

/**
 * M10 (hand-written until `npm run gen:api` regenerates types.gen.ts from the backend): names follow the backend DTOs
 * ProductivityResponse, ProjectInsightsResponse. Dates are 'yyyy-MM-dd' in the account time zone.
 */
export type KarmaLevelName =
  | 'BEGINNER'
  | 'NOVICE'
  | 'INTERMEDIATE'
  | 'PROFESSIONAL'
  | 'EXPERT'
  | 'MASTER'
  | 'GRAND_MASTER'
  | 'ENLIGHTENED';

export interface ProductivityDay {
  date: string;
  completed: number;
  dayOff: boolean;
  vacation: boolean;
}

export interface ProductivityDaily {
  completed: number;
  goal: number;
  reached: boolean;
  currentStreak: number;
  longestStreak: number;
  /** 7 days, oldest first; the last one is today. */
  days: ProductivityDay[];
}

export interface ProductivityWeek {
  weekStart: string;
  completed: number;
}

export interface ProductivityWeekly {
  completed: number;
  goal: number;
  reached: boolean;
  currentStreak: number;
  longestStreak: number;
  weekStart: string;
  /** 4 weeks, oldest first; the last one is this week. */
  weeks: ProductivityWeek[];
}

export interface KarmaTrendPoint {
  date: string;
  karma: number;
}

export interface KarmaLevelInfo {
  level: KarmaLevelName;
  minKarma: number;
}

export interface ProductivityKarma {
  karma: number;
  level: KarmaLevelName;
  nextLevel: KarmaLevelName | null;
  nextLevelKarma: number | null;
  pointsToNextLevel: number;
  /** 28 days, oldest first. */
  trend: KarmaTrendPoint[];
  levels: KarmaLevelInfo[];
}

export interface ProductivityResponse {
  today: string;
  dailyGoal: number;
  weeklyGoal: number;
  /** ISO weekdays (1 = Monday … 7 = Sunday). */
  daysOff: number[];
  vacationMode: boolean;
  karmaEnabled: boolean;
  goalCelebrations: boolean;
  daily: ProductivityDaily;
  weekly: ProductivityWeekly;
  /** null when the user turned Karma off. */
  karma: ProductivityKarma | null;
}

export interface InsightsDayCount {
  date: string;
  count: number;
}

export interface ProjectInsightsResponse {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  overdueTasks: number;
  progressPercent: number;
  /** 14 days, oldest first; the last one is today. */
  completedByDay: InsightsDayCount[];
}

export const productivityApi = {
  get: () => apiFetch<ProductivityResponse>('/api/v1/productivity'),
  projectInsights: (projectId: string) =>
    apiFetch<ProjectInsightsResponse>(`/api/v1/projects/${encodeURIComponent(projectId)}/insights`),
};
