import type { OccurrenceInput, ReminderDraft } from '../lib/reminders';
import { apiFetch } from './client';
import { ApiError } from './errors';
import type { components } from './types.gen';

/** The server returns and the app schedules at most this many reminders (spec 5.8, 5.9). */
export const REMINDER_FETCH_LIMIT = 50;

/** Item of GET /api/v1/tasks/reminders (spec 12.8). `fireAt` is a floating "yyyy-MM-ddTHH:mm:ss" in the account time zone. */
export type ReminderOccurrence = components['schemas']['ReminderOccurrence'];

/** Item of GET /api/v1/tasks/{id}/reminders (spec 12.8). */
export type ReminderResponse = components['schemas']['ReminderResponse'];

/** Body of POST /api/v1/tasks/{id}/reminders. */
export type CreateReminderRequest = { type: 'ABSOLUTE'; at: string } | { type: 'RELATIVE'; minuteOffset: number };

const taskPath = (taskId: string) => `/api/v1/tasks/${encodeURIComponent(taskId)}`;

export const remindersApi = {
  upcoming: (limit: number = REMINDER_FETCH_LIMIT) =>
    apiFetch<ReminderOccurrence[]>(`/api/v1/tasks/reminders?limit=${limit}`),
  list: (taskId: string) => apiFetch<ReminderResponse[]>(`${taskPath(taskId)}/reminders`),
  create: (taskId: string, body: CreateReminderRequest, idempotencyKey: string) =>
    apiFetch<ReminderResponse>(`${taskPath(taskId)}/reminders`, { method: 'POST', body, idempotencyKey }),
  remove: (taskId: string, reminderId: string) =>
    apiFetch<void>(`${taskPath(taskId)}/reminders/${encodeURIComponent(reminderId)}`, { method: 'DELETE' }),
};

export function toOccurrenceInput(item: ReminderOccurrence): OccurrenceInput {
  return {
    key: item.key,
    taskId: item.taskId,
    kind: item.kind,
    fireAt: item.fireAt,
    content: item.content,
  };
}

export async function fetchUpcomingReminders(): Promise<OccurrenceInput[]> {
  const items = await remindersApi.upcoming();
  return items.map(toOccurrenceInput);
}

export function toCreateRequest(draft: ReminderDraft): CreateReminderRequest {
  return draft.type === 'ABSOLUTE'
    ? { type: 'ABSOLUTE', at: draft.at }
    : { type: 'RELATIVE', minuteOffset: draft.minuteOffset };
}

/** Does a snoozed task still deserve its snooze? Completed or deleted (404) → gone. Other errors throw. */
export async function fetchTaskState(taskId: string): Promise<'open' | 'gone'> {
  try {
    const task = await apiFetch<{ completedAt?: string | null }>(taskPath(taskId));
    return task.completedAt ? 'gone' : 'open';
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return 'gone';
    throw error;
  }
}
