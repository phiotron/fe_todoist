import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import vi from '../../../i18n/locales/vi/reminders.json';
import { FakeReminderPlatform, fakePermission } from '../../../test/fakeReminderPlatform';
import { renderWithProviders } from '../../../test/render';
import { setReminderPlatform } from '../platform';
import { ReminderSettingsScreen, type ReminderSettingsValues } from '../ReminderSettingsScreen';
import { onReminderSyncRequested } from '../syncSignal';

const texts = vi.reminders.settings;
const DEFAULTS: ReminderSettingsValues = { remindersEnabled: true, autoReminderMinutes: 30 };

let platform: FakeReminderPlatform;
let synced: jest.Mock;
let unsubscribe: () => void;

async function setup(settings: ReminderSettingsValues | null = DEFAULTS, onSave = jest.fn().mockResolvedValue(undefined)) {
  const onBack = jest.fn();
  await renderWithProviders(<ReminderSettingsScreen settings={settings} onSave={onSave} onBack={onBack} />);
  return { onSave, onBack };
}

describe('ReminderSettingsScreen', () => {
  beforeEach(() => {
    platform = new FakeReminderPlatform();
    setReminderPlatform(platform);
    synced = jest.fn();
    unsubscribe = onReminderSyncRequested(synced);
  });

  afterEach(() => {
    unsubscribe();
    setReminderPlatform(null);
    jest.restoreAllMocks();
  });

  it('shows the current reminder settings', async () => {
    await setup();

    expect(screen.getByTestId('reminder-enabled-switch').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('auto-reminder-30').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('auto-reminder-off').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByText(texts.autoHint)).toBeOnTheScreen();
  });

  it('renders nothing while the settings are loading', async () => {
    await setup(null);

    expect(screen.queryByTestId('reminder-settings')).toBeNull();
  });

  it('assumes the server defaults for fields the server did not send yet', async () => {
    await setup({});

    expect(screen.getByTestId('reminder-enabled-switch').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('auto-reminder-30').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('goes back', async () => {
    const { onBack } = await setup();

    await fireEvent.press(screen.getByTestId('reminder-settings-header-back'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('turning reminders off saves remindersEnabled=false, then asks for a sync', async () => {
    const { onSave } = await setup();

    await fireEvent.press(screen.getByTestId('reminder-enabled-switch'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ remindersEnabled: false }));
    await waitFor(() => expect(synced).toHaveBeenCalledTimes(1));
  });

  it('choosing "1 giờ trước" saves autoReminderMinutes=60, then asks for a sync', async () => {
    const { onSave } = await setup();

    await fireEvent.press(screen.getByTestId('auto-reminder-60'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ autoReminderMinutes: 60 }));
    await waitFor(() => expect(synced).toHaveBeenCalledTimes(1));
    expect(screen.getByText('1 giờ trước')).toBeOnTheScreen();
  });

  it('turning automatic reminders off sends null (not 0, not undefined)', async () => {
    const { onSave } = await setup();

    await fireEvent.press(screen.getByTestId('auto-reminder-off'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ autoReminderMinutes: null }));
    expect(onSave.mock.calls[0][0]).toHaveProperty('autoReminderMinutes', null);
  });

  it('reflects a saved "off" (null) as the chosen row', async () => {
    await setup({ remindersEnabled: true, autoReminderMinutes: null });

    expect(screen.getByTestId('auto-reminder-off').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('auto-reminder-30').props.accessibilityState).toMatchObject({ checked: false });
  });

  it('does not sync when saving failed', async () => {
    const { onSave } = await setup(DEFAULTS, jest.fn().mockRejectedValue(new Error('offline')));

    await fireEvent.press(screen.getByTestId('auto-reminder-60'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(synced).not.toHaveBeenCalled();
  });

  it('shows no banner when notifications are allowed', async () => {
    await setup();

    expect(screen.queryByTestId('reminder-permission-banner')).toBeNull();
  });

  it('asks for permission from the banner, hides it once granted and requests a sync', async () => {
    platform.permission = fakePermission('undetermined');
    platform.permissionAfterRequest = fakePermission('granted');
    await setup();
    expect(await screen.findByText(texts.permissionMissing)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('reminder-permission-allow'));

    await waitFor(() => expect(screen.queryByTestId('reminder-permission-banner')).toBeNull());
    expect(platform.requestCalls).toBe(1);
    expect(synced).toHaveBeenCalledTimes(1);
  });

  it('opens the system settings when the permission can no longer be requested', async () => {
    platform.permission = fakePermission('denied', false);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await setup();

    await fireEvent.press(await screen.findByTestId('reminder-permission-open-settings'));

    expect(screen.getByText(texts.openSystemSettings)).toBeOnTheScreen();
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('hides the banner while reminders are turned off', async () => {
    platform.permission = fakePermission('denied', false);
    await setup({ remindersEnabled: false, autoReminderMinutes: 30 });

    expect(screen.queryByTestId('reminder-permission-banner')).toBeNull();
  });

  it('on Android 14+ explains the exact-alarm switch and opens its system page', async () => {
    platform.exactAlarmNeeded = true;
    await setup();

    expect(screen.getByText(texts.exactAlarmHint)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('reminder-exact-alarm-open'));

    expect(screen.getByText(texts.exactAlarmOpen)).toBeOnTheScreen();
    expect(platform.exactAlarmOpened).toBe(1);
  });

  it('shows no exact-alarm hint on platforms that do not need it', async () => {
    await setup();

    expect(screen.queryByTestId('reminder-exact-alarm-open')).toBeNull();
  });
});
