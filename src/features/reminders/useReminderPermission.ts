import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getReminderPlatform } from './platform';
import type { ReminderPermission } from './types';

export interface ReminderPermissionState {
  /** null while unknown. */
  state: ReminderPermission | null;
  request(): Promise<ReminderPermission | null>;
  refresh(): Promise<void>;
}

/** Notification permission, re-read when the app comes back (the user may have changed it in system settings). */
export function useReminderPermission(): ReminderPermissionState {
  const [state, setState] = useState<ReminderPermission | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await getReminderPlatform().getPermission());
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const request = useCallback(async () => {
    try {
      const next = await getReminderPlatform().requestPermission();
      setState(next);
      return next;
    } catch {
      await refresh();
      return null;
    }
  }, [refresh]);

  return { state, request, refresh };
}
