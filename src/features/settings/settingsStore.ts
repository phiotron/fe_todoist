import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyStored, parseStoredSettings, type AppSettings, type StoredSettings } from './settingsModel';

export const SETTINGS_STORAGE_KEY = 'taskly.settings';

export interface SettingsStorage {
  load(fallback: AppSettings): Promise<StoredSettings>;
  save(value: StoredSettings): Promise<void>;
}

/** Device cache of the settings; best effort, never throws (a broken disk must not block the app). */
export const settingsStore: SettingsStorage = {
  async load(fallback) {
    try {
      return parseStoredSettings(await AsyncStorage.getItem(SETTINGS_STORAGE_KEY), fallback);
    } catch {
      return emptyStored(fallback);
    }
  },
  async save(value) {
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Ignored: the in-memory settings stay correct for this run.
    }
  },
};
