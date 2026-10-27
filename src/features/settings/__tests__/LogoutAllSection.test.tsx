import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { countRequests, jsonResponse, mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { LogoutAllSection } from '../LogoutAllSection';

describe('LogoutAllSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('asks first (BR-11); Cancel calls nothing', async () => {
    const fetchMock = mockFetch();
    serveSettings(fetchMock, { routes: { 'POST /api/v1/me/logout-all': () => jsonResponse(204) } });
    await renderWithSettings(<LogoutAllSection />);

    await fireEvent.press(await screen.findByTestId('logout-all-open'));
    expect(screen.getByText(vi.settings.logoutAll.confirmTitle)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('logout-all-dialog-cancel'));

    expect(countRequests(fetchMock, '/api/v1/me/logout-all')).toBe(0);
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
  });

  it('confirming revokes every session and signs this device out locally (no /auth/logout call)', async () => {
    const fetchMock = mockFetch();
    serveSettings(fetchMock, { routes: { 'POST /api/v1/me/logout-all': () => jsonResponse(204) } });
    await renderWithSettings(<LogoutAllSection />);

    await fireEvent.press(await screen.findByTestId('logout-all-open'));
    await fireEvent.press(screen.getByTestId('logout-all-dialog-confirm'));

    await waitFor(async () => expect(await tokenStore.getAccessToken()).toBeNull());
    expect(countRequests(fetchMock, '/api/v1/me/logout-all')).toBe(1);
    expect(countRequests(fetchMock, '/api/v1/auth/logout')).toBe(0);
  });

  it('a failure is shown in the dialog and this device stays signed in', async () => {
    serveSettings(mockFetch(), { routes: { 'POST /api/v1/me/logout-all': () => problem(503, 'Service Unavailable') } });
    await renderWithSettings(<LogoutAllSection />);

    await fireEvent.press(await screen.findByTestId('logout-all-open'));
    await fireEvent.press(screen.getByTestId('logout-all-dialog-confirm'));

    expect(await screen.findByTestId('logout-all-dialog-error')).toBeTruthy();
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
  });
});
