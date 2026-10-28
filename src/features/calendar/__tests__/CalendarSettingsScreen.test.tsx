import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import type { CalendarStatusResponse } from '../../../api/calendar';
import { viTranslation as vi } from '../../../i18n';
import { setExternalBrowser } from '../../../lib/externalBrowser';
import { tokenStore } from '../../../lib/tokenStore';
import { FakeExternalBrowser } from '../../../test/fakeExternalBrowser';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem, requestAt, type FetchMock } from '../../../test/http';
import { routeFetch, type RouteHandler } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { CalendarSettingsScreen } from '../CalendarSettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const DISCONNECTED: CalendarStatusResponse = {
  connected: false,
  provider: null,
  accountEmail: null,
  showEvents: false,
  syncTasks: false,
  needsReauth: false,
  lastSyncedAt: null,
};
const CONNECTED: CalendarStatusResponse = {
  connected: true,
  provider: 'GOOGLE',
  accountEmail: 'lich@example.com',
  showEvents: true,
  syncTasks: false,
  needsReauth: false,
  lastSyncedAt: null,
};

function serve(status: () => CalendarStatusResponse, routes: Record<string, RouteHandler> = {}): FetchMock {
  const fetchMock = mockFetch();
  routeFetch(fetchMock, {
    'GET /api/v1/me': () => jsonResponse(200, testUser),
    'GET /api/v1/me/calendar': () => jsonResponse(200, status()),
    ...routes,
  });
  return fetchMock;
}

function requestTo(fetchMock: FetchMock, method: string, pathEnd: string) {
  const index = fetchMock.mock.calls.findIndex(
    ([input, init]) => String(input).endsWith(pathEnd) && (init?.method ?? 'GET') === method,
  );
  expect(index).toBeGreaterThanOrEqual(0);
  return requestAt(fetchMock, index);
}

