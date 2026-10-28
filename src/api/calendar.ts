import { apiFetch, buildQuery } from './client';

/**
 * M13b Calendar. These types mirror the backend DTOs (CalendarStatusResponse, CalendarEventsResponse, ...) by hand: the
 * generated src/api/types.gen.ts is rebuilt from the backend at the integration step.
 */
export type CalendarProvider = 'GOOGLE' | 'OUTLOOK';

export interface CalendarStatusResponse {
  connected: boolean;
  provider: CalendarProvider | null;
  accountEmail: string | null;
  /** Show the events (read only) in Today / Upcoming. */
  showEvents: boolean;
  /** Sync tasks with a date to the separate "Taskly" calendar. */
  syncTasks: boolean;
  /** The provider revoked access: disconnect and connect again. */
  needsReauth: boolean;
  lastSyncedAt: string | null;
}

export interface ConnectCalendarResponse {
  authorizationUrl: string;
}

export interface UpdateCalendarRequest {
  showEvents?: boolean;
  syncTasks?: boolean;
}

/** Times are floating in the user's time zone (yyyy-MM-ddTHH:mm:ss) like the due times of tasks (spec 5.2). */
export interface CalendarEventResponse {
  id: string;
  title: string;
  allDay: boolean;
  startDate: string;
  /** Last day of the event (inclusive). */
  endDate: string;
  startDatetime: string | null;
  endDatetime: string | null;
  location: string | null;
}

export interface CalendarEventsResponse {
  items: CalendarEventResponse[];
  needsReauth: boolean;
}

export interface CalendarSyncResponse {
  created: number;
  updated: number;
  deleted: number;
  pulled: number;
}

export interface CalendarFeedResponse {
  url: string;
  projectId: string | null;
}

/**
 * 409 code "calendar-already-connected" (POST connect), 503 code "calendar-not-configured" | "calendar-unavailable",
 * 404 when nothing is connected (PATCH / DELETE / sync), 400 when the events window is wrong (> 31 days).
 */
export const calendarApi = {
  status: () => apiFetch<CalendarStatusResponse>('/api/v1/me/calendar'),
  connect: (provider: CalendarProvider) =>
    apiFetch<ConnectCalendarResponse>('/api/v1/me/calendar/connect', { method: 'POST', body: { provider } }),
  update: (body: UpdateCalendarRequest) =>
    apiFetch<CalendarStatusResponse>('/api/v1/me/calendar', { method: 'PATCH', body }),
  disconnect: () => apiFetch<void>('/api/v1/me/calendar', { method: 'DELETE' }),
  sync: () => apiFetch<CalendarSyncResponse>('/api/v1/me/calendar/sync', { method: 'POST' }),
  events: (from: string, to: string) =>
    apiFetch<CalendarEventsResponse>(`/api/v1/calendar/events${buildQuery({ from, to })}`),
  feed: (projectId?: string) =>
    apiFetch<CalendarFeedResponse>('/api/v1/me/calendar-feeds', { method: 'POST', body: projectId ? { projectId } : {} }),
  resetFeed: (projectId?: string) =>
    apiFetch<CalendarFeedResponse>('/api/v1/me/calendar-feeds/reset', {
      method: 'POST',
      body: projectId ? { projectId } : {},
    }),
};
