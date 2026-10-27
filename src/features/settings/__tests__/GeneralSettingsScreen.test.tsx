import { screen } from '@testing-library/react-native';
import { jsonResponse, mockFetch } from '../../../test/http';
import { tokenStore } from '../../../lib/tokenStore';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { GeneralSettingsScreen } from '../GeneralSettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

describe('GeneralSettingsScreen', () => {
  it('lists language, time zone, start page, smart date recognition and swipe actions', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    serveSettings(mockFetch(), {
      routes: {
        'GET /api/v1/projects': () => jsonResponse(200, []),
        'GET /api/v1/labels': () => jsonResponse(200, []),
        'GET /api/v1/filters': () => jsonResponse(200, []),
      },
    });
    await renderWithSettings(<GeneralSettingsScreen />);

    expect(await screen.findByTestId('general-settings-screen')).toBeTruthy();
    for (const key of ['language', 'timeZone', 'startPage', 'smartDate', 'swipe']) {
      expect(screen.getByTestId(`settings-section-${key}`)).toBeTruthy();
    }
  });
});
