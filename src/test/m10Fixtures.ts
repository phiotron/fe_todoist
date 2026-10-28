import type { ActivityItem } from '../api/activity';
import type { ProductivityResponse, ProjectInsightsResponse } from '../api/productivity';
import { KARMA_LEVELS } from '../features/productivity/productivityModel';

/** Thursday 12 Nov 2026 in the test account zone (Asia/Ho_Chi_Minh), like the backend ProductivityApiTest. */
export const M10_TODAY = '2026-11-12';

function addDay(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** A productivity answer: 2 of 5 today, streak 1, 12 of 30 this week, 223 Karma (Beginner, 277 left to Novice). */
export function productivity(overrides: Partial<ProductivityResponse> = {}): ProductivityResponse {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDay(M10_TODAY, i - 6);
    return { date, completed: i === 6 ? 2 : i === 5 ? 5 : 0, dayOff: i === 1 || i === 2, vacation: false };
  });
  const weekStart = '2026-11-09';
  return {
    today: M10_TODAY,
    dailyGoal: 5,
    weeklyGoal: 30,
    daysOff: [6, 7],
    vacationMode: false,
    karmaEnabled: true,
    goalCelebrations: true,
    daily: { completed: 2, goal: 5, reached: false, currentStreak: 1, longestStreak: 4, days },
    weekly: {
      completed: 12,
      goal: 30,
      reached: false,
      currentStreak: 0,
      longestStreak: 2,
      weekStart,
      weeks: [-21, -14, -7, 0].map((delta) => ({ weekStart: addDay(weekStart, delta), completed: delta === 0 ? 12 : 31 })),
    },
    karma: {
      karma: 223,
      level: 'BEGINNER',
      nextLevel: 'NOVICE',
      nextLevelKarma: 500,
      pointsToNextLevel: 277,
      trend: Array.from({ length: 28 }, (_, i) => ({ date: addDay(M10_TODAY, i - 27), karma: 100 + i * 5 })),
      levels: KARMA_LEVELS.map((entry) => ({ ...entry })),
    },
    ...overrides,
  };
}

export function insights(overrides: Partial<ProjectInsightsResponse> = {}): ProjectInsightsResponse {
  return {
    projectId: 'p-1',
    totalTasks: 6,
    completedTasks: 4,
    activeTasks: 2,
    overdueTasks: 1,
    progressPercent: 66,
    completedByDay: Array.from({ length: 14 }, (_, i) => ({ date: addDay(M10_TODAY, i - 13), count: i === 13 ? 2 : i === 11 ? 1 : 0 })),
    ...overrides,
  };
}

export function activityItem(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: 'a-1',
    objectType: 'TASK',
    objectId: 't-1',
    eventType: 'ADDED',
    projectId: 'p-1',
    objectName: 'Viết báo cáo',
    projectName: 'Công việc',
    initiatorId: 'u-1',
    createdAt: '2026-11-12T03:00:00Z',
    ...overrides,
  };
}
