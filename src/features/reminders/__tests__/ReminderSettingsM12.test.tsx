import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import vi from '../../../i18n/locales/vi/reminders.json';
import { DEVICE_ID_STORAGE_KEY, resetDeviceIdForTests } from '../../../lib/device/deviceId';
import { setTasklyAndroidForTests, type TasklyAndroidModule } from '../../../lib/native/tasklyAndroid';
import { FakeReminderPlatform } from '../../../test/fakeReminderPlatform';
import { runAsPlatform } from '../../../test/runAsPlatform';
import { renderWithProviders } from '../../../test/render';
import { setReminderPlatform } from '../platform';
import { ReminderSettingsScreen, type ReminderSettingsValues } from '../ReminderSettingsScreen';
import { onReminderSyncRequested } from '../syncSignal';

const DEVICE = 'device-aaaa-1111';
const BASE: ReminderSettingsValues = { remindersEnabled: true, autoReminderMinutes: 30 };

async function setup(settings: ReminderSettingsValues = BASE, extra: { onOpenPlaces?: () => void } = {}) {
  const onSave = jest.fn().mockResolvedValue(undefined);
  await renderWithProviders(<ReminderSettingsScreen settings={settings} onSave={onSave} onBack={jest.fn()} {...extra} />);
  return { onSave };
}

describe('ReminderSettingsScreen — M12 settings', () => {
  runAsPlatform('android');
  let synced: jest.Mock;
  let unsubscribe: () => void;

  beforeEach(async () => {
    setReminderPlatform(new FakeReminderPlatform());
    resetDeviceIdForTests();
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, DEVICE);
    synced = jest.fn();
    unsubscribe = onReminderSyncRequested(synced);
  });

  afterEach(() => {
    unsubscribe();
    setReminderPlatform(null);
    setTasklyAndroidForTests(undefined);
  });

  it('shows the default snooze (15) when the server has not sent one, and saves a new choice', async () => {
    const { onSave } = await setup();

    expect(screen.getByTestId('snooze-15').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText(vi.reminders.settings.snoozeTitle)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('snooze-30'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ snoozeMinutes: 30 }));
    await waitFor(() => expect(synced).toHaveBeenCalled());
  });

  it('marks the saved snooze and shows 120 minutes as hours', async () => {
    await setup({ ...BASE, snoozeMinutes: 120 });

    expect(screen.getByTestId('snooze-120').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('snooze-15').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByText('2 giờ')).toBeOnTheScreen();
  });

  it('Pin reminders saves the flag', async () => {
    const { onSave } = await setup({ ...BASE, pinReminders: false });

    await fireEvent.press(screen.getByTestId('reminder-pin-switch'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ pinReminders: true }));
  });

  it('urgent: no device chosen → "use this device" saves this device id', async () => {
    const { onSave } = await setup({ ...BASE, urgentDeviceId: null });

    expect(screen.getByTestId('urgent-device-status')).toHaveTextContent(vi.reminders.urgent.none);
    expect(screen.queryByTestId('urgent-clear')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('urgent-use-this-device').props.accessibilityState?.disabled).toBeFalsy());

    await fireEvent.press(screen.getByTestId('urgent-use-this-device'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ urgentDeviceId: DEVICE }));
  });

  it('urgent: this device chosen → says so and can be cleared', async () => {
    const { onSave } = await setup({ ...BASE, urgentDeviceId: DEVICE });

    await waitFor(() => expect(screen.getByTestId('urgent-device-status')).toHaveTextContent(vi.reminders.urgent.thisDevice));
    expect(screen.queryByTestId('urgent-use-this-device')).toBeNull();

    await fireEvent.press(screen.getByTestId('urgent-clear'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ urgentDeviceId: null }));
  });

  it('urgent: another device chosen → says "another device" and offers to switch', async () => {
    await setup({ ...BASE, urgentDeviceId: 'other-device-9999' });

    await waitFor(() => expect(screen.getByTestId('urgent-device-status')).toHaveTextContent(vi.reminders.urgent.otherDevice));
    expect(screen.getByTestId('urgent-use-this-device')).toBeOnTheScreen();
  });

  it('asks to allow full-screen notifications only on the urgent device that lacks the permission', async () => {
    const openFullScreenIntentSettings = jest.fn(async () => undefined);
    setTasklyAndroidForTests({
      canUseFullScreenIntent: () => false,
      openFullScreenIntentSettings,
    } as unknown as TasklyAndroidModule);
    await setup({ ...BASE, urgentDeviceId: DEVICE });

    await waitFor(() => expect(screen.getByTestId('urgent-full-screen')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('urgent-full-screen-open'));

    expect(openFullScreenIntentSettings).toHaveBeenCalledTimes(1);
  });

  it('no full-screen hint when the permission is granted, on another device, or without the native module', async () => {
    setTasklyAndroidForTests({ canUseFullScreenIntent: () => true } as unknown as TasklyAndroidModule);
    await setup({ ...BASE, urgentDeviceId: DEVICE });
    await waitFor(() => expect(screen.getByTestId('urgent-device-status')).toHaveTextContent(vi.reminders.urgent.thisDevice));
    expect(screen.queryByTestId('urgent-full-screen')).toBeNull();
  });

  it('the Places row appears only when the page wires it, and opens it', async () => {
    const onOpenPlaces = jest.fn();
    await setup(BASE, { onOpenPlaces });

    await fireEvent.press(screen.getByTestId('reminder-places-row'));

    expect(onOpenPlaces).toHaveBeenCalledTimes(1);
  });
});
