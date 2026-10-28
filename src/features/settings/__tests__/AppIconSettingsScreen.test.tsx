import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { resetDeviceSettingsForTests, setDeviceSettings, getDeviceSettings } from '../../../lib/device/deviceSettings';
import { setTasklyAndroidForTests, type TasklyAndroidModule } from '../../../lib/native/tasklyAndroid';
import { renderWithProviders } from '../../../test/render';
import { runAsPlatform } from '../../../test/runAsPlatform';
import { AppIconSettingsScreen } from '../AppIconSettingsScreen';
import { CompletionToneSection } from '../CompletionToneSection';
import { DynamicColorSection } from '../DynamicColorSection';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));

describe('Settings › App icon', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetDeviceSettingsForTests();
  });
  afterEach(() => setTasklyAndroidForTests(undefined));

  it('says custom icons are not available in a build without the native module', async () => {
    await renderWithProviders(<AppIconSettingsScreen />);

    expect(screen.getByTestId('app-icon-unsupported')).toBeOnTheScreen();
    expect(screen.queryByTestId('app-icon-activate')).toBeNull();
  });

  it('first asks to activate custom icons; cancelling changes nothing', async () => {
    setTasklyAndroidForTests({ setAppIcon: jest.fn() } as unknown as TasklyAndroidModule);
    await renderWithProviders(<AppIconSettingsScreen />);

    await fireEvent.press(screen.getByTestId('app-icon-activate'));
    expect(screen.getByText('Bật biểu tượng tuỳ chỉnh?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('app-icon-confirm-cancel'));

    expect(getDeviceSettings().customIconsActive).toBe(false);
    expect(screen.queryByTestId('app-icon-option-dark')).toBeNull();
  });

  it('after activating, picking an icon switches the launcher alias and remembers it', async () => {
    const setAppIcon = jest.fn(async () => undefined);
    setTasklyAndroidForTests({ setAppIcon } as unknown as TasklyAndroidModule);
    await renderWithProviders(<AppIconSettingsScreen />);

    await fireEvent.press(screen.getByTestId('app-icon-activate'));
    await fireEvent.press(screen.getByTestId('app-icon-confirm-confirm'));
    await waitFor(() => expect(screen.getByTestId('app-icon-option-default').props.accessibilityState).toMatchObject({ checked: true }));
    await fireEvent.press(screen.getByTestId('app-icon-option-dark'));

    await waitFor(() => expect(setAppIcon).toHaveBeenCalledWith('dark'));
    await waitFor(() => expect(getDeviceSettings()).toMatchObject({ appIcon: 'dark', customIconsActive: true }));
    expect(screen.getByTestId('app-icon-option-dark').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('a failing switch says so and keeps the old icon', async () => {
    const setAppIcon = jest.fn(async () => {
      throw new Error('component not found');
    });
    setTasklyAndroidForTests({ setAppIcon } as unknown as TasklyAndroidModule);
    await setDeviceSettings({ customIconsActive: true });
    await renderWithProviders(<AppIconSettingsScreen />);

    await fireEvent.press(screen.getByTestId('app-icon-option-light'));

    await waitFor(() => expect(screen.getByTestId('app-icon-error')).toBeOnTheScreen());
    expect(getDeviceSettings().appIcon).toBe('default');
  });
});

describe('device settings rows', () => {
  runAsPlatform('android');
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetDeviceSettingsForTests();
  });
  afterEach(() => setTasklyAndroidForTests(undefined));

  it('the complete tone switch is on by default and turns it off', async () => {
    await renderWithProviders(<CompletionToneSection />);

    expect(screen.getByTestId('completion-tone').props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByTestId('completion-tone'));

    await waitFor(() => expect(getDeviceSettings().completionTone).toBe(false));
  });

  it('Dynamic Color is offered only where the system supports it', async () => {
    const view = await renderWithProviders(<DynamicColorSection />);
    expect(screen.queryByTestId('dynamic-color')).toBeNull();
    await view.unmount();
  });
});
