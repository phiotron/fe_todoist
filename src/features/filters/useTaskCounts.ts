import { useQuery } from '@tanstack/react-query';
import { filterCountsQueryKey, labelCountsQueryKey, taskCountsApi } from '../../api/taskCounts';

const NONE: Readonly<Record<string, number>> = {};

/**
 * Open-task count of every label and filter (the number at the right of each Filters & Labels row). One request each;
 * offline or on error the rows simply show no number.
 */
export function useTaskCounts() {
  const labels = useQuery({ queryKey: labelCountsQueryKey, queryFn: taskCountsApi.labels });
  const filters = useQuery({ queryKey: filterCountsQueryKey, queryFn: taskCountsApi.filters });
  return { labelCounts: labels.data?.byId ?? NONE, filterCounts: filters.data?.byId ?? NONE };
}
