import '../../../i18n';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { apiFetch } from '../../../api/client';
import { OfflineError } from '../../../api/errors';
import { OfflineBanner } from '../../../components/OfflineBanner';
import { confirmDiscardUnsynced } from '../../../features/sync/confirmDiscard';
import { SyncStatusPill } from '../../../features/sync/SyncStatusPill';
import { viTranslation as vi } from '../../../i18n';
import { jsonResponse, mockFetch, requestAt } from '../../../test/http';
import { goOnline } from '../../../test/network';
import { tokenStore } from '../../tokenStore';
import { useIsOnline } from '../../useIsOnline';
import { clearSyncData, pendingSyncCount, startSync, syncQueue } from '../runtime';
import type { SyncRequest } from '../types';

/** The wiring of M9 in the running app: offline write -> queue -> reconnect -> POST /api/v1/sync -> queue empty. */

let emitNet: (state: NetInfoState) => void = () => undefined;
function netStartsOffline() {
  jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: false } as NetInfoState);
  jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
    emitNet = listener;
    listener({ isConnected: false } as NetInfoState);
    return jest.fn();
  });
}

describe('M9 runtime', () => {
  let stop: () => void = () => undefined;

  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc', refreshToken: 'ref' });
    await clearSyncData();
  });

  afterEach(async () => {
    stop();
    stop = () => undefined;
    await clearSyncData();
    goOnline();
    jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true, isInternetReachable: true } as NetInfoState);
    jest.restoreAllMocks();
  });

  it('queues an offline write without touching the network, then sends it when the connection returns', async () => {
    netStartsOffline();
    const fetchMock = mockFetch();
    stop = startSync();
    await waitFor(() => expect(syncQueue.size()).toBe(0)); // queue loaded (empty)

    const created = await apiFetch<{ id: string; content: string }>('/api/v1/tasks', {
      method: 'POST',
      body: { content: 'written offline' },
      idempotencyKey: 'ignored',
    });
    await apiFetch('/api/v1/tasks/' + created.id + '/close', { method: 'POST' });

    expect(created.content).toBe('written offline');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pendingSyncCount()).toBe(2);

    fetchMock.mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body)) as SyncRequest;
      return jsonResponse(200, {
        syncToken: '10.20',
        fullSync: false,
        changes: {},
        deleted: [],
        results: request.commands.map((c) => ({ uuid: c.uuid, status: 'ok', error: null })),
        tempIdMapping: {},
      });
    });
    jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true } as NetInfoState);
    await act(async () => {
      emitNet({ isConnected: true } as NetInfoState);
    });

    await waitFor(() => expect(pendingSyncCount()).toBe(0));
    const syncCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/v1/sync'));
    expect(syncCalls.length).toBeGreaterThanOrEqual(1);
    const sent = requestAt(fetchMock, fetchMock.mock.calls.findIndex(([url]) => String(url).endsWith('/api/v1/sync')));
    const body = sent.body as SyncRequest;
    expect(sent.method).toBe('POST');
    expect(sent.headers.Authorization).toBe('Bearer acc');
    expect(body.commands.map((c) => c.type)).toEqual(['task_add', 'task_close']);
    expect(body.commands[0].tempId).toBe(created.id);
    expect(body.commands[0].args).toMatchObject({ id: created.id, content: 'written offline' });
    expect(body.commands[1].args).toMatchObject({ id: created.id });
  });

  it('refuses a write that cannot be queued with OfflineError, and does not queue it', async () => {
    netStartsOffline();
    mockFetch();
    stop = startSync();

    await expect(apiFetch('/api/v1/tasks/batch', { method: 'POST', body: { action: 'DELETE' } })).rejects.toBeInstanceOf(
      OfflineError,
    );
    expect(pendingSyncCount()).toBe(0);
  });

  it('without startSync() the write path is the plain REST call of M1–M8', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'x' }));
    await apiFetch('/api/v1/tasks', { method: 'POST', body: { content: 'a' } });
    expect(requestAt(fetchMock, 0).url).toContain('/api/v1/tasks');
    expect(pendingSyncCount()).toBe(0);
  });

  it('write gates (useIsOnline) stay open offline only while the queue is on', async () => {
    netStartsOffline();
    const before = await renderHook(() => useIsOnline());
    expect(before.result.current).toBe(false);

    stop = startSync();
    await waitFor(() => expect(before.result.current).toBe(true));
    stop();
    stop = () => undefined;
    await waitFor(() => expect(before.result.current).toBe(false));
  });

  it('offline banner says changes are kept and counts the waiting ones', async () => {
    netStartsOffline();
    mockFetch();
    stop = startSync();
    await render(<OfflineBanner />);
    expect(await screen.findByText(vi.sync.offline)).toBeOnTheScreen();

    await act(async () => {
      await apiFetch('/api/v1/labels', { method: 'POST', body: { name: 'x' } });
    });

    expect(await screen.findByText(vi.sync.offlinePending.replace('{{n}}', '1'))).toBeOnTheScreen();
  });

  it('shows the pill while connected and a send is waiting to be retried', async () => {
    mockFetch().mockResolvedValue(jsonResponse(503, { title: 'down', status: 503 }));
    stop = startSync();
    await render(<SyncStatusPill />);
    expect(screen.queryByTestId('sync-status')).toBeNull();

    await act(async () => {
      syncQueue.enqueue({ type: 'label_add', tempId: 'a', args: { id: 'a', name: 'n' } });
    });

    await waitFor(() => expect(screen.getByTestId('sync-status')).toBeOnTheScreen());
  });
});

describe('confirmDiscardUnsynced', () => {
  afterEach(async () => {
    await clearSyncData();
    jest.restoreAllMocks();
  });

  it('is true at once when nothing waits (no dialog)', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await expect(confirmDiscardUnsynced()).resolves.toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  it('asks before losing unsynced changes: "Stay" keeps them, "Sign out and discard" lets go', async () => {
    netStartsOffline();
    mockFetch();
    const stopSync = startSync(); // offline: nothing can be flushed first
    syncQueue.enqueue({ type: 'label_add', tempId: 'a', args: { id: 'a', name: 'n' } });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[0]?.onPress?.(); // Stay
    });

    await expect(confirmDiscardUnsynced()).resolves.toBe(false);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe(vi.sync.discard.title);
    expect(alert.mock.calls[0][1]).toBe(vi.sync.discard.message.replace('{{n}}', '1'));
    expect(pendingSyncCount()).toBe(1);

    alert.mockImplementation((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.(); // Sign out and discard
    });
    await expect(confirmDiscardUnsynced()).resolves.toBe(true);
    stopSync();
  });

  it('flushes first when online, so a queue that empties in time needs no question', async () => {
    jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: true } as NetInfoState);
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body)) as SyncRequest;
      return jsonResponse(200, {
        syncToken: '1.1',
        fullSync: false,
        changes: {},
        deleted: [],
        results: request.commands.map((c) => ({ uuid: c.uuid, status: 'ok', error: null })),
        tempIdMapping: {},
      });
    });
    await tokenStore.setTokens({ accessToken: 'acc', refreshToken: 'ref' });
    const stopSync = startSync();
    await new Promise((resolve) => setTimeout(resolve, 0)); // NetInfo.fetch has answered: connected
    syncQueue.enqueue({ type: 'label_add', tempId: 'a', args: { id: 'a', name: 'n' } });
    const alert = jest.spyOn(Alert, 'alert');

    await expect(confirmDiscardUnsynced()).resolves.toBe(true);
    expect(alert).not.toHaveBeenCalled();
    expect(pendingSyncCount()).toBe(0);
    stopSync();
  });
});
