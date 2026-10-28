import type { SyncRunOutcome } from './engine';

export type { SyncRunOutcome };

/**
 * Why the app asks for a sync. 'start' = signed-in layout mounted (app open / sign-in); 'write' = a command was queued;
 * 'foreground' = the app came back; 'reconnect' = the connection came back.
 */
export type SyncReason = 'start' | 'write' | 'foreground' | 'reconnect';

export interface SyncSchedulerDeps {
  /** One engine run (the engine itself never overlaps two). */
  run(): Promise<SyncRunOutcome>;
  /** Commands waiting in the queue. */
  pending(): number;
  now(): number;
  /** Requests within this window collapse into one run (N quick writes = one request). */
  debounceMs?: number;
  /** A pull with nothing to send is skipped this long after a sync that worked (TanStack refetches on focus anyway). */
  minPullIntervalMs?: number;
  /** After a failed run with changes waiting: retry after base, 2×base, 4×base... up to max. */
  backoffBaseMs?: number;
  backoffMaxMs?: number;
}

export interface SyncScheduler {
  request(reason: SyncReason): void;
  /** Cancels what was planned; later requests are ignored (sign-out). */
  stop(): void;
}

export const SYNC_DEBOUNCE_MS = 300;
export const MIN_PULL_INTERVAL_MS = 30_000;
export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAX_MS = 60_000;

/**
 * Decides WHEN the M9 engine runs (PERF): it used to run at once on every trigger — each foreground pulled, each queued
 * write sent its own request. Now: debounced, a pull without changes to send waits for the pull interval, a failed
 * send backs off (and is retried by itself while changes wait), and the connection coming back ends the back-off.
 */
export function createSyncScheduler(deps: SyncSchedulerDeps): SyncScheduler {
  const debounceMs = deps.debounceMs ?? SYNC_DEBOUNCE_MS;
  const minPullIntervalMs = deps.minPullIntervalMs ?? MIN_PULL_INTERVAL_MS;
  const backoffBaseMs = deps.backoffBaseMs ?? BACKOFF_BASE_MS;
  const backoffMaxMs = deps.backoffMaxMs ?? BACKOFF_MAX_MS;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let timerAt = 0;
  let lastOkAt = Number.NEGATIVE_INFINITY;
  let failures = 0;
  let retryAt = 0;
  let stopped = false;

  function planAt(at: number) {
    if (timer !== null && timerAt <= at) return; // an earlier run already covers this request
    if (timer !== null) clearTimeout(timer);
    timerAt = at;
    timer = setTimeout(() => void fire(), Math.max(0, at - deps.now()));
  }

  async function fire() {
    timer = null;
    if (stopped) return;
    const outcome = await deps.run();
    if (stopped) return;
    if (outcome === 'done') {
      failures = 0;
      retryAt = 0;
      lastOkAt = deps.now();
    } else if (outcome === 'failed') {
      failures += 1;
      retryAt = deps.now() + Math.min(backoffBaseMs * 2 ** (failures - 1), backoffMaxMs);
      if (deps.pending() > 0) planAt(retryAt);
    }
    // 'offline': the connection coming back asks again.
  }

  return {
    request(reason) {
      if (stopped) return;
      const now = deps.now();
      if (reason === 'start' || reason === 'reconnect') {
        failures = 0;
        retryAt = 0;
      }
      const pull = deps.pending() === 0;
      if (pull && reason !== 'start' && now - lastOkAt < minPullIntervalMs) return;
      planAt(Math.max(now + debounceMs, retryAt));
    },
    stop() {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
