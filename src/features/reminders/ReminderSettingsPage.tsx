import { router } from 'expo-router';
import { useCallback } from 'react';
import { describeError } from '../../api/describeError';
import { useSnackbar } from '../../components/Snackbar';
import { useSettings } from '../settings/useSettings';
import { ReminderSettingsScreen, type ReminderSettingsValues } from './ReminderSettingsScreen';

/** Settings → Reminders: ReminderSettingsScreen wired to me/settings (M3 settings source). */
export function ReminderSettingsPage() {
  const { data, update } = useSettings();
  const snackbar = useSnackbar();
  const onSave = useCallback(
    async (patch: ReminderSettingsValues) => {
      try {
        await update(patch);
      } catch (error) {
        snackbar.show({ message: describeError(error).message, tone: 'error' });
        throw error; // nothing was saved: the screen skips the reminder sync
      }
    },
    [update, snackbar],
  );
  const settings = data ? { remindersEnabled: data.remindersEnabled, autoReminderMinutes: data.autoReminderMinutes } : null;
  return <ReminderSettingsScreen settings={settings} onSave={onSave} onBack={() => router.back()} />;
}
