import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/errors';
import { tasksApi } from '../../api/tasks';
import { useDataMutation } from '../../lib/useDataMutation';
import { getReminderPlatform, type ReminderPlatform, type ReminderTap } from './platform';
import { SNOOZE_MINUTES, scheduleSnooze } from './snooze';
import { errorName, warnLog } from './syncReminders';

export interface UseReminderResponsesOptions {
  /** Defaults to the installed platform. */
  platform?: ReminderPlatform;
  now?: () => number;
  /** M12: me/settings.snoozeMinutes (default 15). */
  snoozeMinutes?: number;
  /** M12: me/settings.pinReminders — the snoozed notification is pinned too. */
  pinReminders?: boolean;
}

/**
 * What happens when the user acts on a reminder (spec 5.8): tap → task detail; Snooze → again in N minutes (M12
 * setting, default 15) on
 * this device; Complete → close the task. Both buttons open the app first (opensAppToForeground), so this also
 * handles the response that launched the app. A failed Complete (offline, server error) opens the task instead.
 */
export function useReminderResponses(options: UseReminderResponsesOptions = {}): void {
  const router = useRouter();
  const { t } = useTranslation();
  const close = useDataMutation((taskId: string) => tasksApi.close(taskId));

  const platform = options.platform ?? getReminderPlatform();
  const snooze = { minutes: options.snoozeMinutes ?? SNOOZE_MINUTES, pinned: options.pinReminders === true };
  const latest = useRef({ router, t, closeTask: close.mutateAsync, platform, now: options.now ?? Date.now, snooze });
  useEffect(() => {
    latest.current = { router, t, closeTask: close.mutateAsync, platform, now: options.now ?? Date.now, snooze };
  });

  useEffect(() => {
    const handle = async (tap: ReminderTap) => {
      const current = latest.current;
      const openTask = () => current.router.push(`/task/${tap.taskId}`);
      if (tap.action === 'open') {
        openTask();
        return;
      }
      if (tap.action === 'snooze') {
        try {
          const { minutes, pinned } = current.snooze;
          await scheduleSnooze(
            current.platform.scheduler,
            {
              taskId: tap.taskId,
              title: tap.title,
              body: current.t('reminders.notification.snoozedBody', { count: minutes }),
            },
            current.now(),
            minutes,
            pinned,
          );
        } catch (error) {
          warnLog(`snooze failed for task ${tap.taskId}: ${errorName(error)}`);
          openTask();
          return;
        }
        await current.platform.dismiss(tap.notificationId);
        return;
      }
      try {
        await current.closeTask(tap.taskId);
        await current.platform.dismiss(tap.notificationId);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          await current.platform.dismiss(tap.notificationId);
          return;
        }
        openTask();
      }
    };

    const launchedWith = platform.takeLastTap();
    if (launchedWith) void handle(launchedWith);
    return platform.addTapListener((tap) => void handle(tap));
  }, [platform]);
}
