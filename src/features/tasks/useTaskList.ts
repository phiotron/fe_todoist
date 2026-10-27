import type { Task, TaskListParams } from '../../api/models';
import { queryKeys } from '../../api/queryKeys';
import { tasksApi } from '../../api/tasks';
import { usePagedList } from '../../lib/usePagedList';

const taskId = (task: Task) => task.id;

/** One paged task list (a view, a project, or completed tasks); `tasks` = all loaded pages, de-duplicated. */
export function useTaskList(params: TaskListParams) {
  const { query, items } = usePagedList(queryKeys.tasks.list(params), (cursor) => tasksApi.list(params, cursor), taskId);
  return { query, tasks: items };
}
