import { waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../../test/http';
import { deferred, routeFetch } from '../../../test/m3Routes';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { renderWithSettings } from '../../../test/renderSettings';
import { storedSettings, testAppSettings } from '../../../test/settingsFixtures';
import { StartPageRedirect } from '../StartPageRedirect';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() } }));

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const PROJECTS = () => jsonResponse(200, [{ id: P1, name: 'Marketing', isInbox: false, archivedAt: null }]);

function storage(startPage: string, navTabs?: string[]) {
  return memorySettingsStorage(storedSettings({ applied: testAppSettings({ startPage, ...(navTabs ? { navTabs } : {}) }) }));
}

describe('StartPageRedirect', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it.each([
    ['TODAY', '/today'],
    ['INBOX', '/inbox'],
    ['UPCOMING', '/upcoming'],
  ])('start page %s opens %s', async (startPage, route) => {
    routeFetch(mockFetch(), { 'GET /api/v1/projects': PROJECTS });
    await renderWithSettings(<StartPageRedirect />, { storage: storage(startPage) });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(route));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('a pinned project that is also in the tab bar opens the pinned tab', async () => {
    routeFetch(mockFetch(), { 'GET /api/v1/projects': PROJECTS });
    await renderWithSettings(<StartPageRedirect />, {
      storage: storage(`project:${P1}`, ['INBOX', 'TODAY', `project:${P1}`, 'BROWSE']),
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/pinned'));
  });

  it('a project that is not in the tab bar opens over Browse', async () => {
    routeFetch(mockFetch(), { 'GET /api/v1/projects': PROJECTS });
    await renderWithSettings(<StartPageRedirect />, { storage: storage(`project:${P1}`) });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/browse'));
    expect(router.push).toHaveBeenCalledWith(`/project/${P1}`);
  });

  it('waits for the project list before deciding, then goes to Today when the project is gone', async () => {
    const answer = deferred<Response>();
    routeFetch(mockFetch(), { 'GET /api/v1/projects': () => answer.promise });
    await renderWithSettings(<StartPageRedirect />, { storage: storage(`project:${P2}`) });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(router.replace).not.toHaveBeenCalled();

    answer.resolve(PROJECTS());

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/today'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('when the list cannot be loaded the stored start page is trusted', async () => {
    routeFetch(mockFetch(), {
      'GET /api/v1/projects': () => {
        throw new TypeError('Network request failed');
      },
    });
    await renderWithSettings(<StartPageRedirect />, { storage: storage(`project:${P1}`) });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/browse'));
    expect(router.push).toHaveBeenCalledWith(`/project/${P1}`);
  });

  it('signed out goes to the log in screen', async () => {
    await tokenStore.clear();
    mockFetch();
    await renderWithSettings(<StartPageRedirect />, { storage: storage('INBOX') });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });

  it('navigates exactly once', async () => {
    routeFetch(mockFetch(), { 'GET /api/v1/projects': PROJECTS });
    const { rerender } = await renderWithSettings(<StartPageRedirect />, { storage: storage('TODAY') });
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));

    await rerender(<StartPageRedirect />);

    expect(router.replace).toHaveBeenCalledTimes(1);
  });
});
