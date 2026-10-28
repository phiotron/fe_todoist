import { act, renderHook } from '@testing-library/react-native';
import type { SyncStatus } from '../../../lib/sync/types';
import { useSyncPill } from '../useSyncPill';

/** PERF: the "Đang đồng bộ" pill shows only for a send that lasts (> 1 s) and never flickers. */

const idle: SyncStatus = { pending: 0, syncing: false, rejected: 0 };
const syncing: SyncStatus = { pending: 0, syncing: true, rejected: 0 };
const waiting: SyncStatus = { pending: 2, syncing: false, rejected: 0 };

function setup(initial: SyncStatus, connected = true) {
  return renderHook(
    ({ status, online }: { status: SyncStatus; online: boolean }) =>
      useSyncPill(status, online, { showDelayMs: 1000, minVisibleMs: 600 }),
    { initialProps: { status: initial, online: connected } },
  );
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('useSyncPill', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays hidden while idle', async () => {
    const { result } = await setup(idle);
    await advance(5000);
    expect(result.current).toBeNull();
  });

  it('a short sync (under the delay) never shows', async () => {
    const hook = await setup(syncing);
    await advance(900);
    expect(hook.result.current).toBeNull();
    await hook.rerender({ status: idle, online: true });
    await advance(5000);
    expect(hook.result.current).toBeNull();
  });

  it('a long sync shows after the delay', async () => {
    const { result } = await setup(syncing);
    await advance(999);
    expect(result.current).toBeNull();
    await advance(1);
    expect(result.current).toEqual({ syncing: true, pending: 0 });
  });

  it('once shown it stays for the minimum time, then hides (no flicker)', async () => {
    const hook = await setup(syncing);
    await advance(1000);
    expect(hook.result.current).not.toBeNull();
    await advance(100);
    await hook.rerender({ status: idle, online: true });
    expect(hook.result.current).not.toBeNull();
    await advance(499);
    expect(hook.result.current).not.toBeNull();
    await advance(1);
    expect(hook.result.current).toBeNull();
  });

  it('changes waiting for a retry show their count after the delay; the label follows the state', async () => {
    const hook = await setup(waiting);
    await advance(1000);
    expect(hook.result.current).toEqual({ syncing: false, pending: 2 });
    await hook.rerender({ status: { pending: 2, syncing: true, rejected: 0 }, online: true });
    expect(hook.result.current).toEqual({ syncing: true, pending: 2 });
  });

  it('offline: hidden at once (the offline banner carries the count)', async () => {
    const hook = await setup(syncing);
    await advance(1000);
    await hook.rerender({ status: syncing, online: false });
    expect(hook.result.current).toBeNull();
  });
});
