import type { QueryClient } from '@tanstack/react-query';
import { invalidateData, type InvalidateOptions } from '../../api/queryKeys';
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
  return invalidateRoots(queryClient, rootsToRefresh(change));
}

/** Marks the queries under `roots` stale (mounted ones refetch); 'all' = invalidateData. keepDetail as in invalidateData. */
export function invalidateRoots(
  queryClient: QueryClient,
  roots: ReadonlySet<string> | 'all',
  options: InvalidateOptions = {},
): Promise<void> {
  if (roots === 'all') return invalidateData(queryClient, options);
  if (roots.size === 0) return Promise.resolve();
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const root = String(query.queryKey[0]);
      if (!roots.has(root)) return false;
      return !(options.keepDetail && root === 'tasks' && query.queryKey[1] === 'detail');
    },
  });
}

/** true when the device reminder schedule may be out of date after this sync. */
export function remindersAffected(change: ServerChange): boolean {
  return change.everything || change.resources.some((resource) => REMINDER_RESOURCES.has(resource));
}

// ---- PERF: the same tables for the REST writes of useDataMutation (it used to invalidate every data root) ----

/** What one write request can change: the query roots to refresh and whether device reminders must be re-planned. */
export interface WriteImpact {
  roots: ReadonlySet<string> | 'all';
  reminders: boolean;
}

const ALL: WriteImpact = { roots: 'all', reminders: true };
const impactOf = (roots: readonly string[], reminders: boolean): WriteImpact => ({ roots: new Set(roots), reminders });
const without = (roots: readonly string[], root: string) => roots.filter((r) => r !== root);

/** A task edit that cannot change completion counts: productivity (goal celebration, widget numbers) is left alone. */
const TASK_EDIT_ROOTS = without(TASK_ROOTS, 'productivity');
const COMMENT_ROOTS = ['tasks', 'projects', 'activity'];
/** Changing these fields of a task leaves its notifications as they are (time, title and existence unchanged). */
const REMINDER_NEUTRAL_TASK_FIELDS: ReadonlySet<string> = new Set(['version', 'description', 'labelIds']);
const REMINDER_FIELD = /^(due|deadline|recurr|remind)/i;
const LABEL_ONLY_BATCH: ReadonlySet<string> = new Set(['ADD_LABELS', 'REMOVE_LABELS']);

function keysOf(body: unknown): string[] {
  return body !== null && typeof body === 'object' ? Object.keys(body) : [];
}

function field(body: unknown, name: string): unknown {
  return body !== null && typeof body === 'object' ? (body as Record<string, unknown>)[name] : undefined;
}

function taskWrite(method: string, rest: string[], body: unknown): WriteImpact {
  const [id, action] = rest;
  if (id === undefined) {
    // POST tasks: notifications only when the new task has a date / reminder (auto reminder).
    return impactOf(TASK_EDIT_ROOTS, keysOf(body).some((k) => REMINDER_FIELD.test(k)));
  }
  if (id === 'batch') {
    const batchAction = field(body, 'action');
    const labelsOnly = typeof batchAction === 'string' && LABEL_ONLY_BATCH.has(batchAction);
    const completes = typeof batchAction !== 'string' || batchAction === 'CLOSE' || batchAction === 'REOPEN';
    return impactOf(completes ? TASK_ROOTS : TASK_EDIT_ROOTS, !labelsOnly);
  }
  if (id === 'overdue') return impactOf(TASK_EDIT_ROOTS, true); // overdue/reschedule
  if (action === undefined) {
    if (method === 'DELETE') return impactOf(TASK_EDIT_ROOTS, true);
    return impactOf(TASK_EDIT_ROOTS, keysOf(body).some((k) => !REMINDER_NEUTRAL_TASK_FIELDS.has(k)));
  }
  if (action === 'close' || action === 'reopen') return impactOf(TASK_ROOTS, true);
  // REVIEW: approve completes the task (counts, reminders); reject only flips the review state back.
  if (action === 'review') return rest[2] === 'approve' ? impactOf(TASK_ROOTS, true) : impactOf(TASK_EDIT_ROOTS, false);
  if (action === 'reminders') return impactOf(TASK_EDIT_ROOTS, true);
  if (action === 'comments') return impactOf(COMMENT_ROOTS, false);
  if (action === 'move') return impactOf(TASK_EDIT_ROOTS, false);
  if (action === 'duplicate') return impactOf(TASK_EDIT_ROOTS, true);
  return ALL;
}

