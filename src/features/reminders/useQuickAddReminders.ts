import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { remindersApi, toCreateRequest } from '../../api/reminders';
import { addDraft, applicableDrafts, draftId, type ReminderDraft } from '../../lib/reminders';
import { newUuid } from '../../lib/uuid';
import { requestReminderSync } from './syncSignal';

/**
 * Reminders chosen in Quick Add before the task exists (spec 9.2): drafts on the device, created with
 * POST tasks/{id}/reminders once POST tasks succeeded. RELATIVE drafts disappear while the due has no time.
 */
export function useQuickAddReminders(hasTime: boolean) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<ReminderDraft[]>([]);
  const [error, setError] = useState<string | undefined>();
  const effective = useMemo(() => applicableDrafts(drafts, hasTime), [drafts, hasTime]);

  const add = useCallback((draft: ReminderDraft) => {
    setError(undefined);
    setDrafts((previous) => addDraft(previous, draft));
  }, []);

  const remove = useCallback((id: string) => {
    setDrafts((previous) => previous.filter((draft) => draftId(draft) !== id));
  }, []);

  const reset = useCallback(() => {
    setDrafts([]);
    setError(undefined);
  }, []);

  /** After the task was created: one POST per draft (each its own Idempotency-Key), then clear the drafts. Never throws. */
  const attach = useCallback(
    async (taskId: string): Promise<void> => {
      setError(undefined);
      let createdCount = 0;
      let failedCount = 0;
      for (const draft of effective) {
        try {
          await remindersApi.create(taskId, toCreateRequest(draft), newUuid());
          createdCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      setDrafts([]);
      if (createdCount > 0) requestReminderSync();
      if (failedCount > 0) setError(t('reminders.quickAdd.partialFailure', { count: failedCount }));
    },
    [effective, t],
  );

  return { drafts: effective, add, remove, reset, attach, error };
}

export type QuickAddReminders = ReturnType<typeof useQuickAddReminders>;
