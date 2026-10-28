import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { newUuid } from '../uuid';

/**
 * M12 — install id of this device (random UUID, created once, kept in AsyncStorage; reinstalling the app makes a new
 * one). me/settings.urgentDeviceId stores it to say which device rings urgent reminders. Not a hardware id.
 */
export const DEVICE_ID_STORAGE_KEY = 'taskly.deviceId';

let cached: string | null = null;
let pending: Promise<string> | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  if (!pending) {
    pending = (async () => {
      let id: string | null = null;
      try {
        id = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
      } catch {
        id = null;
      }
      if (!id) {
        id = newUuid();
        try {
          await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
        } catch {
          // keep it for this run; a new one is made next start
        }
      }
      cached = id;
      return id;
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}

/** null until read. */
export function useDeviceId(): string | null {
  const [id, setId] = useState<string | null>(cached);
  useEffect(() => {
    let active = true;
    void getDeviceId().then((value) => {
      if (active) setId(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return id;
}

/** Tests only. */
export function resetDeviceIdForTests(): void {
  cached = null;
  pending = null;
}
