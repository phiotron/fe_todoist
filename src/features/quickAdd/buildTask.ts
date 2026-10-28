import type { CreateTaskRequest } from '../../api/models';
import type { DueValue } from '../schedule/dueValue';

export interface QuickAddState {
  projectId?: string;
  sectionId?: string | null;
  parentId?: string | null;
  content: string;
  description: string;
  priority: number;
  due: DueValue;
  /** M2: labels picked on the Labels chip; sent only when not empty. */
  labelIds?: string[];
  /** M6b: deadline chip / {…} in the name (yyyy-MM-dd); sent only when set. */
  deadline?: string | null;
}

/**
 * M6b parses "every …" but the backend only accepts recurrenceRule from M6c (V9): until then the task is created for
 * its first date only. Turn on when M6c is merged (then send toRRule(spec), recurrenceFromCompletion, dueString).
 */
export const SEND_RECURRENCE = false;

/**
 * POST tasks body (spec 12.3): only what was set; the whole due travels together; `afterId` is never sent (absent = end of
 * the block, null would mean the top); no client `id` either (optional, M9 offline create).
 */
export function buildCreateBody(state: QuickAddState): CreateTaskRequest {
  const body: CreateTaskRequest = { content: state.content.trim(), priority: state.priority };
  if (state.projectId) body.projectId = state.projectId;
  if (state.sectionId) body.sectionId = state.sectionId;
  if (state.parentId) body.parentId = state.parentId;
  if (state.description.trim()) body.description = state.description.trim();
  if (state.due.dueDate) body.dueDate = state.due.dueDate;
  if (state.due.dueDatetime) body.dueDatetime = state.due.dueDatetime;
  if (state.due.durationMinutes) body.durationMinutes = state.due.durationMinutes;
  if (state.labelIds && state.labelIds.length > 0) body.labelIds = [...state.labelIds];
  if (state.deadline) body.deadlineDate = state.deadline;
  return body;
}
