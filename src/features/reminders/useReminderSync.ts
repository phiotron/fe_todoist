import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';
import { fetchTaskState, fetchUpcomingReminders } from '../../api/reminders';
import { getReminderPlatform, type ReminderActionLabels } from './platform';
import type { ReminderRuntimeSettings } from './reminderSettings';
import { runReminderSync, type ReminderLabels, type ReminderSyncDeps } from './runReminderSync';
import { createSerialRunner } from './serialRunner';
import { errorName, warnLog } from './syncReminders';
import { onReminderSyncRequested } from './syncSignal';
import type { ReminderPermission } from './types';

export interface ReminderRuntimeDeps extends ReminderSyncDeps {
  ensureChannel: (name: string) => Promise<void>;
  configureActions: (labels: ReminderActionLabels) => Promise<void>;
  requestPermission: () => Promise<ReminderPermission>;
}

/** Dependencies backed by the installed notification platform (read at call time, so install order does not matter). */
export const defaultReminderRuntimeDeps: ReminderRuntimeDeps = {
  get scheduler() {
    return getReminderPlatform().scheduler;
  },
  fetchOccurrences: fetchUpcomingReminders,
  fetchTaskState,
  getPermission: () => getReminderPlatform().getPermission(),
  requestPermission: () => getReminderPlatform().requestPermission(),
  ensureChannel: (name) => getReminderPlatform().ensureChannel(name),
  configureActions: (labels) => getReminderPlatform().configureActions(labels),
  now: () => Date.now(),
};

/** Successful writes within this window collapse into one sync. */
export const WRITE_DEBOUNCE_MS = 800;

export interface UseReminderSyncOptions {
  deps?: ReminderRuntimeDeps;
  debounceMs?: number;
}

/**
 * Keeps the device schedule in line with the server (spec 5.8): on mount (app open / sign-in), when the app
 * comes back to the foreground, after every successful write (any mutation), when the reminder settings, the
 * time zone or the language change, and on requestReminderSync(). Runs are serialised; failures are logged and
 * retried on the next trigger.
 */
export function useReminderSync(settings: ReminderRuntimeSettings | null, options: UseReminderSyncOptions = {}): void {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const deps = options.deps ?? defaultReminderRuntimeDeps;
  const debounceMs = options.debounceMs ?? WRITE_DEBOUNCE_MS;

  const labels: ReminderLabels = useMemo(
    () => ({
      dueSoon: t('reminders.notification.dueSoonBody'),
      reminder: t('reminders.notification.reminderBody'),
    }),
    [t],
  );

  // Latest inputs for the runner; updated before any trigger effect below runs.
  const latest = useRef({ settings, deps, labels });
  useEffect(() => {
    latest.current = { settings, deps, labels };
  });

  const runner = useMemo(
    () =>
      createSerialRunner(async () => {
        const current = latest.current;
        if (!current.settings) return;
        await runReminderSync(current.settings, current.labels, current.deps);
      }),
    [],
  );

  // Settings, time zone or language changed (and the first time settings are known).
  const key = settings
    ? `${settings.enabled}|${settings.timeZone}|${settings.autoReminderMinutes}|${i18n.language}`
    : null;
  useEffect(() => {
    if (key !== null) void runner.run();
  }, [key, runner]);

  // Channel first (Android 13+ shows the prompt only once a channel exists), buttons, then ask once if undetermined.
  const enabled = settings?.enabled ?? false;
  const channelName = t('reminders.channelName');
  const snoozeLabel = t('reminders.notification.snoozeAction');
  const completeLabel = t('reminders.notification.completeAction');
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      const current = latest.current.deps;
      try {
        await current.ensureChannel(channelName);
        await current.configureActions({ snooze: snoozeLabel, complete: completeLabel });
        const permission = await current.getPermission();
        if (permission.granted || permission.status !== 'undetermined' || !permission.canAskAgain) return;
        const answer = await current.requestPermission();
        if (active && answer.granted) void runner.run();
      } catch (error) {
        (current.log ?? warnLog)(`reminder permission setup failed: ${errorName(error)}`);
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled, channelName, snoozeLabel, completeLabel, runner]);

  // Back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runner.run();
    });
    return () => subscription.remove();
  }, [runner]);

  // After every successful write on this device.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'success') {
        clearTimeout(timer);
        timer = setTimeout(() => void runner.run(), debounceMs);
      }
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [queryClient, runner, debounceMs]);

  // Explicit requests (permission granted, settings saved, Quick Add reminders created).
  useEffect(() => onReminderSyncRequested(() => void runner.run()), [runner]);
}
