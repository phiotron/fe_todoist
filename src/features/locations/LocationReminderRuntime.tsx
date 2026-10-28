import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { locationsApi } from '../../api/locations';
import { useSession } from '../auth/session';
import { maxGeofences, planGeofences, planSignature } from './geofencePlan';
import { getGeofencePlatform, type GeofencePlatform } from './geofencePlatform';

/** Under the "tasks" root, so every write (complete, delete, move, new reminder) refreshes it. */
export const locationRemindersKey = ['tasks', 'location-reminders'] as const;

/** `lastApplied` while geofencing is stopped (signed out / reminders off): never equals a plan signature ('' = empty plan). */
const STOPPED = '<stopped>';

export interface UseLocationReminderSyncOptions {
  /** Defaults to the installed platform. */
  platform?: GeofencePlatform;
}

/**
 * Keeps the registered geofences equal to GET tasks/location-reminders (M12): reminders off or signed out → none.
 * The location permission is requested once, when there is at least one region to watch; without it nothing is
 * registered (Settings › Places explains how to allow it). Failures are swallowed and retried on the next change.
 */
export function useLocationReminderSync(enabled: boolean, options: UseLocationReminderSyncOptions = {}): void {
  const { status } = useSession();
  const signedIn = status === 'signedIn';
  const platform = options.platform ?? getGeofencePlatform();
  const query = useQuery({
    queryKey: locationRemindersKey,
    queryFn: locationsApi.reminders,
    enabled: signedIn && enabled,
  });
  const lastApplied = useRef<string | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!signedIn || !enabled) {
          if (lastApplied.current !== STOPPED) await platform.stop();
          lastApplied.current = STOPPED;
          return;
        }
        if (!query.data) return; // not loaded yet (or offline): keep what is registered
        const plan = planGeofences(query.data, true, maxGeofences(Platform.OS));
        const signature = planSignature(plan);
        if (signature === lastApplied.current) return;
        if (plan.regions.length > 0) {
          let permission = await platform.getPermission();
          if (permission === 'denied' && !asked.current) {
            asked.current = true;
            permission = await platform.requestPermission();
          }
          if (permission === 'denied') return;
        }
        if (!active) return;
        await platform.apply(plan);
        lastApplied.current = signature;
      } catch {
        // retried when the data changes or the app restarts
      }
    })();
    return () => {
      active = false;
    };
  }, [signedIn, enabled, query.data, platform]);
}

/** Mounted next to ReminderRuntime; renders nothing. */
export function LocationReminderRuntime({ enabled }: { enabled: boolean }) {
  useLocationReminderSync(enabled);
  return null;
}
