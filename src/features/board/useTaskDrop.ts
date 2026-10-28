import { useCallback } from 'react';
import { describeError } from '../../api/describeError';
import type { TaskBatchRequest, UpdateTaskRequest } from '../../api/models';
import { useSnackbar } from '../../components/Snackbar';
import { useTaskBatch, useUpdateTask } from '../tasks/useTaskActions';

/**
 * M7: what a drop sends. A column / day drop = ONE `tasks/batch` (MOVE / SCHEDULE / PRIORITY, always with an
 * Idempotency-Key, spec 12.5); a time-slot drop = PATCH with the task's version (409 when stale). Lists refresh
 * through useDataMutation; a failure is toasted (the dragged card simply stays where the server keeps it).
 */
export function useTaskDrop() {
  const snackbar = useSnackbar();
  const batch = useTaskBatch();
  const update = useUpdateTask();
  const runBatch = batch.mutateAsync;
  const runUpdate = update.mutateAsync;

  const fail = useCallback(
    (error: unknown) => snackbar.show({ message: describeError(error).message, tone: 'error' }),
    [snackbar],
  );

  const sendBatch = useCallback(
    (body: TaskBatchRequest) => runBatch(body).then(() => undefined, fail),
    [runBatch, fail],
  );
  const sendUpdate = useCallback(
    (taskId: string, body: UpdateTaskRequest) => runUpdate({ taskId, body }).then(() => undefined, fail),
    [runUpdate, fail],
  );

  return { sendBatch, sendUpdate, pending: batch.isPending || update.isPending };
}
