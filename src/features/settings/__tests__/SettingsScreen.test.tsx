import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import i18n, { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch } from '../../../test/http';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, storedSettings } from '../../../test/settingsFixtures';
import { SettingsScreen } from '../SettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const ME_ROUTE = { 'GET /api/v1/me': () => jsonResponse(200, testUser) };

describe('SettingsScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
  });

  it('shows the profile header and one row per settings page', async () => {
    serveSettings(mockFetch(), { routes: ME_ROUTE });
    await renderWithSettings(<SettingsScreen />);

    expect(await screen.findByTestId('settings-screen')).toBeTruthy();
    expect(await screen.findByText(testUser.displayName)).toBeTruthy();
    expect(screen.getByText(testUser.email)).toBeTruthy();
    for (const key of ['account', 'general', 'date-time', 'reminders', 'theme', 'navigation']) {
      expect(screen.getByTestId(`settings-row-${key}`)).toBeTruthy();
    }
    expect(screen.getByTestId('settings-section-reset')).toBeTruthy();
    expect(screen.getByTestId('settings-sign-out')).toBeTruthy();
    expect(screen.queryByTestId('settings-pending-notice')).toBeNull();
  });

  it.each([
    ['account', '/settings/account'],
    ['general', '/settings/general'],
    ['date-time', '/settings/date-time'],
    ['reminders', '/settings/reminders'],
    ['theme', '/settings/theme'],
    ['navigation', '/settings/navigation'],
  ])('the %s row opens %s', async (key, href) => {
    serveSettings(mockFetch(), { routes: ME_ROUTE });
    await renderWithSettings(<SettingsScreen />);

    await fireEvent.press(await screen.findByTestId(`settings-row-${key}`));

    expect(router.push).toHaveBeenCalledWith(href);
  });

  it('the "Edit" button of the profile header opens the account page', async () => {
    serveSettings(mockFetch(), { routes: ME_ROUTE });
    await renderWithSettings(<SettingsScreen />);

    await fireEvent.press(await screen.findByTestId('settings-edit-profile'));

    expect(router.push).toHaveBeenCalledWith('/settings/account');
  });

  it('shows the current theme name on the Theme row', async () => {
    serveSettings(mockFetch(), { routes: ME_ROUTE });
    await renderWithSettings(<SettingsScreen />);

    expect(await screen.findByText(vi.settings.themeNames.TASKLY)).toBeTruthy();
  });

  it('tells the user when a change is kept only on this device', async () => {
    serveSettings(mockFetch(), {
      routes: ME_ROUTE,
      patch: () => {
        throw new TypeError('Network request failed');
      },
    });
    await renderWithSettings(<SettingsScreen />, {
      storage: memorySettingsStorage(storedSettings({ pending: { appearance: 'DARK' } })),
    });

    expect((await screen.findByTestId('settings-pending-notice')).props.children).toBe(vi.settings.pendingNotice);
  });
});
