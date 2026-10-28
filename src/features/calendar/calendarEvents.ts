import type { CalendarEventResponse } from '../../api/calendar';

/** Events that touch `day` (multi-day events appear on every day they cover), all-day first, then by start time. */
export function eventsOnDay(events: readonly CalendarEventResponse[], day: string): CalendarEventResponse[] {
  return events
    .filter((event) => event.startDate <= day && day <= event.endDate)
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (a.startDatetime ?? '').localeCompare(b.startDatetime ?? '');
    });
}

/** `to`, but never more than `spanDays` after `from` (the events window of the backend is at most 31 days). */
export function clampWindowEnd(from: string, to: string, spanDays: number): string {
  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + spanDays);
  const limit = start.toISOString().slice(0, 10);
  return to < limit ? to : limit;
}
