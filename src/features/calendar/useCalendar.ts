import { useQuery } from '@tanstack/react-query';
import { calendarApi } from '../../api/calendar';
import { useSession } from '../auth/session';

export const calendarKeys = {
  all: ['calendar'] as const,
  status: ['calendar', 'status'] as const,
  events: (from: string, to: string) => ['calendar', 'events', from, to] as const,
};

/** Spec M13b: the events window of GET calendar/events is at most 31 days (from and to both counted: 30 days apart). */
export const EVENTS_MAX_SPAN_DAYS = 30;

/** GET me/calendar: connection status of the Calendar settings page and the switch for the event blocks. */
export function useCalendarStatus() {
  const { status } = useSession();
  return useQuery({
    queryKey: calendarKeys.status,
    queryFn: calendarApi.status,
    enabled: status === 'signedIn',
    staleTime: 30_000,
  });
}

/**
 * GET calendar/events for the day range [from, to] (read-only events of the connected calendar). Asks nothing until the
 * status says a calendar is connected, shown and still authorised, so users without a calendar cost no extra request.
 */
export function useCalendarEvents(from: string, to: string) {
  const status = useCalendarStatus();
  const active = status.data?.connected === true && status.data.showEvents && !status.data.needsReauth;
  const query = useQuery({
    queryKey: calendarKeys.events(from, to),
    queryFn: () => calendarApi.events(from, to),
    enabled: active,
    staleTime: 60_000,
  });
  return { events: active ? (query.data?.items ?? []) : [], query };
}
