import { router, useLocalSearchParams } from 'expo-router';
import { AlarmScreen } from '../../../features/reminders/AlarmScreen';
import { toReminderRuntimeSettings } from '../../../features/reminders/reminderSettings';
import { useSettings } from '../../../features/settings/useSettings';

/** Target of `taskly://alarm/<taskId>` (urgent reminder, full-screen notification). */
export default function AlarmRoute() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const { data } = useSettings();
  const settings = data ? toReminderRuntimeSettings(data) : null;
  return (
    <AlarmScreen
      taskId={String(taskId)}
      snoozeMinutes={settings?.snoozeMinutes}
      pinReminders={settings?.pinReminders}
      onDone={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
    />
  );
}