function projectWrite(method: string, rest: string[]): WriteImpact {
  const [id, action] = rest;
  if (id === undefined) return impactOf(['projects', 'search', 'workspaces', 'activity'], false); // POST projects
  if (action === 'sections') return sectionWrite(method, rest.slice(2));
  if (action === 'comments') return impactOf(COMMENT_ROOTS, false);
  if (action === 'favorite') return impactOf(['projects', 'favorites'], false);
  // Rename / colour: shown in task rows, favorites, Browse; the tasks and their reminders stay as they are.
  if (action === undefined && method === 'PATCH') return impactOf(without(PROJECT_ROOTS, 'sharing'), false);
  // archive / unarchive / delete / move (workspace, folder): the project's tasks come and go.
  return impactOf(PROJECT_ROOTS, true);
}

function sectionWrite(method: string, rest: string[]): WriteImpact {
  const [id, action] = rest;
  if (id === undefined) return impactOf(['sections', 'activity'], false); // POST: a new empty section
  if (action === undefined && method === 'PATCH') return impactOf(SECTION_ROOTS, false);
  return impactOf([...SECTION_ROOTS, 'projects'], true); // archive / unarchive / delete take tasks along
}

function ownRoots(rest: string[], method: string, base: string, full: readonly string[], created: readonly string[]): WriteImpact {
  const [id, action] = rest;
  if (id === undefined) return impactOf(method === 'POST' ? created : full, false);
  if (action === 'favorite') return impactOf([base, 'favorites'], false);
  return impactOf(full, false);
}

const REORDER_ROOTS: Readonly<Record<string, readonly string[]>> = {
  TASK: ['tasks'],
  SECTION: ['sections', 'tasks'],
  PROJECT: ['projects'],
  LABEL: ['labels'],
  FILTER: ['filters'],
  FOLDER: ['workspaces', 'projects'],
};

/**
 * Impact of one write request (`/api/v1/...`). Anything not listed — sharing, workspaces, templates applied, settings,
 * a resource of a later milestone — keeps the old behaviour: every data root, and reminders re-planned.
 */
export function impactOfWrite(method: string, path: string, body: unknown): WriteImpact {
  const segments = path.split('?')[0].replace(/^\/?api\/v1\//, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [resource, ...rest] = segments;
  switch (resource) {
    case 'tasks':
      return taskWrite(method, rest, body);
    case 'projects':
      return projectWrite(method, rest);
    case 'labels':
      return ownRoots(rest, method, 'labels', LABEL_ROOTS, ['labels', 'search']);
    case 'filters':
      return ownRoots(rest, method, 'filters', FILTER_ROOTS, ['filters']);
    case 'comments':
      return impactOf(COMMENT_ROOTS, false);
    case 'view-options':
      return impactOf(['viewOptions'], false);
    case 'reorder': {
      const type = field(body, 'type');
      const roots = typeof type === 'string' ? REORDER_ROOTS[type] : undefined;
      return roots ? impactOf(roots, false) : ALL;
    }
    case 'templates':
      // Save as template / delete one only touch the template list; applying / importing one creates data.
      return rest.length <= 1 && (method === 'DELETE' || rest.length === 0) ? impactOf(['templates'], false) : ALL;
    default:
      return ALL;
  }
}

/** The writes of one mutation together; none seen (a write not going through apiFetch) = everything, as before. */
export function mergeImpacts(impacts: readonly WriteImpact[]): WriteImpact {
  if (impacts.length === 0) return ALL;
  const roots = new Set<string>();
  let reminders = false;
  for (const impact of impacts) {
    if (impact.roots === 'all') return ALL;
    impact.roots.forEach((root) => roots.add(root));
    reminders ||= impact.reminders;
  }
  return { roots, reminders };
}
