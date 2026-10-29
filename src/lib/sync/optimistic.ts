import type { QueryClient } from '@tanstack/react-query';
import type { Task } from '../../api/models';
import { queryKeys } from '../../api/queryKeys';
import { tickOutcome, type ReviewCapabilities } from '../review';
import type { MappedCommand } from './commandMap';

/**
 * Optimistic effect of a queued command (plan F5): (1) patches the TanStack caches so the screens show the change at
 * once — offline the refetch that normally follows a write fails, so without this the edit would stay invisible;
 * (2) builds the value the REST call would have answered with, so hooks that read the answer (`applyTaskChange`,
 * navigation to the new record...) keep working. Caches are patched only where the shape is certain; everything
 * else is corrected by the refresh after the sync.
 */

type Rec = Record<string, unknown> & { id: string };
type Page = { items: unknown[]; nextCursor?: string | null };
type Infinite = { pages: Page[]; pageParams?: unknown[] };

const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && typeof (v as Rec).id === 'string';
const isInfinite = (v: unknown): v is Infinite =>
  v !== null && typeof v === 'object' && Array.isArray((v as Infinite).pages);

/** Applies `fn` to every task-shaped item of one cached value (list pages, a plain array or a single record). */
function mapItems(data: unknown, fn: (item: Rec) => Rec | null): unknown {
  if (Array.isArray(data)) return data.flatMap((item) => (isRec(item) ? (fn(item) ? [fn(item) as Rec] : []) : [item]));
  if (isInfinite(data)) {
    return {
      ...data,
      pages: data.pages.map((page) =>
        Array.isArray(page.items)
          ? { ...page, items: page.items.flatMap((item) => (isRec(item) ? (fn(item) ? [fn(item) as Rec] : []) : [item])) }
          : page,
      ),
    };
  }
  if (isRec(data)) return fn(data) ?? data;
  return data;
}

function patchById(id: string, patch: Record<string, unknown>) {
  return (data: unknown) => mapItems(data, (item) => (item.id === id ? { ...item, ...patch } : item));
}

function removeById(ids: ReadonlySet<string>) {
  return (data: unknown) => (isRec(data) ? data : mapItems(data, (item) => (ids.has(item.id) ? null : item)));
}

