import { createSyncScheduler, type SyncRunOutcome } from '../scheduler';

/** When the running app asks the engine to sync (PERF): debounce, pull interval, backoff, no overlapping runs. */

function setup(opts: { pending?: number; outcomes?: SyncRunOutcome[] } = {}) {
  const state = { pending: opts.pending ?? 0, outcomes: [...(opts.outcomes ?? [])] };
  const run = jest.fn(async (): Promise<SyncRunOutcome> => state.outcomes.shift() ?? 'done');
  const scheduler = createSyncScheduler({
    run,
    pending: () => state.pending,
    now: () => Date.now(),
    debounceMs: 300,
    minPullIntervalMs: 30_000,
    backoffBaseMs: 2_000,
    backoffMaxMs: 60_000,
  });
  return { scheduler, run, state };
}

/** Advance the fake clock and let the run's promise settle. */
async function advance(ms: number) {
  await jest.advanceTimersByTimeAsync(ms);
}

describe('sync scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('collapses many requests within the debounce window into one run', async () => {
    const { scheduler, run, state } = setup();
    state.pending = 1;
    for (let i = 0; i < 10; i++) scheduler.request('write');
    await advance(299);
    expect(run).not.toHaveBeenCalled();
    await advance(1);
    expect(run).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('skips a pull (nothing waiting) within the pull interval after a sync that worked', async () => {
    const { scheduler, run } = setup();
    scheduler.request('start');
    await advance(300);
    expect(run).toHaveBeenCalledTimes(1);

    scheduler.request('foreground');
    scheduler.request('reconnect');
    await advance(29_000);
    expect(run).toHaveBeenCalledTimes(1);

    await advance(1_000);
    scheduler.request('foreground');
    await advance(300);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('always sends waiting changes, even right after a sync', async () => {
    const { scheduler, run, state } = setup();
    scheduler.request('start');
    await advance(300);
    state.pending = 2;
    scheduler.request('write');
    await advance(300);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('retries waiting changes by itself after a failure, backing off 2 s, 4 s, ... and resets after a success', async () => {
    const { scheduler, run, state } = setup({ outcomes: ['failed', 'failed', 'done'] });
    state.pending = 1;
    scheduler.request('write');
    await advance(300);
    expect(run).toHaveBeenCalledTimes(1);

    await advance(1_999);
    expect(run).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(run).toHaveBeenCalledTimes(2);

    await advance(3_999);
    expect(run).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(run).toHaveBeenCalledTimes(3); // done

    state.pending = 1;
    scheduler.request('write');
    await advance(300); // back to the plain debounce
    expect(run).toHaveBeenCalledTimes(4);
    scheduler.stop();
  });

  it('holds writes made during the back-off until it ends instead of hammering a failing server', async () => {
    const { scheduler, run, state } = setup({ outcomes: ['failed'] });
    state.pending = 1;
    scheduler.request('write');
    await advance(300);
    scheduler.request('write');
    scheduler.request('write');
    await advance(1_000);
    expect(run).toHaveBeenCalledTimes(1);
    await advance(1_000);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('the connection coming back ends the back-off at once', async () => {
    const { scheduler, run, state } = setup({ outcomes: ['failed'] });
    state.pending = 1;
    scheduler.request('write');
    await advance(300);
    scheduler.request('reconnect');
    await advance(300);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('does not retry a failed pull when nothing waits, nor anything while offline', async () => {
    const { scheduler, run, state } = setup({ outcomes: ['failed', 'offline'] });
    scheduler.request('start');
    await advance(300);
    await advance(120_000);
    expect(run).toHaveBeenCalledTimes(1);

    state.pending = 1;
    scheduler.request('write');
    await advance(300);
    await advance(120_000);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('stop() cancels what was planned', async () => {
    const { scheduler, run, state } = setup();
    state.pending = 1;
    scheduler.request('write');
    scheduler.stop();
    await advance(5_000);
    scheduler.request('write');
    await advance(5_000);
    expect(run).not.toHaveBeenCalled();
  });
});
