import { screen } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { testMe } from '../../../test/fixtures';
import { jsonResponse, mockFetch } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { AccountSettingsScreen } from '../AccountSettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const ORDER = [
  'settings-section-password',
  'settings-section-google',
  'settings-section-apple', // M13b: Apple and Facebook follow Google
  'settings-section-facebook',
  'settings-section-twoFactor',
  'settings-section-deleteAccount',
];

describe('AccountSettingsScreen — Google', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows the "Link Google" section right after the password section, before 2FA and the account deletion', async () => {
    serveSettings(mockFetch(), {
      routes: {
        'GET /api/v1/me': () => jsonResponse(200, testMe()),
        'GET /api/v1/me/2fa': () => jsonResponse(200, { enabled: false, recoveryCodesLeft: 0 }),
      },
    });

    await renderWithSettings(<AccountSettingsScreen />);

    expect(await screen.findByTestId('settings-section-google')).toBeTruthy();
    const order = screen
      .getAllByTestId(/^settings-section-/)
      .map((node) => node.props.testID as string)
      .filter((id) => ORDER.includes(id));
    expect(order).toEqual(ORDER);
    // Google, Apple and Facebook each say "not linked".
    expect(screen.getAllByText(vi.google.settings.notLinked)).toHaveLength(3);
  });
});
