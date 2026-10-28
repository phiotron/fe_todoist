import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getReminderPlatform } from './platform';

export interface ExactAlarmGrantState {
  /** true while the system has not allowed exact alarms (false while unknown). */
  needed: boolean;
  refresh(): Promise<void>;
  /** Opens the system page where the user allows it, then re-reads the answer when the user comes back. */
  openSettings(): Promise<void>;
}

/** Whether Settings should explain the "Alarms & reminders" switch; re-read when the app comes back to the front. */
export function useExactAlarmGrant(): ExactAlarmGrantState {
  const [needed, setNeeded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setNeeded(await getReminderPlatform().needsExactAlarmGrant());
    } catch {
      setNeeded(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const openSettings = useCallback(async () => {
    await getReminderPlatform().openExactAlarmSettings();
    await refresh();
  }, [refresh]);

  return { needed, refresh, openSettings };
}
