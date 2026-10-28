import '../../../i18n';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { act, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { apiFetch } from '../../../api/client';
import { onReminderSyncRequested } from '../../../features/reminders/syncSignal';
import { SyncStatusPill } from '../../../features/sync/SyncStatusPill';
import { countRequests, jsonResponse, mockFetch, type FetchMock } from '../../../test/http';
import { goOnline } from '../../../test/network';
import { queryClient } from '../../queryClient';
import { tokenStore } from '../../tokenStore';
import { clearSyncData, pendingSyncCount, startSync, syncQueue } from '../runtime';
import type { SyncRequest, SyncResponse } from '../types';

/**
 * PERF (app sluggish while "Đang đồng bộ" shows): how often the running M9 wiring talks to the server, what it refreshes
 * and when the pill shows. Real runtime, fake fetch / NetInfo / AppState.
 */

const SYNC = '/api/v1/sync';
const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

function syncReply(partial: Partial<SyncResponse> = {}) {
  return (request: SyncRequest): SyncResponse => ({
    syncToken: '10.20',
    fullSync: false,
    changes: {},
    deleted: [],
    results: request.commands.map((c) => ({ uuid: c.uuid, status: 'ok', error: null })),
    tempIdMapping: {},
    ...partial,
  });
}

/** fetch: POST /sync answered by `reply` after `delayMs`; anything else answers 200 {}. */
function serve(fetchMock: FetchMock, reply: (request: SyncRequest) => SyncResponse, delayMs = 0) {
  fetchMock.mockImplementation(async (url, init) => {
    if (String(url).endsWith(SYNC)) {
      const request = JSON.parse(String(init?.body)) as SyncRequest;
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return jsonResponse(200, reply(request));
    }
    return jsonResponse(200, {});
  });
}

let emitNet: (state: NetInfoState) => void = () => undefined;
function controlNet(initial: boolean) {
  jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: initial } as NetInfoState);
  jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
    emitNet = listener;
    listener({ isConnected: initial } as NetInfoState);
    return jest.fn();
  });
}

let appStateHandlers: ((state: AppStateStatus) => void)[] = [];
function captureAppState() {
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, handler) => {
    if (type === 'change') appStateHandlers.push(handler as (state: AppStateStatus) => void);
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
}
const foreground = () => act(async () => appStateHandlers.forEach((handler) => handler('active')));

describe('M9 sync frequency and cost (PERF)', () => {
  let stop: () => void = () => undefined;

  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc', refreshToken: 'ref' });
    await clearSyncData();
    queryClient.clear();
  });

  afterEach(async () => {
    stop();
    stop = () => undefined;
    await clearSyncData();
    queryClient.clear();
    goOnline();
    jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true, isInternetReachable: true } as NetInfoState);
    jest.restoreAllMocks();
  });

  it('coming back to the foreground again and again does not pull again within the pull interval', async () => {
    controlNet(true);
    captureAppState();
    const fetchMock = mockFetch();
    serve(fetchMock, syncReply());
    stop = startSync();
    await wait(500); // app open: one pull for a token
    expect(countRequests(fetchMock, SYNC)).toBe(1);

    for (let i = 0; i < 5; i++) {
      await foreground();
      await wait(50);
    }
    await wait(500);

    expect(countRequests(fetchMock, SYNC)).toBe(1);
  });

  it('N writes in a row while changes wait to be sent go out in ONE request, with no empty pull after', async () => {
    controlNet(false);
    const fetchMock = mockFetch();
    serve(fetchMock, syncReply(), 30);
    stop = startSync();
    await wait(50);
    await apiFetch('/api/v1/labels', { method: 'POST', body: { name: 'offline' } }); // queued offline
    jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true } as NetInfoState);

    // Connection back, and right away 5 quick writes (they queue behind the waiting one, never overtaking it).
    await act(async () => {
      emitNet({ isConnected: true } as NetInfoState);
      for (let i = 0; i < 5; i++) await apiFetch('/api/v1/labels', { method: 'POST', body: { name: `w${i}` } });
    });
    await wait(800);

    expect(pendingSyncCount()).toBe(0);
    const bodies = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith(SYNC))
      .map(([, init]) => (JSON.parse(String(init?.body)) as SyncRequest).commands.length);
    expect(bodies).toEqual([6]);
  });

  it('a sync that answered changes refreshes the caches once and never starts another sync by itself', async () => {
    controlNet(true);
    const fetchMock = mockFetch();
    serve(fetchMock, syncReply());
    stop = startSync();
    await wait(400); // first contact: token
    serve(fetchMock, syncReply({ changes: { tasks: [{ id: 't1' }] } }));
    await act(async () => {
      syncQueue.enqueue({ type: 'task_close', args: { id: 't1' } });
      emitNet({ isConnected: false } as NetInfoState);
      emitNet({ isConnected: true } as NetInfoState);
    });
    await wait(1500);

    expect(countRequests(fetchMock, SYNC)).toBe(2);
  });

  it('a pull that reports only label changes refreshes label data, not productivity / activity, and leaves reminders alone', async () => {
    controlNet(true);
    const fetchMock = mockFetch();
    serve(fetchMock, syncReply());
    stop = startSync();
    await wait(400);
    queryClient.setQueryData(['labels', 'list'], []);
    queryClient.setQueryData(['productivity', 'get'], {});
    queryClient.setQueryData(['activity', 'list', {}], {});
    queryClient.setQueryData(['sections', 'list', 'p1'], []);
    const reminders = jest.fn();
    const stopListening = onReminderSyncRequested(reminders);
    serve(fetchMock, syncReply({ changes: { labels: [{ id: 'l1' }], tasks: [] } }));

    await act(async () => {
      syncQueue.enqueue({ type: 'label_update', args: { id: 'l1', name: 'x' } });
      emitNet({ isConnected: false } as NetInfoState);
      emitNet({ isConnected: true } as NetInfoState);
    });
    await wait(600);
    stopListening();

    expect(queryClient.getQueryState(['labels', 'list'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['productivity', 'get'])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(['activity', 'list', {}])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(['sections', 'list', 'p1'])?.isInvalidated).toBe(false);
    expect(reminders).not.toHaveBeenCalled();
  });

  it('the pill stays hidden for a short background pull', async () => {
    controlNet(true);
    const fetchMock = mockFetch();
    serve(fetchMock, syncReply(), 300);
    const seen: boolean[] = [];
    stop = startSync();
    await render(<SyncStatusPill />);
    for (let i = 0; i < 12; i++) {
      seen.push(screen.queryByTestId('sync-status') !== null);
      await wait(50);
    }
    await wait(300);
    seen.push(screen.queryByTestId('sync-status') !== null);

    expect(countRequests(fetchMock, SYNC)).toBe(1);
    expect(seen.every((shown) => !shown)).toBe(true);
  });

  it('the pill shows once a send has been running for more than a second', async () => {
    controlNet(true);
    const fetchMock = mockFetch();
    serve(fetchMock, syncReply(), 1600);
    stop = startSync();
    await render(<SyncStatusPill />);
    await wait(600);
    expect(screen.queryByTestId('sync-status')).toBeNull();
    await wait(900);
    expect(screen.getByTestId('sync-status')).toBeOnTheScreen();
    await wait(1200);
    expect(screen.queryByTestId('sync-status')).toBeNull();
  });
});
