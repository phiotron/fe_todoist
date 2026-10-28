import type { QueryClient } from '@tanstack/react-query';
import { invalidateData } from '../../api/queryKeys';
import type { ServerChange } from './engine';

/**
 * Query roots (subset of DATA_ROOTS) that can show each resource of POST sync — `changes` keys and `deleted` types.
 * PERF: a sync used to invalidate EVERY data root (productivity, activity, insights, templates... all refetched) even
 * when the server only reported one label. Generous on purpose: a missed root would show stale data.
 */
const TASK_ROOTS = ['tasks', 'projects', 'favorites', 'search', 'productivity', 'activity', 'insights', 'workspaces'];
const PROJECT_ROOTS = ['projects', 'tasks', 'sections', 'favorites', 'search', 'activity', 'insights', 'workspaces', 'sharing'];
const SECTION_ROOTS = ['sections', 'tasks', 'activity'];
const LABEL_ROOTS = ['labels', 'favorites', 'tasks', 'search'];
const FILTER_ROOTS = ['filters', 'favorites', 'tasks'];

const ROOTS_BY_RESOURCE: Readonly<Record<string, readonly string[]>> = {
  tasks: TASK_ROOTS,
  TASK: TASK_ROOTS,
  projects: PROJECT_ROOTS,
  PROJECT: PROJECT_ROOTS,
  sections: SECTION_ROOTS,
  SECTION: SECTION_ROOTS,
  labels: LABEL_ROOTS,
  LABEL: LABEL_ROOTS,
  filters: FILTER_ROOTS,
  FILTER: FILTER_ROOTS,
};

/** Resources whose change can move a task's due date / reminders or remove the task. */
const REMINDER_RESOURCES: ReadonlySet<string> = new Set(['tasks', 'TASK', 'projects', 'PROJECT', 'sections', 'SECTION']);

/** The roots to refresh after a sync, or 'all' (unknown resource / the server state cannot be narrowed). */
export function rootsToRefresh(change: ServerChange): ReadonlySet<string> | 'all' {
  if (change.everything) return 'all';
  const roots = new Set<string>();
  for (const resource of change.resources) {
    const mapped = ROOTS_BY_RESOURCE[resource];
    if (!mapped) return 'all'; // a resource type of a later milestone: be safe
    mapped.forEach((root) => roots.add(root));
  }
  return roots;
}

export function invalidateAfterSync(queryClient: QueryClient, change: ServerChange): Promise<void> {
  const roots = rootsToRefresh(change);
  if (roots === 'all') return invalidateData(queryClient);
  if (roots.size === 0) return Promise.resolve();
  return queryClient.invalidateQueries({ predicate: (query) => roots.has(String(query.queryKey[0])) });
}

/** true when the device reminder schedule may be out of date after this sync. */
export function remindersAffected(change: ServerChange): boolean {
  return change.everything || change.resources.some((resource) => REMINDER_RESOURCES.has(resource));
}
