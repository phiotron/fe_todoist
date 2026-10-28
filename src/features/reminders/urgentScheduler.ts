import type { TasklyAndroidModule } from '../../lib/native/tasklyAndroid';
import type { ReminderRequest, ReminderScheduler, ScheduledReminder } from './types';

/**
 * M12 urgent reminders. Requests marked `urgent` (only on the device chosen in Settings → Reminders) go to the native
 * alarm of the TasklyAndroid module (AlarmManager → full-screen notification that rings until Stop); every other
 * request, and urgent ones when the module is missing (Expo Go, tests), go to the base expo-notifications scheduler,
 * which puts urgent ones on the "urgent" channel. A request that moves between the two is removed from the other side
 * first, so it never rings twice. `native` is read at call time (the module may be installed after this is created).
 */
export function createUrgentAwareScheduler(
  base: ReminderScheduler,
  native: () => TasklyAndroidModule | null,
): ReminderScheduler {
  return {
    async listScheduled(): Promise<ScheduledReminder[]> {
      const fromBase = await base.listScheduled();
      const alarms = native();
      if (!alarms) return fromBase;
      const urgent = await alarms.listUrgentAlarms();
      return [
        ...fromBase,
        ...urgent.map((alarm) => ({ id: alarm.id, taskId: alarm.taskId, kind: null, signature: alarm.signature })),
      ];
    },

    async schedule(request: ReminderRequest): Promise<void> {
      const alarms = native();
      if (request.urgent && alarms) {
        await base.cancel(request.id);
        await alarms.scheduleUrgentAlarm({
          id: request.id,
          taskId: request.taskId,
          fireAtMs: request.fireAtMs,
          title: request.title,
          body: request.body,
          signature: request.signature,
        });
        return;
      }
      if (alarms) await alarms.cancelUrgentAlarm(request.id);
      await base.schedule(request);
    },

    async cancel(id: string): Promise<void> {
      await base.cancel(id);
      await native()?.cancelUrgentAlarm(id);
    },

    async cancelAll(): Promise<void> {
      await base.cancelAll();
      const alarms = native();
      if (!alarms) return;
      for (const alarm of await alarms.listUrgentAlarms()) await alarms.cancelUrgentAlarm(alarm.id);
    },
  };
}
