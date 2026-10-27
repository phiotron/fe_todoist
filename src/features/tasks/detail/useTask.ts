import { skipToken, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../api/queryKeys';
import { tasksApi } from '../../../api/tasks';

/** One task (detail cache key). `undefined` id = no request (the parent chain of a root task). */
export function useTask(taskId: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(taskId ?? ''),
    queryFn: taskId ? () => tasksApi.get(taskId) : skipToken,
  });
}
