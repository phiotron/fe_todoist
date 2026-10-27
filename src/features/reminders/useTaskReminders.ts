import { useQuery } from '@tanstack/react-query';
import { describeError } from '../../api/describeError';
import { ApiError } from '../../api/errors';
import { remindersApi, toCreateRequest, type CreateReminderRequest } from '../../api/reminders';
import { useIdempotencyKeys } from '../../lib/idempotency';
import type { ReminderDraft } from '../../lib/reminders';
import { useDataMutation } from '../../lib/useDataMutation';
import { useSingleFlight } from '../../lib/useSingleFlight';

/**
 * Under the "tasks" root so every write refreshes it (removing the due time deletes RELATIVE reminders on the
 * server, spec 5.8).
 */
export const taskRemindersKey = (taskId: string) => ['tasks', 'reminders', taskId] as const;

export function useTaskReminders(taskId: string) {
  return useQuery({ queryKey: taskRemindersKey(taskId), queryFn: () => remindersApi.list(taskId) });
}

/**
 * Add / remove one reminder of a task: offline-blocked, Idempotency-Key on create, 404 on delete = removed. Both go
 * through useDataMutation, so a success also triggers the reminder sync (the runtime listens to every mutation).
 */
export function useReminderMutations(taskId: string) {
  const keys = useIdempotencyKeys();
  const { run, busy } = useSingleFlight();
  const create = useDataMutation((request: CreateReminderRequest) =>
    remindersApi.create(taskId, request, keys.keyFor(request)),
  );
  const remove = useDataMutation(async (reminderId: string) => {
    try {
      await remindersApi.remove(taskId, reminderId);
    } catch (error) {
      // Already deleted elsewhere = removed (spec 5.6).
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  });

  const add = (draft: ReminderDraft) =>
    run(async () => {
      create.reset();
      remove.reset();
      try {
        await create.mutateAsync(toCreateRequest(draft));
        keys.reset();
      } catch {
        // Shown through `error`; the same content retried reuses the key.
      }
    });

  const removeOne = (reminderId: string) =>
    run(async () => {
      create.reset();
      remove.reset();
      try {
        await remove.mutateAsync(reminderId);
      } catch {
        // Shown through `error`.
      }
    });

  const failure = create.error ?? remove.error;
  return { add, remove: removeOne, busy, error: failure ? describeError(failure).message : undefined };
}
