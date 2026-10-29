import { apiFetch } from './client';

export interface ReviewRestoreBody {
  requestedBy: string;
  requestedAt: string;
}

const base = (taskId: string) => `/api/v1/tasks/${encodeURIComponent(taskId)}/review`;

/**
 * REVIEW (Cho duyet, team projects). Admin only: 403 `team-admin-only`; the task is not pending any more: 409
 * `review-not-pending`. The lists come from GET tasks?view=review (tasksApi.list). The answer body is not used: callers
 * refresh the lists (offline, the queued command carries `{ taskId }`).
 */
export const reviewApi = {
  approve: (taskId: string) => apiFetch<unknown>(`${base(taskId)}/approve`, { method: 'POST' }),
  reject: (taskId: string) => apiFetch<unknown>(`${base(taskId)}/reject`, { method: 'POST' }),
  /**
   * Real Undo of a return (backend contract, ADAPTER: one place to change). Admin only (403 `team-admin-only`); only an
   * open task with review NONE (409 `review-not-restorable`). Puts the task back to PENDING with the ORIGINAL requester
   * and time, which the caller took from the task before returning it.
   */
  restore: (taskId: string, body: ReviewRestoreBody) => apiFetch<unknown>(`${base(taskId)}/restore`, { method: 'POST', body }),
};
