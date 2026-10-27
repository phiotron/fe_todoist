import { emptyStored, type AppSettings, type StoredSettings } from '../features/settings/settingsModel';
import type { SettingsStorage } from '../features/settings/settingsStore';

export interface MemorySettingsStorage extends SettingsStorage {
  /** What the provider last saved (or the initial value). */
  current(): StoredSettings | null;
}

export function memorySettingsStorage(initial: StoredSettings | null = null): MemorySettingsStorage {
  let value = initial;
  return {
    load: async (fallback: AppSettings) => value ?? emptyStored(fallback),
    save: async (next: StoredSettings) => {
      value = next;
    },
    current: () => value,
  };
}
