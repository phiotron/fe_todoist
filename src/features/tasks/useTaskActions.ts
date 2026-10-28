import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../../api/describeError';
import type {
  CloseTaskRequest,
  CreateTaskRequest,
  MoveTaskRequest,
  Task,
  TaskBatchRequest,
  TaskChangeResponse,
  UpdateTaskRequest,
} from '../../api/models';
import { reorderApi } from '../../api/reorder';
import { queryKeys } from '../../api/queryKeys';
import { applyTaskChange } from '../../api/taskCache';
import { tasksApi } from '../../api/tasks';
import { useSnackbar } from '../../components/Snackbar';
import { taskDateKey } from '../../lib/dates';
import { formatDateKey } from '../../lib/dates/format';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { useDataMutation } from '../../lib/useDataMutation';

/**
 * Spec 3.1: close / reopen bump `version` of the task AND of every cascaded task, and answer with all of them
 * (`cascaded`). Write the answer into the caches at once (`applyTaskChange`); `useDataMutation` then refreshes the lists.
 */
export function useCloseTask() {
  const queryClient = useQueryClient();
  return useDataMutation(async (arg: string | { taskId: string; body?: CloseTaskRequest }) => {
    const { taskId, body } = typeof arg === 'string' ? { taskId: arg, body: undefined } : arg;
    // M6c: a repeating task is NOT completed by a plain close — it moves to its next due (answer: completedAt null).
    const change = await tasksApi.close(taskId, body);
    applyTaskChange(queryClient, change);
    return change;
  });
}

/** `undo: true` = Undo of a completion: reopens the task and the descendants of the same completion batch (spec 5.1). */
export function useReopenTask() {
  const queryClient = useQueryClient();
  return useDataMutation(async ({ taskId, undo = false }: { taskId: string; undo?: boolean }) => {
    const change = await tasksApi.reopen(taskId, undo);
    applyTaskChange(queryClient, change);
    return change;
  });
}

/** Permanent. 409 `project-archived` / `section-archived` when the task sits in an archived project / section (spec 12.10): the UI hides Delete when read-only. */
export const useDeleteTask = () => useDataMutation((taskId: string) => tasksApi.remove(taskId));

export const useCreateTask = () =>
  useDataMutation(({ body, idempotencyKey }: { body: CreateTaskRequest; idempotencyKey: string }) =>
    tasksApi.create(body, idempotencyKey),
  );

export const useUpdateTask = () =>
  useDataMutation(({ taskId, body }: { taskId: string; body: UpdateTaskRequest }) => tasksApi.update(taskId, body));

/**
 * `move` bumps the `version` of the MOVED task only (its subtree follows by native UPDATE, spec 5.6) and answers with it:
 * write the answer into the detail cache so the open detail screen edits against the new version. `afterId` absent = last
 * of the new container, null = first. Source in an archived project / section → 409; target archived → 422 `target-archived`.
 */
export function useMoveTask() {
  const queryClient = useQueryClient();
  return useDataMutation(async ({ taskId, body }: { taskId: string; body: MoveTaskRequest }) => {
    const moved = await tasksApi.move(taskId, body);
    queryClient.setQueryData(queryKeys.tasks.detail(taskId), moved);
    return moved;
  });
}

export const useDuplicateTask = () =>
  useDataMutation(({ taskId, idempotencyKey }: { taskId: string; idempotencyKey: string }) =>
    tasksApi.duplicate(taskId, idempotencyKey),
  );

/**
 * Root tasks of one block, or subtasks of one parent (spec 12.4: same container only). `afterId` is always sent (null =
 * first); `reorder` does not change `version`, so the open task detail is not refreshed (`keepDetail`).
 */
export const useReorderTask = () =>
  useDataMutation(
    ({ id, afterId }: { id: string; afterId: string | null }) => reorderApi.reorder({ type: 'TASK', id, afterId }),
    { keepDetail: true },
  );

/**
 * One request for a whole selection (spec 12.5), ALWAYS with an `Idempotency-Key` (spec 12.11: MOVE / DELETE are not
 * idempotent without one). The same body after a failure / timeout reuses the key; a new body, or a success, starts a new one.
 */
export function useTaskBatch() {
  const keys = useIdempotencyKeys();
  return useDataMutation(async (body: TaskBatchRequest) => {
    const result = await tasksApi.batch(body, keys.keyFor(body));
    keys.reset();
    return result;
  });
}

