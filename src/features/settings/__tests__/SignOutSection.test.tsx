import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../../test/http';
import { deferred } from '../../../test/m3Routes';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { SignOutSection } from '../SignOutSection';

describe('SignOutSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('signs out: revokes the refresh token on the server and clears this device', async () => {
    let logouts = 0;
    serveSettings(mockFetch(), {
      routes: {
        'POST /api/v1/auth/logout': () => {
          logouts += 1;
          return jsonResponse(204);
        },
      },
    });
    await renderWithSettings(<SignOutSection />);

    const button = await screen.findByTestId('settings-sign-out');
    expect(button.props.accessibilityLabel).toBe(vi.settings.signOut.button);
    await fireEvent.press(button);

    await waitFor(async () => expect(await tokenStore.getAccessToken()).toBeNull());
    expect(logouts).toBe(1);
  });

  it('ignores a second press while signing out', async () => {
    const gate = deferred<Response>();
    let logouts = 0;
    serveSettings(mockFetch(), {
      routes: {
        'POST /api/v1/auth/logout': () => {
          logouts += 1;
          return gate.promise;
        },
      },
    });
    await renderWithSettings(<SignOutSection />);
    const button = await screen.findByTestId('settings-sign-out');

    await act(async () => {
      void fireEvent.press(button);
      void fireEvent.press(button);
    });
    await act(async () => {
      gate.resolve(jsonResponse(204));
    });

    await waitFor(async () => expect(await tokenStore.getAccessToken()).toBeNull());
    expect(logouts).toBe(1);
  });
});
