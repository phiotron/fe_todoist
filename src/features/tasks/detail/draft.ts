import type { Task, UpdateTaskRequest } from '../../../api/models';
import { sameLabelIds } from '../../labels/labelDisplay';

/** Everything the detail screen edits (spec 9.2 order: name, description, date, deadline, priority). */
export interface TaskDraft {
  content: string;
  description: string;
  priority: number;
  dueDate: string | null;
  dueDatetime: string | null;
  durationMinutes: number | null;
  deadlineDate: string | null;
  /** M2: the whole label set (PATCH replaces it, spec 12.3). */
  labelIds: string[];
  /** M6c: canonical RRULE or null; saved together with `recurrenceFromCompletion` (every!). */
  recurrenceRule: string | null;
  recurrenceFromCompletion: boolean;
}

export function draftFromTask(task: Task): TaskDraft {
  return {
    content: task.content,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate,
    dueDatetime: task.dueDatetime,
    durationMinutes: task.durationMinutes,
    deadlineDate: task.deadlineDate,
    labelIds: [...(task.labelIds ?? [])],
    recurrenceRule: task.recurrenceRule ?? null,
    recurrenceFromCompletion: task.recurrenceFromCompletion ?? false,
  };
}

/**
 * PATCH body without `version`: only the fields that differ from `base`. The due fields travel together (sending a
 * due replaces the whole due, spec 12.3); null clears; the content is trimmed.
 */
export function draftChanges(base: Task, draft: TaskDraft): Omit<UpdateTaskRequest, 'version'> {
  const changes: Omit<UpdateTaskRequest, 'version'> = {};
  const content = draft.content.trim();
  if (content !== base.content) changes.content = content;
  if (draft.description !== base.description) changes.description = draft.description;
  if (draft.priority !== base.priority) changes.priority = draft.priority;
  if (
    draft.dueDate !== base.dueDate ||
    draft.dueDatetime !== base.dueDatetime ||
    draft.durationMinutes !== base.durationMinutes
  ) {
    changes.dueDate = draft.dueDate;
    changes.dueDatetime = draft.dueDatetime;
    changes.durationMinutes = draft.durationMinutes;
  }
  if (draft.deadlineDate !== base.deadlineDate) changes.deadlineDate = draft.deadlineDate;
  if (!sameLabelIds(draft.labelIds, base.labelIds ?? [])) changes.labelIds = [...draft.labelIds];
  // M6c: the rule and "every!" travel together (a rule needs the due sent in the same body when the due changed too).
  const baseRule = base.recurrenceRule ?? null;
  const baseFromCompletion = base.recurrenceFromCompletion ?? false;
  if (draft.recurrenceRule !== baseRule || (draft.recurrenceRule !== null && draft.recurrenceFromCompletion !== baseFromCompletion)) {
    changes.recurrenceRule = draft.recurrenceRule;
    if (draft.recurrenceRule !== null) changes.recurrenceFromCompletion = draft.recurrenceFromCompletion;
  }
  return changes;
}

/** true when only non-editable fields (completion, counts, version) differ. */
export function sameEditableFields(a: Task, b: Task): boolean {
  return Object.keys(draftChanges(a, draftFromTask(b))).length === 0;
}
