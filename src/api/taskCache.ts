import type { QueryClient } from '@tanstack/react-query';
import type { Task, TaskChangeResponse } from './models';
import { queryKeys } from './queryKeys';

type TaskPatch = Partial<Task>;

function isTask(value: unknown): value is Task {
  return value !== null && typeof value === 'object' && typeof (value as Task).id === 'string' && 'version' in (value as object);
}

function patched(task: Task, patches: ReadonlyMap<string, TaskPatch>): Task {
  const patch = patches.get(task.id);
  return patch ? { ...task, ...patch } : task;
}

/** Applies the patches to the three shapes under the `tasks` root: detail (Task), subtasks (Task[]), list (infinite pages). */
function patchData(data: unknown, patches: ReadonlyMap<string, TaskPatch>): unknown {
  if (Array.isArray(data)) return data.map((item) => (isTask(item) ? patched(item, patches) : item));
  if (isTask(data)) return patched(data, patches);
  if (data !== null && typeof data === 'object' && Array.isArray((data as { pages?: unknown }).pages)) {
    const infinite = data as { pages: { items?: unknown[] }[] };
    return {
      ...infinite,
      pages: infinite.pages.map((page) =>
        Array.isArray(page.items)
          ? { ...page, items: page.items.map((item) => (isTask(item) ? patched(item, patches) : item)) }
          : page,
      ),
    };
  }
  return data;
}

/**
 * close / reopen answer → cache (spec 3.1 / 12.3): the answered task is written whole, each cascaded task gets its new
 * `version` + `completedAt`. Without this a screen that already holds the task keeps the OLD version and its next
 * PATCH fails with a false 409. Only entries that already exist are changed; the lists are still invalidated by
 * `useDataMutation` afterwards (order, counts).
 */
export function applyTaskChange(queryClient: QueryClient, change: TaskChangeResponse): void {
  const patches = new Map<string, TaskPatch>();
  for (const cascaded of change.cascaded) {
    patches.set(cascaded.id, { version: cascaded.version, completedAt: cascaded.completedAt });
  }
  patches.set(change.task.id, change.task);
  queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, (data: unknown) => patchData(data, patches));
}
