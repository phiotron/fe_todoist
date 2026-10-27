import { useQuery } from '@tanstack/react-query';
import type { Task } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { tasksApi } from '../../../api/tasks';
import { useTask } from './useTask';

/** Every descendant of a task (completed ones too), not paged (spec 12.3); the section shows the direct children. */
export function useSubtasks(taskId: string) {
  return useQuery({ queryKey: queryKeys.tasks.subtasks(taskId), queryFn: () => tasksApi.subtasks(taskId) });
}

/**
 * Level of a task from its parent chain (root = 1; at most three parent requests, shared with the detail cache).
 * `undefined` while the chain is still loading: the UI then allows adding and lets the server enforce 4 levels (400).
 */
export function useTaskDepth(task: Task | undefined): number | undefined {
  const parent = useTask(task?.parentId);
  const grandparent = useTask(parent.data?.parentId);
  const greatGrandparent = useTask(grandparent.data?.parentId);
  if (!task) return undefined;
  if (!task.parentId) return 1;
  if (!parent.data) return undefined;
  if (!parent.data.parentId) return 2;
  if (!grandparent.data) return undefined;
  if (!grandparent.data.parentId) return 3;
  if (!greatGrandparent.data) return undefined;
  return 4;
}
