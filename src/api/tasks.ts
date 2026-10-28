import { apiFetch, buildQuery } from './client';
import type {
  AffectedTasksResponse,
  CreateTaskRequest,
  DisplayParams,
  MoveTaskRequest,
  Page,
  Task,
  TaskBatchRequest,
  TaskChangeResponse,
  TaskListParams,
  UpdateTaskRequest,
} from './models';

const base = (taskId: string) => `/api/v1/tasks/${encodeURIComponent(taskId)}`;

/** Display parameters of GET tasks; empty for the lists that do not take them (the server answers 400 otherwise). */
export function displayQuery(params: TaskListParams): DisplayParams {
  if (params.view === 'overdue' || params.view === 'completed' || params.completed) return {};
  // M7: the calendar order is fixed by the server (due, priority): only the filters of Display apply.
  if (params.view === 'calendar') {
    return {
      filterPriority: params.filterPriority,
      filterLabelId: params.filterLabelId,
      filterDue: params.filterDue,
    };
  }
  return {
    sort: params.sort,
    order: params.order,
    group: params.group,
    filterPriority: params.filterPriority,
    filterLabelId: params.filterLabelId,
    filterDue: params.filterDue,
  };
}

/** Spec 12.3 / 12.5. Writes answer with the new state; callers simply refresh their caches (decision #6). */
export const tasksApi = {
  list: (params: TaskListParams, cursor: string | null) =>
    apiFetch<Page<Task>>(
      `/api/v1/tasks${buildQuery({
        view: params.view,
        projectId: params.projectId,
        completed: params.completed ? 'true' : undefined,
        from: params.from,
        to: params.to,
        since: params.since,
        until: params.until,
        labelId: params.labelId,
        filter: params.filter,
        ...displayQuery(params),
        cursor,
      })}`,
    ),
  get: (taskId: string) => apiFetch<Task>(base(taskId)),
  /** Every descendant (completed ones too) in display order, not paged. */
  subtasks: (taskId: string) => apiFetch<Task[]>(`${base(taskId)}/subtasks`),
  create: (body: CreateTaskRequest, idempotencyKey: string) =>
    apiFetch<Task>('/api/v1/tasks', { method: 'POST', body, idempotencyKey }),
  update: (taskId: string, body: UpdateTaskRequest) => apiFetch<Task>(base(taskId), { method: 'PATCH', body }),
  /** Permanent, with the whole subtree (spec 5.4). */
  remove: (taskId: string) => apiFetch<void>(base(taskId), { method: 'DELETE' }),
  /**
   * Open descendants complete too, in one `completion_batch_id` (the basis of Undo, spec 5.1). The answer lists them in
   * `cascaded` with their new version; feed it to `applyTaskChange` (taskCache.ts).
   */
  close: (taskId: string) => apiFetch<TaskChangeResponse>(`${base(taskId)}/close`, { method: 'POST' }),
  /** undo=true also reopens the descendants of the same completion batch (spec 5.1). */
  reopen: (taskId: string, undo = false) =>
    apiFetch<TaskChangeResponse>(`${base(taskId)}/reopen`, { method: 'POST', body: undo ? { undo: true } : undefined }),
  /** `afterId` absent = last of the container, null = first (spec 3.1). Only the moved task's `version` changes. */
  move: (taskId: string, body: MoveTaskRequest) => apiFetch<Task>(`${base(taskId)}/move`, { method: 'POST', body }),
  /** Copies only the open descendants; the copy lands right below the original. */
  duplicate: (taskId: string, idempotencyKey: string) =>
    apiFetch<Task>(`${base(taskId)}/duplicate`, { method: 'POST', idempotencyKey }),
  /**
   * All or nothing, one request for the whole selection. `idempotencyKey` is ALWAYS sent (spec 12.5 / 12.11): MOVE and
   * DELETE are not idempotent without it (a retry after a timeout would 404 the whole DELETE or re-position the MOVE).
   * The server accepts 1–200 ids per request (backend review C6): callers must stop a larger selection.
   */
  batch: (body: TaskBatchRequest, idempotencyKey: string) =>
    apiFetch<AffectedTasksResponse>('/api/v1/tasks/batch', { method: 'POST', body, idempotencyKey }),
  /** Moves every task of the Overdue block (`due_day` < today) to `date` (≥ today, else 400); timed tasks keep their time. */
  rescheduleOverdue: (date: string) =>
    apiFetch<AffectedTasksResponse>('/api/v1/tasks/overdue/reschedule', { method: 'POST', body: { date } }),
};
