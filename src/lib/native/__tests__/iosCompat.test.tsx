import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { IosDateTimePickerHost } from '../../../components/IosDateTimePickerHost';
import { MAX_GEOFENCES, MAX_GEOFENCES_IOS, maxGeofences } from '../../../features/locations/geofencePlan';
import { pickAbsoluteReminder } from '../../../features/reminders/pickAbsoluteReminder';
import { setReminderPlatform } from '../../../features/reminders/platform';
import { ReminderSettingsScreen } from '../../../features/reminders/ReminderSettingsScreen';
import { createUrgentAwareScheduler } from '../../../features/reminders/urgentScheduler';
import { CompletionToneSection } from '../../../features/settings/CompletionToneSection';
import { DynamicColorSection } from '../../../features/settings/DynamicColorSection';
import { SettingsScreen } from '../../../features/settings/SettingsScreen';
import { ShareIntentHandler } from '../../../features/share/ShareIntentHandler';
import { registerWidgetsIfAndroid } from '../../../features/widgets/registerWidgets';
import { refreshWidgets } from '../../../features/widgets/widgetBridge';
import { FakeReminderPlatform } from '../../../test/fakeReminderPlatform';
import { FakeReminderScheduler } from '../../../test/fakeReminderScheduler';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { renderWithSettings } from '../../../test/renderSettings';
import { runAsPlatform } from '../../../test/runAsPlatform';
import { serveSettings } from '../../../test/settingsFixtures';
import { openDateTimePicker, setDateTimePickerHost } from '../../dateTimePicker';
import { getGoogleIdToken, setGoogleSignInPlatform } from '../../googleSignIn';
import { createGoogleSignInAdapter, installNativeGoogleSignIn } from '../../googleSignInAdapter';
import { tokenStore } from '../../tokenStore';
import { isAndroid, isIos } from '../platform';
import {
  getTasklyAndroid,
  playCompletionTone,
  setTasklyAndroidForTests,
  supportsDynamicColor,
  type TasklyAndroidModule,
} from '../tasklyAndroid';

// X5: on iOS the Android widget library cannot even be required (TurboModuleRegistry.getEnforcing throws at import).
// This factory plays that part: any require of it is counted and throws.
let mockWidgetLibLoads = 0;
jest.mock('react-native-android-widget', () => {
  mockWidgetLibLoads += 1;
  throw new Error("TurboModuleRegistry.getEnforcing(...): 'AndroidWidget' could not be found");
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  usePathname: () => '/',
}));

const ME_ROUTE = { 'GET /api/v1/me': () => jsonResponse(200, testUser) };

