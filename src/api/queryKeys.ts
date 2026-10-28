import type { QueryClient } from '@tanstack/react-query';
import type { TaskListParams } from './models';

export const queryKeys = {
  tasks: {
    all: ['tasks'] as const,
    list: (params: TaskListParams) => ['tasks', 'list', params] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
    subtasks: (id: string) => ['tasks', 'subtasks', id] as const,
    /** Upcoming = ONE infinite query whose pages are consecutive day windows (spec 12.3), keyed by the day it starts from. */
    upcoming: (from: string) => ['tasks', 'upcoming', from] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: (archived: boolean) => ['projects', 'list', { archived }] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
  },
  sections: {
    all: ['sections'] as const,
    list: (projectId: string) => ['sections', 'list', projectId] as const,
  },
  favorites: {
    all: ['favorites'] as const,
    list: () => ['favorites', 'list'] as const,
  },
  labels: {
    all: ['labels'] as const,
    list: () => ['labels', 'list'] as const,
  },
  filters: {
    all: ['filters'] as const,
    list: () => ['filters', 'list'] as const,
  },
  /** POST filters/validate only parses syntax: cached by query text, never invalidated by writes. */
  filterValidation: (query: string) => ['filterValidation', query] as const,
  search: {
    all: ['search'] as const,
    tasks: (q: string, completed: boolean) => ['search', 'tasks', { q, completed }] as const,
    objects: (q: string) => ['search', 'objects', q] as const,
  },
  viewOptions: {
    all: ['viewOptions'] as const,
    list: () => ['viewOptions', 'list'] as const,
  },
  /** M10: Productivity (Daily / Weekly / Karma), Activity log and project Insights; refreshed by every data write. */
  productivity: {
    all: ['productivity'] as const,
    get: () => ['productivity', 'get'] as const,
  },
  activity: {
    all: ['activity'] as const,
    list: (params: object) => ['activity', 'list', params] as const,
  },
  insights: {
    all: ['insights'] as const,
    project: (projectId: string) => ['insights', 'project', projectId] as const,
  },
};

/** Query roots touched by writes (M2 added 'labels', 'filters', 'search', 'viewOptions'). */
export const DATA_ROOTS: ReadonlySet<string> = new Set([
  'tasks',
  'projects',
  'sections',
  'favorites',
  'labels',
  'filters',
  'search',
  'viewOptions',
  'productivity',
  'activity',
  'insights',
]);

export interface InvalidateOptions {
  /**
   * Leave `tasks.detail` queries alone. For writes that never change a task's `version` (reorder, spec 3.1): the open
   * detail screen must not refetch for nothing. Lists, subtasks, projects, sections and favorites are still refreshed.
   */
  keepDetail?: boolean;
}

/**
 * After any write: mark every data query stale (mounted screens refetch, others on next mount). Simpler and
 * always right compared with patching caches by hand (Undo, archived sections, counts). The one thing patched by hand
 * is the version / completedAt of tasks answered by close / reopen — see `applyTaskChange` (taskCache.ts).
 */
export function invalidateData(queryClient: QueryClient, options: InvalidateOptions = {}): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      if (!DATA_ROOTS.has(String(query.queryKey[0]))) return false;
      return !(options.keepDetail && query.queryKey[0] === 'tasks' && query.queryKey[1] === 'detail');
    },
  });
}
