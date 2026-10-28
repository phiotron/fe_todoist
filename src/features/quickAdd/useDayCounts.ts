import { skipToken, useQuery } from '@tanstack/react-query';
import { dayCountsApi, dayCountsQueryKey } from '../../api/dayCounts';

/** First and last day of the month containing `day` (yyyy-MM-dd): ≤ 31 days, inside the 62-day limit. */
export function monthRange(day: string): { from: string; to: string } {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${day.slice(0, 7)}-01`, to: `${day.slice(0, 7)}-${String(last).padStart(2, '0')}` };
}

/**
 * Open tasks per day of one month for the Date sheet calendar (GET tasks/day-counts, M6b). Empty while loading, offline
 * or on error: the calendar still works without numbers.
 */
export function useDayCounts(month: string, enabled: boolean): Record<string, number> {
  const { from, to } = monthRange(month);
  const query = useQuery({
    queryKey: dayCountsQueryKey(from, to),
    queryFn: enabled ? () => dayCountsApi.get(from, to) : skipToken,
    staleTime: 30_000,
  });
  return query.data?.counts ?? {};
}