describe('iOS compatibility (Platform.OS = ios): Android-only features are absent, nothing throws', () => {
  runAsPlatform('ios');
  afterEach(() => {
    setTasklyAndroidForTests(undefined);
    setReminderPlatform(null);
    setDateTimePickerHost(null);
    setGoogleSignInPlatform(null);
  });

  it('knows which OS it runs on', () => {
    expect(isIos()).toBe(true);
    expect(isAndroid()).toBe(false);
    expect(isAndroid('android')).toBe(true);
  });

  describe('native bridge and widgets', () => {
    it('TasklyAndroid is missing: no module, no Dynamic Color, the tone is a silent no-op', () => {
      expect(getTasklyAndroid()).toBeNull();
      expect(supportsDynamicColor()).toBe(false);
      expect(() => playCompletionTone()).not.toThrow();
    });

    it('the widget library is never required on iOS (entry registration, refresh)', async () => {
      mockWidgetLibLoads = 0;
      expect(registerWidgetsIfAndroid()).toBe(false);
      expect(registerWidgetsIfAndroid('ios')).toBe(false);
      await expect(
        refreshWidgets({ tasks: [], completedToday: 0, dailyGoal: 5 } as unknown as Parameters<typeof refreshWidgets>[0]),
      ).resolves.toBeUndefined();
      expect(mockWidgetLibLoads).toBe(0);
    });

    it('on Android a library that fails to load is swallowed (no widgets, no crash)', () => {
      expect(() => registerWidgetsIfAndroid('android')).not.toThrow();
      expect(registerWidgetsIfAndroid('android')).toBe(false);
    });
  });

  describe('reminders', () => {
    it('an urgent request without the native module goes to the base scheduler, once', async () => {
      const base = new FakeReminderScheduler();
      const scheduler = createUrgentAwareScheduler(base, () => getTasklyAndroid());
      await scheduler.schedule({
        id: 'r1',
        taskId: 't1',
        fireAtMs: Date.now() + 60_000,
        title: 'T',
        body: 'B',
        signature: 's',
        kind: 'ABSOLUTE',
        urgent: true,
      } as Parameters<typeof scheduler.schedule>[0]);
      expect((await scheduler.listScheduled()).map((item) => item.id)).toEqual(['r1']);
      await expect(scheduler.cancelAll()).resolves.toBeUndefined();
    });

    it('Reminders settings hide pinned / urgent reminders and the exact-alarm hint', async () => {
      setReminderPlatform(new FakeReminderPlatform());
      await renderWithProviders(
        <ReminderSettingsScreen
          settings={{ remindersEnabled: true, autoReminderMinutes: 30 }}
          onSave={jest.fn().mockResolvedValue(undefined)}
          onBack={jest.fn()}
          showExactAlarmHint
        />,
      );
      expect(await screen.findByTestId('reminder-enabled-switch')).toBeOnTheScreen();
      expect(screen.getByTestId('snooze-15')).toBeOnTheScreen();
      expect(screen.queryByTestId('reminder-pin-switch')).toBeNull();
      expect(screen.queryByTestId('urgent-device-status')).toBeNull();
      expect(screen.queryByTestId('urgent-use-this-device')).toBeNull();
      expect(screen.queryByTestId('urgent-full-screen')).toBeNull();
      expect(screen.queryByTestId('reminder-exact-alarm')).toBeNull();
    });

    it('location reminders use the iOS budget of 20 regions', () => {
      expect(maxGeofences('ios')).toBe(MAX_GEOFENCES_IOS);
      expect(MAX_GEOFENCES_IOS).toBe(20);
      expect(maxGeofences('android')).toBe(MAX_GEOFENCES);
    });
  });

  describe('settings', () => {
    it('the home page has no App icon row', async () => {
      await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
      serveSettings(mockFetch(), { routes: ME_ROUTE });
      await renderWithSettings(<SettingsScreen />);

      expect(await screen.findByTestId('settings-row-general')).toBeTruthy();
      expect(screen.queryByTestId('settings-row-app-icon')).toBeNull();
    });

    it('no completion-tone switch and no Dynamic Color switch, even if a native module were present', async () => {
      setTasklyAndroidForTests({} as TasklyAndroidModule);
      await renderWithProviders(
        <>
          <CompletionToneSection />
          <DynamicColorSection />
        </>,
      );
      expect(screen.queryByTestId('completion-tone')).toBeNull();
      expect(screen.queryByTestId('dynamic-color')).toBeNull();
    });
  });

  describe('share intent', () => {
    it('does nothing without the native module', async () => {
      await renderWithProviders(<ShareIntentHandler />);
      expect(screen.toJSON()).toBeNull();
    });
  });

  describe('Google sign-in', () => {
    const mocked = jest.mocked(GoogleSignin);

    it('is "not configured" on iOS without an iOS client id, and never touches the native SDK', async () => {
      installNativeGoogleSignIn('web-id', null, 'ios');
      await expect(getGoogleIdToken()).resolves.toEqual({ type: 'error', reason: 'notConfigured' });
      expect(mocked.configure).not.toHaveBeenCalled();
      expect(mocked.signIn).not.toHaveBeenCalled();
    });

    it('with an iOS client id it configures both ids', async () => {
      mocked.hasPlayServices.mockResolvedValue(true);
      mocked.signIn.mockResolvedValue({
        type: 'success',
        data: { idToken: 'tok', user: { email: 'a@b.c' } },
      } as never);
      mocked.signOut.mockResolvedValue(null);
      await expect(createGoogleSignInAdapter('web-id', { iosClientId: 'ios-id', os: 'ios' }).signIn()).resolves.toEqual({
        type: 'success',
        idToken: 'tok',
        email: 'a@b.c',
      });
      expect(mocked.configure).toHaveBeenCalledWith({ webClientId: 'web-id', iosClientId: 'ios-id' });
    });
  });

  describe('date / time picker', () => {
    it('opens in a dialog on iOS: Done reports "set" with the date, Cancel reports "dismissed"', async () => {
      await render(<IosDateTimePickerHost os="ios" />);
      const onChange = jest.fn();
      const value = new Date('2026-10-23T03:00:00Z');

      openDateTimePicker({ value, mode: 'time', onChange });
      await fireEvent.press(await screen.findByTestId('ios-date-time-picker-done'));
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'set' }), value);
      expect(DateTimePickerAndroid.open).not.toHaveBeenCalled();

      openDateTimePicker({ value, mode: 'date', onChange });
      await fireEvent.press(await screen.findByTestId('ios-date-time-picker-cancel'));
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'dismissed' }), undefined);
    });

    it('the absolute reminder picker finishes (date, then time) instead of hanging as it did on iOS', async () => {
      await render(<IosDateTimePickerHost os="ios" />);
      const picking = pickAbsoluteReminder({
        timeZone: 'Asia/Ho_Chi_Minh',
        is24Hour: true,
        now: () => Date.parse('2026-10-23T03:00:00Z'),
      });
      await fireEvent.press(await screen.findByTestId('ios-date-time-picker-done'));
      await waitFor(() => expect(screen.getByTestId('ios-date-time-picker-done')).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId('ios-date-time-picker-done'));
      await expect(picking).resolves.toEqual({ kind: 'picked', at: '2026-10-23T11:00' });
    });
  });
});

describe('Android is unchanged (Platform.OS = android)', () => {
  runAsPlatform('android');
  afterEach(() => setDateTimePickerHost(null));

  it('the date / time picker host renders nothing and keeps the native dialog', async () => {
    await render(<IosDateTimePickerHost />);
    const request = { value: new Date(), mode: 'date' as const, onChange: jest.fn() };
    openDateTimePicker(request);
    expect(DateTimePickerAndroid.open).toHaveBeenCalledWith(request);
    expect(screen.queryByTestId('ios-date-time-picker')).toBeNull();
  });

  it('shows the App icon row on the settings home', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    serveSettings(mockFetch(), { routes: ME_ROUTE });
    await renderWithSettings(<SettingsScreen />);
    expect(await screen.findByTestId('settings-row-app-icon')).toBeTruthy();
  });
});
