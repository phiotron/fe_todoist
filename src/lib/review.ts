import type { Task } from '../api/models';

/**
 * "Cho duyet" rule (team projects only). One pure place for the tick outcome, shared by the online toggle and the
 * offline optimistic layer. The server decides for real; this only predicts it.
 */
export interface ReviewCapabilities {
  canEditTasks: boolean;
  canCompleteTasks: boolean;
  canReview?: boolean;
}

export type TickOutcome = 'REQUEST' | 'CANCEL' | 'COMPLETE';

type ReviewTask = Pick<Task, 'completedAt'> & Partial<Pick<Task, 'reviewStatus'>>;

export function isPendingReview(task: ReviewTask): boolean {
  return task.reviewStatus === 'PENDING';
}

/** Member / Guest of a team project: may tick, but ticking asks an Admin. Unknown capabilities = not a team limit. */
export function mustAskReview(capabilities: ReviewCapabilities | undefined | null): boolean {
  return !!capabilities && capabilities.canCompleteTasks && !capabilities.canEditTasks;
}

export function tickOutcome(task: ReviewTask, capabilities: ReviewCapabilities | undefined | null): TickOutcome {
  if (!mustAskReview(capabilities)) return 'COMPLETE';
  return isPendingReview(task) ? 'CANCEL' : 'REQUEST';
}

/** A Member cannot reopen a completed task of a team project (only Admins complete there: 403 team-admin-only). */
export function canReopenCompleted(capabilities: ReviewCapabilities | undefined | null): boolean {
  return !mustAskReview(capabilities);
}