describe('CalendarSettingsScreen', () => {
  let browser: FakeExternalBrowser;

  beforeEach(async () => {
    jest.clearAllMocks();
    browser = new FakeExternalBrowser();
    setExternalBrowser(browser);
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  afterEach(() => setExternalBrowser(null));

  it('offers Google and Outlook while nothing is connected, and opens the consent page', async () => {
    const fetchMock = serve(() => DISCONNECTED, {
      'POST /api/v1/me/calendar/connect': () => jsonResponse(200, { authorizationUrl: 'https://accounts.example/consent?x=1' }),
    });
    await renderWithProviders(<CalendarSettingsScreen />);
    expect(await screen.findByText(vi.calendar.intro)).toBeTruthy();
    expect(screen.queryByTestId('calendar-toggle-events')).toBeNull();

    await fireEvent.press(screen.getByTestId('calendar-connect-google'));

    await waitFor(() => expect(browser.opened).toEqual(['https://accounts.example/consent?x=1']));
    expect(requestTo(fetchMock, 'POST', '/me/calendar/connect').body).toEqual({ provider: 'GOOGLE' });
    expect((await screen.findByTestId('calendar-message')).props.children).toBe(vi.calendar.opening);

    await fireEvent.press(screen.getByTestId('calendar-connect-outlook'));
    await waitFor(() => expect(requestTo(fetchMock, 'POST', '/me/calendar/connect').body).toBeDefined());
  });

  it('explains 409 already-connected and 503 not-configured', async () => {
    let answer: RouteHandler = () => problem(409, 'Conflict', { code: 'calendar-already-connected' });
    serve(() => DISCONNECTED, { 'POST /api/v1/me/calendar/connect': (request) => answer(request) });
    await renderWithProviders(<CalendarSettingsScreen />);
    await screen.findByText(vi.calendar.intro);

    await fireEvent.press(screen.getByTestId('calendar-connect-google'));
    expect((await screen.findByTestId('calendar-message')).props.children).toBe(vi.calendar.errors.alreadyConnected);

    answer = () => problem(503, 'Service Unavailable', { code: 'calendar-not-configured' });
    await fireEvent.press(screen.getByTestId('calendar-connect-outlook'));
    await waitFor(() =>
      expect(screen.getByTestId('calendar-message').props.children).toBe(vi.calendar.errors.notConfigured),
    );
    expect(browser.opened).toEqual([]);
  });

  it('shows the connected account with the two switches and no sync button until sync is on', async () => {
    serve(() => CONNECTED);
    await renderWithProviders(<CalendarSettingsScreen />);

    expect(await screen.findByTestId('calendar-account')).toBeTruthy();
    expect(screen.getByText('Đã kết nối Google Calendar')).toBeTruthy();
    expect(screen.getByTestId('calendar-toggle-events').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('calendar-toggle-sync').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.queryByTestId('calendar-sync-now')).toBeNull();
  });

  it('turning sync on patches the server, then offers "Sync now" and shows the result', async () => {
    let status = CONNECTED;
    const fetchMock = serve(() => status, {
      'PATCH /api/v1/me/calendar': (request) => {
        status = { ...status, ...(request.body as Partial<CalendarStatusResponse>) };
        return jsonResponse(200, status);
      },
      'POST /api/v1/me/calendar/sync': () => jsonResponse(200, { created: 3, updated: 1, deleted: 0, pulled: 2 }),
    });
    await renderWithProviders(<CalendarSettingsScreen />);
    await screen.findByTestId('calendar-account');

    await fireEvent.press(screen.getByTestId('calendar-toggle-sync'));

    expect(await screen.findByTestId('calendar-sync-now')).toBeTruthy();
    expect(requestTo(fetchMock, 'PATCH', '/me/calendar').body).toEqual({ syncTasks: true });
    expect(screen.getByTestId('calendar-last-synced').props.children).toBe(vi.calendar.neverSynced);

    await fireEvent.press(screen.getByTestId('calendar-sync-now'));

    expect((await screen.findByTestId('calendar-message')).props.children).toBe(
      'Đã đồng bộ: thêm 3, sửa 1, xoá 0, cập nhật ngược 2',
    );
  });

  it('disconnecting asks first, then calls DELETE and shows the connect buttons again', async () => {
    let status = CONNECTED;
    const fetchMock = serve(() => status, {
      'DELETE /api/v1/me/calendar': () => {
        status = DISCONNECTED;
        return jsonResponse(204);
      },
    });
    await renderWithProviders(<CalendarSettingsScreen />);
    await screen.findByTestId('calendar-account');

    await fireEvent.press(screen.getByTestId('calendar-disconnect'));
    expect(await screen.findByText(vi.calendar.disconnectTitle)).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);

    await fireEvent.press(screen.getByTestId('calendar-confirm-confirm'));

    expect(await screen.findByTestId('calendar-connect-google')).toBeTruthy();
    expect(screen.getByTestId('calendar-message').props.children).toBe(vi.calendar.disconnected);
  });

  it('tells the user to reconnect when the provider revoked access', async () => {
    serve(() => ({ ...CONNECTED, needsReauth: true }));
    await renderWithProviders(<CalendarSettingsScreen />);

    expect((await screen.findByTestId('calendar-needs-reauth')).props.children).toBe(vi.calendar.needsReauth);
    expect(screen.getByTestId('calendar-toggle-events').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('copies the feed link, and resets it only after a confirmation', async () => {
    const fetchMock = serve(() => DISCONNECTED, {
      'POST /api/v1/me/calendar-feeds': () => jsonResponse(200, { url: 'https://taskly.test/feed/old.ics', projectId: null }),
      'POST /api/v1/me/calendar-feeds/reset': () =>
        jsonResponse(200, { url: 'https://taskly.test/feed/new.ics', projectId: null }),
    });
    await renderWithProviders(<CalendarSettingsScreen />);
    await screen.findByTestId('calendar-feed-copy');

    await fireEvent.press(screen.getByTestId('calendar-feed-copy'));

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://taskly.test/feed/old.ics'));
    expect((await screen.findByTestId('calendar-message')).props.children).toBe(vi.calendar.feed.copied);

    await fireEvent.press(screen.getByTestId('calendar-feed-reset'));
    expect(await screen.findByText(vi.calendar.feed.resetTitle)).toBeTruthy();
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/reset'))).toBe(false);
    await fireEvent.press(screen.getByTestId('calendar-confirm-confirm'));

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://taskly.test/feed/new.ics'));
    expect((await screen.findByTestId('calendar-message')).props.children).toBe(vi.calendar.feed.resetDone);
  });

  it('shows the result of the deep link once (connected, or an error code)', async () => {
    serve(() => CONNECTED);
    const first = await renderWithProviders(<CalendarSettingsScreen result="connected" />);
    expect((await screen.findByTestId('calendar-message')).props.children).toBe(vi.calendar.connectedResult);
    first.unmount();

    serve(() => DISCONNECTED);
    await renderWithProviders(<CalendarSettingsScreen error="denied" />);
    expect((await screen.findByTestId('calendar-message')).props.children).toBe(vi.calendar.errors.denied);
  });
});
