import { apiFetch } from './client';

/**
 * Backend DTO DayCountsResponse (M6b, contract 8.2) — hand-written until the integration step regenerates types.gen.ts.
 * Every day of [from, to] is present (0 = no open task).
 */
export interface DayCountsResponse {
  counts: Record<string, number>;
}

/** The server accepts at most 62 days per request. */
export const DAY_COUNTS_MAX_DAYS = 62;

export const dayCountsApi = {
  get: (from: string, to: string) =>
    apiFetch<DayCountsResponse>(
      `/api/v1/tasks/day-counts?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
};

/** Under ['tasks'] so every task change (which invalidates queryKeys.tasks.all) refreshes the counts. */
export const dayCountsQueryKey = (from: string, to: string) => ['tasks', 'dayCounts', from, to] as const;