/** `date` must be ≥ today (the Reschedule sheet enforces it with `minDate`; the server answers 400 otherwise). */
export const useRescheduleOverdue = () => useDataMutation((date: string) => tasksApi.rescheduleOverdue(date));

/**
 * Spec 5.1: completing shows "Đã hoàn thành · Hoàn tác" for 5 seconds; Undo reopens with undo=true (the task and the
 * descendants completed together with it). Used by the circle, swipe, the detail screen and multi-select.
 */
export function useCompleteWithUndo() {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const close = useCloseTask();
  const reopen = useReopenTask();
  const batch = useTaskBatch();
  // mutateAsync, not mutate(vars, { onSuccess }): TanStack drops per-call callbacks once the screen that started the
  // write unmounts or a later mutate replaces it, which would lose the Undo snackbar and the 404 handling.
  const closeTask = close.mutateAsync;
  const reopenTask = reopen.mutateAsync;
  const runBatch = batch.mutateAsync;
  // The component that started an Undo may be gone (selection cleared): a failure is shown where it cannot vanish.
  const showError = useCallback(
    (failure: unknown) => snackbar.show({ message: describeError(failure).message, tone: 'error' }),
    [snackbar],
  );

  /** "Completed" line of the snackbar: a repeating task that moved on says when it comes next (M6c). */
  const completedMessage = useCallback(
    (change: TaskChangeResponse, forever: boolean) => {
      const task = change.task;
      if (task.isRecurring && task.completedAt === null) {
        const day = taskDateKey(task);
        if (day) {
          return t('recurrence.completedNext', { date: formatDateKey(day, day.slice(0, 4) !== String(new Date().getFullYear())) });
        }
      }
      return forever && task.completedAt !== null ? t('recurrence.completedForever') : t('taskList.completedOne');
    },
    [t],
  );

  /**
   * `forever` (Complete forever) and `resetSubtasks` (Complete & reset sub-tasks) only matter for a repeating task; without
   * them the call is a plain close (the server then follows the `resetSubtasks` setting). Undo is the same in every case.
   */
  const complete = useCallback(
    (taskId: string, options: { onError?: (error: unknown) => void; forever?: boolean; resetSubtasks?: boolean } = {}) => {
      const body: CloseTaskRequest = {};
      if (options.forever) body.forever = true;
      if (options.resetSubtasks !== undefined) body.resetSubtasks = options.resetSubtasks;
      closeTask(Object.keys(body).length > 0 ? { taskId, body } : taskId).then(
        (change) =>
          snackbar.show({
            message: completedMessage(change, options.forever === true),
            actionLabel: t('common.undo'),
            onAction: () => {
              reopenTask({ taskId, undo: true }).catch(showError);
            },
          }),
        (failure: unknown) => options.onError?.(failure),
      );
    },
    [closeTask, completedMessage, reopenTask, showError, snackbar, t],
  );

  const completeMany = useCallback(
    (taskIds: string[], options: { onSuccess?: () => void } = {}) => {
      runBatch({ action: 'CLOSE', taskIds }).then(
        () => {
          options.onSuccess?.();
          snackbar.show({
            message: t('taskList.completedMany', { n: taskIds.length }),
            actionLabel: t('common.undo'),
            onAction: () => {
              runBatch({ action: 'REOPEN', taskIds, undo: true }).catch(showError);
            },
          });
        },
        // Per call, not from the shared observer: a later mutate (e.g. an Undo) moves batch.error to that newer mutation.
        showError,
      );
    },
    [runBatch, showError, snackbar, t],
  );

  // Only the single close shown inline; every bulk / Undo failure is reported per call through showError (snackbar).
  const error = close.error;
  return {
    complete,
    completeMany,
    pendingId: close.isPending ? close.variables : undefined,
    batchPending: batch.isPending,
    errorMessage: error ? describeError(error).message : undefined,
  };
}

/** Circle / swipe: complete an open task (with Undo), reopen a completed one (plain reopen). */
export function useToggleTask() {
  const { complete, pendingId, errorMessage } = useCompleteWithUndo();
  const reopen = useReopenTask();
  const reopenTask = reopen.mutate;
  const toggle = useCallback(
    (task: Task) => (task.completedAt ? reopenTask({ taskId: task.id }) : complete(task.id)),
    [complete, reopenTask],
  );
  const reopenError = reopen.error ? describeError(reopen.error).message : undefined;
  return {
    toggle,
    pendingId: pendingId ?? (reopen.isPending ? reopen.variables?.taskId : undefined),
    errorMessage: errorMessage ?? reopenError,
  };
}
