import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultSettings, emptyStored, type StoredSettings } from '../settingsModel';
import { SETTINGS_STORAGE_KEY, settingsStore } from '../settingsStore';

const fallback = defaultSettings('vi', 'Asia/Ho_Chi_Minh');
const empty: StoredSettings = emptyStored(fallback);

describe('settingsStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns the defaults when nothing is stored', async () => {
    await expect(settingsStore.load(fallback)).resolves.toEqual(empty);
  });

  it('saves under taskly.settings and loads the same value back', async () => {
    const value: StoredSettings = {
      ...empty,
      applied: { ...fallback, theme: 'KALE', locale: 'en', timeZone: 'Asia/Tokyo' },
      extra: { remindersEnabled: true },
      pending: { theme: 'TASKLY' },
      syncTheme: false,
      localTheme: { theme: 'BLUEBERRY', appearance: 'LIGHT' },
    };
    await settingsStore.save(value);
    expect(SETTINGS_STORAGE_KEY).toBe('taskly.settings');
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_STORAGE_KEY)) ?? 'null')).toEqual(value);
    await expect(settingsStore.load(fallback)).resolves.toEqual(value);
  });

  it('never throws when the storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk'));
    await expect(settingsStore.load(fallback)).resolves.toEqual(empty);
    await expect(settingsStore.save(empty)).resolves.toBeUndefined();
  });
});