function appendToLastPage(data: unknown, item: unknown): unknown {
  if (Array.isArray(data)) return [...data, item];
  if (isInfinite(data) && data.pages.length > 0) {
    const pages = data.pages.slice();
    const last = pages[pages.length - 1];
    pages[pages.length - 1] = { ...last, items: [...(last.items ?? []), item] };
    return { ...data, pages };
  }
  return data;
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function cachedTask(queryClient: QueryClient, id: string): Task | undefined {
  const detail = queryClient.getQueryData<Task>(queryKeys.tasks.detail(id));
  if (detail) return detail;
  for (const [, data] of queryClient.getQueriesData({ queryKey: queryKeys.tasks.all })) {
    const found = findTask(data, id);
    if (found) return found;
  }
  return undefined;
}

function findTask(data: unknown, id: string): Task | undefined {
  if (Array.isArray(data)) return data.find((i): i is Task => isRec(i) && i.id === id);
  if (isInfinite(data)) return data.pages.flatMap((p) => p.items ?? []).find((i): i is Task => isRec(i) && i.id === id);
  return isRec(data) && data.id === id ? (data as unknown as Task) : undefined;
}

function cachedRecord(queryClient: QueryClient, root: readonly string[], id: string): Rec | undefined {
  for (const [, data] of queryClient.getQueriesData({ queryKey: root })) {
    const found = Array.isArray(data) ? data.find((i): i is Rec => isRec(i) && i.id === id) : undefined;
    if (found) return found;
  }
  return undefined;
}

function projectName(queryClient: QueryClient, projectId: string): string {
  return str(cachedRecord(queryClient, queryKeys.projects.all, projectId)?.name) ?? '';
}

function inboxId(queryClient: QueryClient): string | null {
  for (const [, data] of queryClient.getQueriesData({ queryKey: queryKeys.projects.all })) {
    const inbox = Array.isArray(data) ? data.find((p) => isRec(p) && p.isInbox === true) : undefined;
    if (isRec(inbox)) return inbox.id;
  }
  return null;
}

const DEFAULT_COLOR = 'charcoal';

// ---------- builders: what the REST answer would have looked like ----------

export function buildTask(queryClient: QueryClient, args: Rec, nowIso: string): Task {
  const parent = str(args.parentId) ? cachedTask(queryClient, args.parentId as string) : undefined;
  const projectId = str(args.projectId) ?? parent?.projectId ?? inboxId(queryClient) ?? '';
  return {
    id: args.id,
    projectId,
    sectionId: str(args.sectionId) ?? parent?.sectionId ?? null,
    parentId: str(args.parentId),
    content: str(args.content) ?? '',
    description: str(args.description) ?? '',
    priority: typeof args.priority === 'number' ? args.priority : 4,
    dueDate: str(args.dueDate),
    dueDatetime: str(args.dueDatetime),
    durationMinutes: typeof args.durationMinutes === 'number' ? args.durationMinutes : null,
    deadlineDate: str(args.deadlineDate),
    dueString: null,
    isOverdue: false,
    completedAt: null,
    subtaskCount: 0,
    completedSubtaskCount: 0,
    sortOrder: Number.MAX_SAFE_INTEGER,
    version: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    projectName: projectName(queryClient, projectId),
    parentContent: parent?.content ?? null,
    labelIds: Array.isArray(args.labelIds) ? (args.labelIds as string[]) : [],
    ...NO_REVIEW,
  } as unknown as Task;
}

function buildProject(args: Rec, nowIso: string): Rec {
  return {
    id: args.id,
    name: str(args.name) ?? '',
    color: str(args.color) ?? DEFAULT_COLOR,
    description: str(args.description) ?? '',
    parentId: str(args.parentId),
    isInbox: false,
    isFavorite: false,
    archivedAt: null,
    sortOrder: Number.MAX_SAFE_INTEGER,
    viewStyle: 'LIST',
    activeTaskCount: 0,
    descendantProjectCount: 0,
    descendantActiveTaskCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function buildSection(args: Rec, nowIso: string): Rec {
  return {
    id: args.id,
    projectId: str(args.projectId) ?? '',
    name: str(args.name) ?? '',
    description: str(args.description) ?? '',
    sortOrder: Number.MAX_SAFE_INTEGER,
    archivedAt: null,
    activeTaskCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

// ---------- REVIEW (Cho duyet) ----------

const NO_REVIEW = { reviewStatus: 'NONE', reviewRequestedBy: null, reviewRequestedAt: null } as const;

/** PENDING (a request from me; the server stamps the real user id) or NONE (cancelled). */
function reviewPatch(request: boolean, nowIso: string): Record<string, unknown> {
  return request
    ? { reviewStatus: 'PENDING', reviewRequestedAt: nowIso, updatedAt: nowIso }
    : { ...NO_REVIEW, updatedAt: nowIso };
}

function capabilitiesFor(queryClient: QueryClient, projectId: string): ReviewCapabilities | undefined {
  const capabilities = cachedRecord(queryClient, queryKeys.projects.all, projectId)?.capabilities;
  return capabilities !== null && typeof capabilities === 'object' ? (capabilities as ReviewCapabilities) : undefined;
}

/** The Pending-review lists (GET tasks?view=review) lose the task once it is approved / returned. */
function removeFromReviewLists(queryClient: QueryClient, taskId: string) {
  queryClient.setQueriesData(
    { queryKey: queryKeys.tasks.all, predicate: (q) => q.queryKey[1] === 'list' && listParams(q.queryKey).view === 'review' },
    removeById(new Set([taskId])),
  );
}

/** Undo of a return: the task is pending again, so it is back in the Pending-review lists (once; the server orders them). */
function addToReviewLists(queryClient: QueryClient, task: Task) {
  queryClient.setQueriesData(
    { queryKey: queryKeys.tasks.all, predicate: (q) => q.queryKey[1] === 'list' && listParams(q.queryKey).view === 'review' },
    (data: unknown) => (findTask(data, task.id) ? data : appendToLastPage(data, task)),
  );
}

// ---------- apply ----------

const TASK_FIELDS = [
  'content',
  'description',
  'priority',
  'dueDate',
  'dueDatetime',
  'durationMinutes',
  'deadlineDate',
  'labelIds',
] as const;

function pick(args: Rec, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) if (field in args) out[field] = args[field];
  return out;
}

/** A task list that shows OPEN tasks (not the Completed screen / completed project list). */
function isOpenList(key: readonly unknown[]): boolean {
  const params = key[2] as { view?: string; completed?: boolean } | undefined;
  return !(params?.completed === true || params?.view === 'completed');
}

function listParams(key: readonly unknown[]): { view?: string; projectId?: string; completed?: boolean } {
  return (key[2] as { view?: string; projectId?: string }) ?? {};
}

function removeTaskFromOpenLists(queryClient: QueryClient, ids: ReadonlySet<string>, onlyOutsideProject?: string) {
  queryClient.setQueriesData(
    {
      queryKey: queryKeys.tasks.all,
      predicate: (q) => {
        if (q.queryKey[1] !== 'list' && q.queryKey[1] !== 'subtasks') return false;
        if (q.queryKey[1] === 'list' && !isOpenList(q.queryKey)) return false;
        if (onlyOutsideProject !== undefined) {
          const projectId = listParams(q.queryKey).projectId;
          return q.queryKey[1] === 'list' && projectId !== undefined && projectId !== onlyOutsideProject;
        }
        return true;
      },
    },
    removeById(ids),
  );
}

function descendantIds(queryClient: QueryClient, rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  for (const [, data] of queryClient.getQueriesData({ queryKey: queryKeys.tasks.all })) {
    const items = Array.isArray(data) ? data : isInfinite(data) ? data.pages.flatMap((p) => p.items ?? []) : [];
    let grew = true;
    while (grew) {
      grew = false;
      for (const item of items) {
        if (isRec(item) && typeof item.parentId === 'string' && ids.has(item.parentId) && !ids.has(item.id)) {
          ids.add(item.id);
          grew = true;
        }
      }
    }
  }
  return ids;
}

// ---------- M9 phase 2: reorder, batch, favorites, reminders ----------

/** `taskRemindersKey` of features/reminders (a literal here so lib/ does not import features/; a test pins them equal). */
export const remindersCacheKey = (taskId: string) => ['tasks', 'reminders', taskId] as const;

const REORDER_ROOTS: Record<string, readonly string[]> = {
  TASK: queryKeys.tasks.all,
  SECTION: queryKeys.sections.all,
  PROJECT: queryKeys.projects.all,
  LABEL: queryKeys.labels.all,
  FILTER: queryKeys.filters.all,
};

const SORT_STEP = 1024;

/** Every record cached under `root` (lists, pages, details), once per id. */
function cachedRecords(queryClient: QueryClient, root: readonly string[]): Rec[] {
  const found = new Map<string, Rec>();
  for (const [, data] of queryClient.getQueriesData({ queryKey: root })) {
    const items = Array.isArray(data) ? data : isInfinite(data) ? data.pages.flatMap((p) => p.items ?? []) : [data];
    for (const item of items) if (isRec(item) && !found.has(item.id)) found.set(item.id, item);
  }
  return [...found.values()];
}

/** Same container (spec 10.1): tasks share (project, section, parent), sections a project, projects a parent. */
function sameContainer(type: string, a: Rec, b: Rec): boolean {
  const eq = (field: string) => (a[field] ?? null) === (b[field] ?? null);
  switch (type) {
    case 'TASK':
      return eq('projectId') && eq('sectionId') && eq('parentId');
    case 'SECTION':
      return eq('projectId');
    case 'PROJECT':
      return eq('parentId') && eq('workspaceId');
    default:
      return true;
  }
}

/** sortOrder that puts `id` right after `afterId` (null = first) among its cached siblings — the server decides for real. */
function reorderSortOrder(siblings: Rec[], afterId: string | null): number {
  const orders = siblings.map((s) => s.sortOrder as number);
  if (afterId === null) return orders.length > 0 ? orders[0] - SORT_STEP : SORT_STEP;
  const index = siblings.findIndex((s) => s.id === afterId);
  if (index < 0) return orders.length > 0 ? Math.min(orders[orders.length - 1] + SORT_STEP, Number.MAX_SAFE_INTEGER) : SORT_STEP;
  const next = orders[index + 1];
  return next === undefined ? Math.min(orders[index] + SORT_STEP, Number.MAX_SAFE_INTEGER) : (orders[index] + next) / 2;
}

function applyReorder(queryClient: QueryClient, args: Rec): unknown {
  const type = str(args.type) ?? '';
  const root = REORDER_ROOTS[type];
  const id = args.id;
  if (!root) return { type, id, sortOrder: 0 };
  const afterId = str(args.afterId);
  const all = cachedRecords(queryClient, root);
  const self = all.find((r) => r.id === id);
  if (!self) return { type, id, sortOrder: 0 };
  const siblings = all
    .filter((r) => r.id !== id && typeof r.sortOrder === 'number' && sameContainer(type, r, self))
    .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number));
  const sortOrder = reorderSortOrder(siblings, afterId);
  queryClient.setQueriesData({ queryKey: root }, patchById(id, { sortOrder }));
  return { type, id, sortOrder };
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** New due of a task moved to `date` (null = no due). A timed task keeps its time of day (like the server's reschedule). */
function rescheduled(task: Task | undefined, date: string | null, today: string): Record<string, unknown> {
  const time = typeof task?.dueDatetime === 'string' ? task.dueDatetime.slice(10) : null;
  const dueDatetime = date !== null && time ? `${date}${time}` : null;
  return {
    dueDate: date,
    dueDatetime,
    durationMinutes: dueDatetime ? (task?.durationMinutes ?? null) : null,
    isOverdue: date !== null && date < today,
  };
}

function applyBatch(queryClient: QueryClient, args: Rec, nowIso: string): unknown {
  const taskIds = Array.isArray(args.taskIds) ? (args.taskIds as unknown[]).filter((v): v is string => typeof v === 'string') : [];
  const action = str(args.action);
  const each = (type: string, extra: Record<string, unknown> = {}) =>
    taskIds.forEach((taskId) => applyOptimistic(queryClient, { type, args: { id: taskId, ...extra } }, nowIso));
  const patchAll = (build: (id: string) => Record<string, unknown>) =>
    taskIds.forEach((taskId) =>
      queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, patchById(taskId, { ...build(taskId), updatedAt: nowIso })),
    );
  switch (action) {
    case 'CLOSE':
      each('task_close');
      break;
    case 'REOPEN':
      each('task_reopen');
      break;
    case 'DELETE':
      each('task_delete');
      break;
    case 'MOVE':
      each('task_move', { projectId: str(args.projectId), sectionId: str(args.sectionId), parentId: null });
      break;
    case 'PRIORITY':
      patchAll(() => ({ priority: args.priority }));
      break;
    case 'SCHEDULE': {
      const date = args.date === undefined ? null : str(args.date);
      patchAll((taskId) => rescheduled(cachedTask(queryClient, taskId), date, dateKey(nowIso)));
      break;
    }
    case 'ADD_LABELS':
    case 'REMOVE_LABELS': {
      const labelIds = Array.isArray(args.labelIds) ? (args.labelIds as string[]) : [];
      patchAll((taskId) => {
        const current = cachedTask(queryClient, taskId)?.labelIds ?? [];
        return {
          labelIds:
            action === 'ADD_LABELS'
              ? [...current, ...labelIds.filter((l) => !current.includes(l))]
              : current.filter((l) => !labelIds.includes(l)),
        };
      });
      break;
    }
    default:
      break;
  }
  return { taskIds };
}

/** "Reschedule" of the Overdue block: every cached open overdue task moves to `date`. */
function applyRescheduleOverdue(queryClient: QueryClient, args: Rec, nowIso: string): unknown {
  const date = str(args.date);
  const overdue = date
    ? cachedRecords(queryClient, queryKeys.tasks.all).filter((r) => r.isOverdue === true && r.completedAt == null)
    : [];
  overdue.forEach((record) =>
    queryClient.setQueriesData(
      { queryKey: queryKeys.tasks.all },
      patchById(record.id, { ...rescheduled(record as unknown as Task, date, dateKey(nowIso)), updatedAt: nowIso }),
    ),
  );
  return { taskIds: overdue.map((r) => r.id) };
}

const FAVORITE_KINDS = {
  project: { root: queryKeys.projects.all, targetType: 'PROJECT' },
  label: { root: queryKeys.labels.all, targetType: 'LABEL' },
  filter: { root: queryKeys.filters.all, targetType: 'FILTER' },
} as const;

function applyFavorite(queryClient: QueryClient, command: MappedCommand, nowIso: string): unknown {
  const id = (command.args as Rec).id;
  const kind = FAVORITE_KINDS[command.type.split('_')[0] as keyof typeof FAVORITE_KINDS];
  const favorite = !command.type.endsWith('unfavorite');
  const before = cachedRecords(queryClient, kind.root).find((r) => r.id === id);
  queryClient.setQueriesData({ queryKey: kind.root }, patchById(id, { isFavorite: favorite }));
  queryClient.setQueriesData({ queryKey: queryKeys.favorites.all }, (data: unknown) => {
    if (!Array.isArray(data)) return data;
    const rest = data.filter((f) => !(f && (f as { targetId?: string }).targetId === id));
    return favorite ? [...rest, { targetType: kind.targetType, targetId: id, createdAt: nowIso }] : rest;
  });
  return { ...(before ?? { id }), isFavorite: favorite };
}

function applyReminderAdd(queryClient: QueryClient, args: Rec, nowIso: string): unknown {
  const taskId = str(args.taskId) ?? '';
  const at = str(args.at);
  const reminder = {
    id: args.id,
    taskId,
    type: str(args.type) ?? 'ABSOLUTE',
    at: at && at.length === 16 ? `${at}:00` : at,
    minuteOffset: typeof args.minuteOffset === 'number' ? args.minuteOffset : null,
    createdAt: nowIso,
    locationId: str(args.locationId),
    locationTrigger: str(args.trigger),
    urgent: args.urgent === true,
  };
  queryClient.setQueriesData({ queryKey: remindersCacheKey(taskId) }, (data: unknown) =>
    Array.isArray(data) ? [...data, reminder] : data,
  );
  return reminder;
}

/** Patches the caches for one command and returns the value the matching REST call would have answered with. */
export function applyOptimistic(queryClient: QueryClient, command: MappedCommand, nowIso: string): unknown {
  const args = command.args as Rec;
  const { id } = args;
  switch (command.type) {
    case 'task_add': {
      const task = buildTask(queryClient, args, nowIso);
      queryClient.setQueryData(queryKeys.tasks.detail(task.id), task);
      queryClient.setQueriesData(
        {
          queryKey: queryKeys.tasks.all,
          predicate: (q) => {
            if (q.queryKey[1] === 'subtasks') return q.queryKey[2] === task.parentId;
            if (q.queryKey[1] !== 'list' || !isOpenList(q.queryKey) || task.parentId) return false;
            const params = listParams(q.queryKey);
            return params.projectId === task.projectId && params.view === undefined;
          },
        },
        (data: unknown) => appendToLastPage(data, task),
      );
      if (task.parentId) {
        queryClient.setQueriesData(
          { queryKey: queryKeys.tasks.all },
          patchById(task.parentId, { subtaskCount: (cachedTask(queryClient, task.parentId)?.subtaskCount ?? 0) + 1 }),
        );
      }
      return task;
    }
    case 'task_update': {
      const patch = { ...pick(args, TASK_FIELDS), updatedAt: nowIso };
      const before = cachedTask(queryClient, id);
      queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, patchById(id, patch));
      return { ...(before ?? buildTask(queryClient, args, nowIso)), ...patch };
    }
    case 'task_close':
    case 'task_reopen': {
      const closing = command.type === 'task_close';
      const before = cachedTask(queryClient, id) ?? buildTask(queryClient, args, nowIso);
      // REVIEW: in a team project a Member's tick asks for review (PENDING, still open) and ticking again cancels it.
      const outcome = closing ? tickOutcome(before, capabilitiesFor(queryClient, before.projectId)) : 'COMPLETE';
      if (outcome !== 'COMPLETE') {
        const patch = reviewPatch(outcome === 'REQUEST', nowIso);
        queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, patchById(id, patch));
        return { task: { ...before, ...patch }, cascaded: [] };
      }
      const completedAt = closing ? nowIso : null;
      const patch = { completedAt, ...NO_REVIEW };
      queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, patchById(id, patch));
      if (closing) removeTaskFromOpenLists(queryClient, new Set([id]));
      return { task: { ...before, ...patch }, cascaded: [] };
    }
    case 'task_review_approve':
    case 'task_review_reject': {
      const taskId = str(args.taskId) ?? '';
      const approving = command.type === 'task_review_approve';
      const before = cachedTask(queryClient, taskId);
      const patch = approving ? { completedAt: nowIso, ...NO_REVIEW } : { ...NO_REVIEW };
      queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, patchById(taskId, patch));
      removeFromReviewLists(queryClient, taskId);
      if (approving) removeTaskFromOpenLists(queryClient, new Set([taskId]));
      return before ? { task: { ...before, ...patch }, cascaded: [] } : undefined;
    }
    case 'task_review_restore': {
      const before = cachedTask(queryClient, id as string);
      const patch = {
        reviewStatus: 'PENDING',
        reviewRequestedBy: str(args.requestedBy) ?? null,
        reviewRequestedAt: str(args.requestedAt) ?? null,
        updatedAt: nowIso,
      };
      queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, patchById(id as string, patch));
      if (!before) return undefined;
      const task = { ...before, ...patch } as Task;
      addToReviewLists(queryClient, task);
      return { task, cascaded: [] };
    }
    case 'task_move': {
      const projectId = str(args.projectId) ?? '';
      const patch = {
        projectId,
        sectionId: str(args.sectionId),
        parentId: str(args.parentId),
        projectName: projectName(queryClient, projectId),
      };
      const before = cachedTask(queryClient, id) ?? buildTask(queryClient, args, nowIso);
      queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, patchById(id, patch));
      removeTaskFromOpenLists(queryClient, descendantIds(queryClient, id), projectId);
      return { ...before, ...patch };
    }
    case 'task_delete': {
      const ids = descendantIds(queryClient, id);
      removeTaskFromOpenLists(queryClient, ids);
      ids.forEach((taskId) => queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(taskId) }));
      return undefined;
    }
    case 'project_add': {
      const project = buildProject(args, nowIso);
      queryClient.setQueriesData({ queryKey: queryKeys.projects.list(false) }, (data: unknown) =>
        appendToLastPage(data, project),
      );
      queryClient.setQueryData(queryKeys.projects.detail(id), project);
      return project;
    }
    case 'project_update':
    case 'project_move': {
      const patch =
        command.type === 'project_update' ? pick(args, ['name', 'color', 'description']) : { parentId: str(args.parentId) };
      queryClient.setQueriesData({ queryKey: queryKeys.projects.all }, patchById(id, patch));
      return { ...(cachedRecord(queryClient, queryKeys.projects.all, id) ?? buildProject(args, nowIso)), ...patch };
    }
    case 'project_archive':
    case 'project_unarchive': {
      const archived = command.type === 'project_archive';
      const before = cachedRecord(queryClient, queryKeys.projects.all, id) ?? buildProject(args, nowIso);
      queryClient.setQueriesData({ queryKey: queryKeys.projects.all }, patchById(id, { archivedAt: archived ? nowIso : null }));
      if (archived) queryClient.setQueriesData({ queryKey: queryKeys.projects.list(false) }, removeById(new Set([id])));
      return { ...before, archivedAt: archived ? nowIso : null };
    }
    case 'project_delete': {
      queryClient.setQueriesData({ queryKey: queryKeys.projects.all }, removeById(new Set([id])));
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(id) });
      queryClient.removeQueries({ queryKey: queryKeys.sections.list(id) });
      return undefined;
    }
    case 'section_add': {
      const section = buildSection(args, nowIso);
      queryClient.setQueriesData({ queryKey: queryKeys.sections.list(section.projectId as string) }, (data: unknown) =>
        appendToLastPage(data, section),
      );
      return section;
    }
    case 'section_update':
    case 'section_archive':
    case 'section_unarchive': {
      const patch =
        command.type === 'section_update'
          ? pick(args, ['name', 'description'])
          : { archivedAt: command.type === 'section_archive' ? nowIso : null };
      const key = queryKeys.sections.list(str(args.projectId) ?? '');
      const before = (queryClient.getQueryData<unknown[]>(key) ?? []).find((s) => isRec(s) && s.id === id);
      queryClient.setQueriesData({ queryKey: queryKeys.sections.all }, patchById(id, patch));
      return { ...(isRec(before) ? before : buildSection(args, nowIso)), ...patch };
    }
    case 'section_delete': {
      queryClient.setQueriesData({ queryKey: queryKeys.sections.all }, removeById(new Set([id])));
      return undefined;
    }
    case 'label_add':
    case 'filter_add': {
      const isLabel = command.type === 'label_add';
      const record = isLabel
        ? { id, name: str(args.name) ?? '', color: str(args.color) ?? DEFAULT_COLOR, isFavorite: false, sortOrder: Number.MAX_SAFE_INTEGER }
        : {
            id,
            name: str(args.name) ?? '',
            query: str(args.query) ?? '',
            color: str(args.color) ?? DEFAULT_COLOR,
            isFavorite: false,
            sortOrder: Number.MAX_SAFE_INTEGER,
          };
      queryClient.setQueriesData({ queryKey: isLabel ? queryKeys.labels.all : queryKeys.filters.all }, (data: unknown) =>
        appendToLastPage(data, record),
      );
      return record;
    }
    case 'label_update':
    case 'filter_update': {
      const isLabel = command.type === 'label_update';
      const root = isLabel ? queryKeys.labels.all : queryKeys.filters.all;
      const patch = pick(args, isLabel ? ['name', 'color'] : ['name', 'query', 'color']);
      const before = cachedRecord(queryClient, root, id);
      queryClient.setQueriesData({ queryKey: root }, patchById(id, patch));
      return { ...(before ?? { id }), ...patch };
    }
    case 'label_delete':
    case 'filter_delete': {
      const root = command.type === 'label_delete' ? queryKeys.labels.all : queryKeys.filters.all;
      queryClient.setQueriesData({ queryKey: root }, removeById(new Set([id])));
      return undefined;
    }
    case 'reorder':
      return applyReorder(queryClient, args);
    case 'task_batch':
      return applyBatch(queryClient, args, nowIso);
    case 'task_reschedule_overdue':
      return applyRescheduleOverdue(queryClient, args, nowIso);
    case 'project_favorite':
    case 'project_unfavorite':
    case 'label_favorite':
    case 'label_unfavorite':
    case 'filter_favorite':
    case 'filter_unfavorite':
      return applyFavorite(queryClient, command, nowIso);
    case 'reminder_add':
      return applyReminderAdd(queryClient, args, nowIso);
    case 'reminder_delete': {
      queryClient.setQueriesData({ queryKey: remindersCacheKey(str(args.taskId) ?? '') }, removeById(new Set([id])));
      return undefined;
    }
    default:
      return undefined;
  }
}
