import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  DEFAULT_DEVICE_SETTINGS,
  DEVICE_SETTINGS_KEY,
  getDeviceSettings,
  loadDeviceSettings,
  resetDeviceSettingsForTests,
  setDeviceSettings,
  useDeviceSettings,
} from '../deviceSettings';
import { DEVICE_ID_STORAGE_KEY, getDeviceId, resetDeviceIdForTests } from '../deviceId';

describe('device id', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetDeviceIdForTests();
  });

  it('creates a UUID once and keeps it', async () => {
    const first = await getDeviceId();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY)).toBe(first);
    resetDeviceIdForTests();
    expect(await getDeviceId()).toBe(first);
  });

  it('two callers at once get the same id', async () => {
    const [a, b] = await Promise.all([getDeviceId(), getDeviceId()]);

    expect(a).toBe(b);
  });
});

describe('device settings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetDeviceSettingsForTests();
  });

  it('starts with the defaults: tone on, Dynamic Color off, default icon', () => {
    expect(getDeviceSettings()).toEqual(DEFAULT_DEVICE_SETTINGS);
    expect(DEFAULT_DEVICE_SETTINGS).toMatchObject({ completionTone: true, dynamicColor: false, appIcon: 'default' });
  });

  it('saves a change and reads it back after a restart', async () => {
    await setDeviceSettings({ completionTone: false, appIcon: 'dark' });
    resetDeviceSettingsForTests();
    expect(getDeviceSettings().completionTone).toBe(true);

    await loadDeviceSettings();

    expect(getDeviceSettings()).toMatchObject({ completionTone: false, appIcon: 'dark', dynamicColor: false });
  });

  it('ignores stored values of the wrong type and unreadable storage', async () => {
    await AsyncStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify({ completionTone: 'no', dynamicColor: true, appIcon: 5 }));
    await loadDeviceSettings();
    expect(getDeviceSettings()).toMatchObject({ completionTone: true, dynamicColor: true, appIcon: 'default' });

    resetDeviceSettingsForTests();
    await AsyncStorage.setItem(DEVICE_SETTINGS_KEY, '{broken');
    await loadDeviceSettings();
    expect(getDeviceSettings()).toEqual(DEFAULT_DEVICE_SETTINGS);
  });

  it('the hook follows changes and loads the stored values', async () => {
    await AsyncStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify({ dynamicColor: true }));
    const { result } = await renderHook(() => useDeviceSettings());

    await waitFor(() => expect(result.current.dynamicColor).toBe(true));
    await act(async () => {
      await setDeviceSettings({ completionTone: false });
    });

    expect(result.current.completionTone).toBe(false);
  });
});
