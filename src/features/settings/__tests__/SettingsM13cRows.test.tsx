import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { SettingsScreen } from '../SettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const ME_ROUTE = { 'GET /api/v1/me': () => jsonResponse(200, testUser) };

/** M13c: the Notifications and Integrations rows of the settings home. */
describe('SettingsScreen rows of M13c', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it.each([
    ['notifications', '/settings/notifications', vi.notificationPrefs.title],
    ['integrations', '/settings/integrations', vi.integrations.title],
  ])('the %s row is shown and opens %s', async (key, href, label) => {
    serveSettings(mockFetch(), { routes: ME_ROUTE });
    await renderWithSettings(<SettingsScreen />);

    expect(await screen.findByText(label)).toBeTruthy();
    await fireEvent.press(await screen.findByTestId(`settings-row-${key}`));

    expect(router.push).toHaveBeenCalledWith(href);
  });
});
