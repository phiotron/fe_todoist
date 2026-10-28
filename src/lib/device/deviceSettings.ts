import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * M12 — settings that belong to this device only (Todoist keeps them per device too): the task complete tone, Dynamic
 * Color and the chosen app icon. Kept in AsyncStorage, not in me/settings (they would make no sense on another phone).
 * A tiny external store so the theme and the completion code read the current value without a provider.
 */
export interface DeviceSettings {
  /** Short sound when a task is completed. */
  completionTone: boolean;
  /** Accent colour from the Android wallpaper (Android 12+). */
  dynamicColor: boolean;
  /** Name of the chosen launcher icon ("default" when none). */
  appIcon: string;
  /** The user confirmed "Activate custom icons". */
  customIconsActive: boolean;
}

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  completionTone: true,
  dynamicColor: false,
  appIcon: 'default',
  customIconsActive: false,
};

export const DEVICE_SETTINGS_KEY = 'taskly.deviceSettings';

let state: DeviceSettings = DEFAULT_DEVICE_SETTINGS;
let loadStarted = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getDeviceSettings(): DeviceSettings {
  return state;
}

/** Reads the stored values once (later calls do nothing). Never throws. */
export async function loadDeviceSettings(): Promise<void> {
  if (loadStarted) return;
  loadStarted = true;
  try {
    const raw = await AsyncStorage.getItem(DEVICE_SETTINGS_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<DeviceSettings>;
      state = {
        completionTone: typeof stored.completionTone === 'boolean' ? stored.completionTone : state.completionTone,
        dynamicColor: typeof stored.dynamicColor === 'boolean' ? stored.dynamicColor : state.dynamicColor,
        appIcon: typeof stored.appIcon === 'string' ? stored.appIcon : state.appIcon,
        customIconsActive:
          typeof stored.customIconsActive === 'boolean' ? stored.customIconsActive : state.customIconsActive,
      };
      emit();
    }
  } catch {
    // keep the defaults
  }
}

export async function setDeviceSettings(patch: Partial<DeviceSettings>): Promise<void> {
  state = { ...state, ...patch };
  emit();
  try {
    await AsyncStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify(state));
  } catch {
    // applied for this run; not saved
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current device settings; loads the stored ones on first use. */
export function useDeviceSettings(): DeviceSettings {
  useEffect(() => {
    void loadDeviceSettings();
  }, []);
  return useSyncExternalStore(subscribe, getDeviceSettings, getDeviceSettings);
}

/** Tests only. */
export function resetDeviceSettingsForTests(): void {
  state = DEFAULT_DEVICE_SETTINGS;
  loadStarted = false;
  listeners.clear();
}
