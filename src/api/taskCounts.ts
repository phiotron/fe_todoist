import { apiFetch } from './client';

/**
 * Backend DTOs LabelTaskCountResponse / FilterTaskCountResponse (FL: GET labels/counts, GET filters/counts) —
 * hand-written until the integration step regenerates types.gen.ts. Open tasks of readable, unarchived projects;
 * one entry per label, one per filter whose query still parses.
 */
export interface LabelTaskCountResponse {
  labelId: string;
  taskCount: number;
}

export interface FilterTaskCountResponse {
  filterId: string;
  taskCount: number;
}

/** Cached as an id → count record (not the raw array, which the offline cache patches treat as a list of rows). */
export interface TaskCounts {
  byId: Record<string, number>;
}

export const taskCountsApi = {
  labels: async (): Promise<TaskCounts> =>
    byId((await apiFetch<LabelTaskCountResponse[]>('/api/v1/labels/counts')).map((row) => [row.labelId, row.taskCount])),
  filters: async (): Promise<TaskCounts> =>
    byId((await apiFetch<FilterTaskCountResponse[]>('/api/v1/filters/counts')).map((row) => [row.filterId, row.taskCount])),
};

function byId(entries: [string, number][]): TaskCounts {
  return { byId: Object.fromEntries(entries) };
}

/** Under ['tasks'] (like day counts) so every task write — and invalidateData after any write — refreshes them. */
export const labelCountsQueryKey = ['tasks', 'labelCounts'] as const;
export const filterCountsQueryKey = ['tasks', 'filterCounts'] as const;
