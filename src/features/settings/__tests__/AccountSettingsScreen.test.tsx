import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { AccountSettingsScreen } from '../AccountSettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

function serveAccount(twoFactor: boolean) {
  serveSettings(mockFetch(), {
    routes: {
      'GET /api/v1/me': () => jsonResponse(200, testUser),
      'GET /api/v1/me/2fa': () => jsonResponse(200, { enabled: twoFactor, recoveryCodesLeft: twoFactor ? 7 : 0 }),
    },
  });
}

describe('AccountSettingsScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('lists the account sections in order', async () => {
    serveAccount(false);
    await renderWithSettings(<AccountSettingsScreen />);

    expect(await screen.findByTestId('account-settings-screen')).toBeTruthy();
    for (const key of ['profile', 'password', 'twoFactor', 'logoutAll', 'deleteAccount']) {
      expect(screen.getByTestId(`settings-section-${key}`)).toBeTruthy();
    }
  });

  it('the two-factor row shows Off / On and opens the two-factor page', async () => {
    serveAccount(true);
    await renderWithSettings(<AccountSettingsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('settings-row-two-factor').props.accessibilityLabel).toBe(
        `${vi.settings.account.twoFactor}, ${vi.settings.account.twoFactorOn}`,
      ),
    );
    await fireEvent.press(screen.getByTestId('settings-row-two-factor'));
    expect(router.push).toHaveBeenCalledWith('/settings/two-factor');
  });

  it('shows Off while two-factor is not enabled', async () => {
    serveAccount(false);
    await renderWithSettings(<AccountSettingsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('settings-row-two-factor').props.accessibilityLabel).toBe(
        `${vi.settings.account.twoFactor}, ${vi.settings.account.twoFactorOff}`,
      ),
    );
  });
});
