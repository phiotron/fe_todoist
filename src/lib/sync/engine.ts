import { ApiError, NetworkError } from '../../api/errors';
import type { CommandQueue, QueueStorage } from './queue';
import { SYNC_TOKEN_STORAGE_KEY } from './queue';
import {
  MAX_ATTEMPTS,
  MAX_COMMANDS_PER_REQUEST,
  type SyncCommandResult,
  type SyncRequest,
  type SyncResponse,
  type SyncStatus,
} from './types';

export interface SyncEngineDeps {
  queue: CommandQueue;
  /** POST /api/v1/sync. Rejects with NetworkError (offline / timeout) or ApiError (whole-request failure). */
  send(request: SyncRequest): Promise<SyncResponse>;
  isOnline(): boolean;
  /** The server state may differ from the caches: refresh them (a sent command, a `changes` entry or a tombstone). */
  onServerChanged(): void;
  storage: QueueStorage;
  maxAttempts?: number;
  tokenKey?: string;
}

export interface SyncEngine {
  /** Sends the queued commands (≤ 100 per request, in order) until the queue is empty or a send fails; one at a time. */
  run(): Promise<void>;
  status(): SyncStatus;
  subscribe(listener: () => void): () => void;
  /** Forget the token (sign-out / new account). */
  reset(): Promise<void>;
}

/** Lock contention or a server hiccup: the command is fine, try it again later. */
export function isTemporaryFailure(result: SyncCommandResult): boolean {
  const status = result.error?.status ?? 0;
  return status >= 500 || (status === 409 && result.error?.code === 'version-conflict');
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const { queue, send, storage } = deps;
  const maxAttempts = deps.maxAttempts ?? MAX_ATTEMPTS;
  const tokenKey = deps.tokenKey ?? SYNC_TOKEN_STORAGE_KEY;
  const listeners = new Set<() => void>();
  let syncing = false;
  let rejected = 0;
  let token: string | null | undefined; // undefined = not read from disk yet
  let running: Promise<void> | null = null;
  let again = false;
  let generation = 0;

  const emit = () => [...listeners].forEach((l) => l());
  queue.subscribe(emit);

  async function readToken(): Promise<string | null> {
    if (token !== undefined) return token;
    try {
      token = (await storage.getItem(tokenKey)) ?? null;
    } catch {
      token = null;
    }
    return token;
  }

  function writeToken(next: string | null) {
    token = next;
    const write = next === null ? storage.removeItem(tokenKey) : storage.setItem(tokenKey, next);
    void write.catch(() => {
      // Losing the token only costs one full refresh next time.
    });
  }

  /** One request. Returns true to go on with the next batch. */
  async function step(): Promise<boolean> {
    const startGeneration = generation; // before the first await: a reset() at any later point voids this step
    const batch = queue.peek(MAX_COMMANDS_PER_REQUEST);
    const syncToken = await readToken();
    if (startGeneration !== generation) return false;
    // Nothing to send and a token already: a pure pull, only worth it when something may have changed elsewhere.
    const request: SyncRequest = {
      syncToken,
      commands: batch.map(({ uuid, type, tempId, args }) => ({ uuid, type, ...(tempId ? { tempId } : {}), args })),
      // First contact: only fetch a token, the caches are already fresh from the normal reads.
      ...(syncToken === null ? { resourceTypes: [] } : {}),
    };
    let response: SyncResponse;
    try {
      response = await send(request);
    } catch (error) {
      if (startGeneration !== generation) return false;
      if (error instanceof ApiError && error.status === 400 && error.code === 'sync-token-invalid') {
        writeToken(null); // a broken token: start over with a fresh one
        return true;
      }
      if (!(error instanceof NetworkError) && !(error instanceof ApiError && error.status >= 500)) {
        // The server refused the whole request for a reason a retry cannot fix (e.g. 400 on a malformed command):
        // count it against the batch so one poison command cannot block the queue for ever.
        const dropped = queue.recordFailure(new Set(batch.map((c) => c.uuid)), maxAttempts);
        rejected += dropped.length;
        if (dropped.length > 0) deps.onServerChanged();
      }
      return false;
    }
    if (startGeneration !== generation) return false; // signed out while the request was on the wire
    writeToken(response.syncToken);

    const byUuid = new Map(response.results.map((r) => [r.uuid, r]));
    const finished = new Set<string>();
    const retry = new Set<string>();
    for (const command of batch) {
      const result = byUuid.get(command.uuid);
      if (!result || result.status === 'ok') {
        finished.add(command.uuid);
      } else if (isTemporaryFailure(result)) {
        retry.add(command.uuid);
      } else {
        finished.add(command.uuid);
        rejected += 1; // refused for good: the record goes back to the server's state on the refresh below
      }
    }
    queue.remove(finished);
    const dropped = queue.recordFailure(retry, maxAttempts);
    rejected += dropped.length;

    const hasChanges =
      Object.values(response.changes).some((list) => list.length > 0) || response.deleted.length > 0;
    if (batch.length > 0 || hasChanges) deps.onServerChanged();
    // A temporary failure stops this run (the next trigger retries); otherwise go on while commands remain.
    return retry.size === 0 && queue.size() > 0;
  }

  async function loop(): Promise<void> {
    syncing = true;
    emit();
    try {
      do {
        again = false;
        let more = true;
        while (more && deps.isOnline()) {
          more = await step();
        }
      } while (again && deps.isOnline());
    } finally {
      syncing = false;
      running = null;
      emit();
    }
  }

  return {
    run() {
      if (!deps.isOnline()) return Promise.resolve();
      if (running) {
        again = true;
        return running;
      }
      running = loop();
      return running;
    },
    status: () => ({ pending: queue.size(), syncing, rejected }),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async reset() {
      generation += 1;
      token = null;
      rejected = 0;
      try {
        await storage.removeItem(tokenKey);
      } catch {
        // Nothing to do.
      }
      emit();
    },
  };
}
