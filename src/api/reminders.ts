import type { OccurrenceInput, ReminderDraft } from '../lib/reminders';
import { apiFetch } from './client';
import { ApiError } from './errors';
import type { LocationTrigger } from './locations';
import type { components } from './types.gen';

/** The server returns and the app schedules at most this many reminders (spec 5.8, 5.9). */
export const REMINDER_FETCH_LIMIT = 50;

/**
 * Item of GET /api/v1/tasks/reminders (spec 12.8). `fireAt` is a floating "yyyy-MM-ddTHH:mm:ss" in the account time zone.
 * M12 adds `urgent` (declared by hand until types.gen.ts is regenerated; optional so older answers still fit).
 */
export type ReminderOccurrence = components['schemas']['ReminderOccurrence'] & { urgent?: boolean };

/** M12 reminder types: LOCATION joins ABSOLUTE / RELATIVE. */
export type ReminderType = 'ABSOLUTE' | 'RELATIVE' | 'LOCATION';

/** Item of GET /api/v1/tasks/{id}/reminders (spec 12.8) plus the M12 fields (hand-written until regeneration). */
export type ReminderResponse = Omit<components['schemas']['ReminderResponse'], 'type'> & {
  type: ReminderType;
  locationId?: string | null;
  locationTrigger?: LocationTrigger | null;
  urgent?: boolean;
};

/** Body of POST /api/v1/tasks/{id}/reminders. */
export type CreateReminderRequest =
  | { type: 'ABSOLUTE'; at: string; urgent?: boolean }
  | { type: 'RELATIVE'; minuteOffset: number; urgent?: boolean }
  | { type: 'LOCATION'; locationId: string; trigger: LocationTrigger };

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
    ...(item.urgent ? { urgent: true } : {}),
  };
}

export async function fetchUpcomingReminders(): Promise<OccurrenceInput[]> {
  const items = await remindersApi.upcoming();
  return items.map(toOccurrenceInput);
}

export function toCreateRequest(draft: ReminderDraft): CreateReminderRequest {
  switch (draft.type) {
    case 'ABSOLUTE':
      return draft.urgent ? { type: 'ABSOLUTE', at: draft.at, urgent: true } : { type: 'ABSOLUTE', at: draft.at };
    case 'RELATIVE':
      return draft.urgent
        ? { type: 'RELATIVE', minuteOffset: draft.minuteOffset, urgent: true }
        : { type: 'RELATIVE', minuteOffset: draft.minuteOffset };
    case 'LOCATION':
      return { type: 'LOCATION', locationId: draft.locationId, trigger: draft.trigger };
  }
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
