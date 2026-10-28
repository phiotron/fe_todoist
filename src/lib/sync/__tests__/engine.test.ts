import { ApiError, NetworkError } from '../../../api/errors';
import { createSyncEngine, isTemporaryFailure } from '../engine';
import { createCommandQueue, SYNC_TOKEN_STORAGE_KEY, type QueueStorage } from '../queue';
import type { SyncCommandResult, SyncRequest, SyncResponse } from '../types';

function memoryStorage(): QueueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };
}

const ok = (uuid: string): SyncCommandResult => ({ uuid, status: 'ok', error: null });
const failed = (uuid: string, status: number, code?: string): SyncCommandResult => ({
  uuid,
  status: 'error',
  error: { status, ...(code ? { code } : {}) },
});

function response(partial: Partial<SyncResponse> = {}): SyncResponse {
  return { syncToken: 'tok-1', fullSync: false, changes: {}, deleted: [], results: [], tempIdMapping: {}, ...partial };
}

function setup(opts: { online?: boolean; maxAttempts?: number } = {}) {
  let n = 0;
  const storage = memoryStorage();
  const queue = createCommandQueue(storage, () => `c${++n}`);
  const requests: SyncRequest[] = [];
  const state = { online: opts.online ?? true, reply: (req: SyncRequest): Promise<SyncResponse> | SyncResponse =>
    response({ results: req.commands.map((c) => ok(c.uuid)) }) };
  const onServerChanged = jest.fn();
  const engine = createSyncEngine({
    queue,
    storage,
    send: async (req) => {
      requests.push(req);
      return state.reply(req);
    },
    isOnline: () => state.online,
    onServerChanged,
    maxAttempts: opts.maxAttempts,
  });
  return { queue, storage, engine, requests, state, onServerChanged };
}

const add = (id: string) => ({ type: 'task_add', tempId: id, args: { id } });

describe('sync engine', () => {
  it('sends queued commands in order and removes the accepted ones', async () => {
    const { queue, engine, requests, onServerChanged } = setup();
    queue.enqueue(add('a'));
    queue.enqueue({ type: 'task_close', args: { id: 'a' } });

    await engine.run();

    expect(requests).toHaveLength(1);
    expect(requests[0].commands.map((c) => c.type)).toEqual(['task_add', 'task_close']);
    expect(requests[0].commands[0]).toEqual({ uuid: 'c1', type: 'task_add', tempId: 'a', args: { id: 'a' } });
    expect(queue.size()).toBe(0);
    expect(onServerChanged).toHaveBeenCalled();
  });

  it('does nothing offline and keeps the queue', async () => {
    const { queue, engine, requests } = setup({ online: false });
    queue.enqueue(add('a'));
    await engine.run();
    expect(requests).toHaveLength(0);
    expect(queue.size()).toBe(1);
  });

  it('first contact asks only for a token and does not refresh the caches', async () => {
    const { engine, requests, onServerChanged, storage } = setup();
    await engine.run();

    expect(requests[0]).toEqual({ syncToken: null, commands: [], resourceTypes: [] });
    expect(storage.data.get(SYNC_TOKEN_STORAGE_KEY)).toBe('tok-1');
    expect(onServerChanged).not.toHaveBeenCalled();
  });

  it('sends the stored token afterwards and refreshes when the server reports changes', async () => {
    const { engine, requests, state, onServerChanged } = setup();
    await engine.run();
    state.reply = () => response({ syncToken: 'tok-2', changes: { tasks: [{ id: 'x' }] } });

    await engine.run();

    expect(requests[1].syncToken).toBe('tok-1');
    expect(requests[1].resourceTypes).toBeUndefined();
    expect(onServerChanged).toHaveBeenCalledTimes(1);
  });

  it('refreshes for a tombstone too', async () => {
    const { engine, state, onServerChanged } = setup();
    await engine.run();
    state.reply = () => response({ deleted: [{ type: 'TASK', id: 'x' }] });
    await engine.run();
    expect(onServerChanged).toHaveBeenCalledTimes(1);
  });

  it('splits more than 100 commands into several requests', async () => {
    const { queue, engine, requests } = setup();
    for (let i = 0; i < 230; i++) queue.enqueue({ type: 'label_delete', args: { id: `l${i}` } });

    await engine.run();

    expect(requests.map((r) => r.commands.length)).toEqual([100, 100, 30]);
    expect(queue.size()).toBe(0);
  });

  it('keeps a network failure in the queue (attempts untouched) and stops', async () => {
    const { queue, engine, state } = setup();
    queue.enqueue(add('a'));
    state.reply = () => {
      throw new NetworkError();
    };

    await engine.run();

    expect(queue.size()).toBe(1);
    expect(queue.all()[0].attempts).toBe(0);
    expect(engine.status().syncing).toBe(false);
  });

  it('drops a refused command for good, keeps the others, and counts it as rejected', async () => {
    const { queue, engine, state, onServerChanged } = setup();
    queue.enqueue({ type: 'task_update', args: { id: 'gone' } });
    queue.enqueue(add('b'));
    state.reply = (req) =>
      response({ results: [failed(req.commands[0].uuid, 404), ok(req.commands[1].uuid)] });

    await engine.run();

    expect(queue.size()).toBe(0);
    expect(engine.status().rejected).toBe(1);
    expect(onServerChanged).toHaveBeenCalled();
  });

  it('retries a lock-contention (409 version-conflict) or 5xx command later, then gives up after maxAttempts', async () => {
    const { queue, engine, state } = setup({ maxAttempts: 2 });
    queue.enqueue(add('a'));
    state.reply = (req) => response({ results: [failed(req.commands[0].uuid, 409, 'version-conflict')] });

    await engine.run();
    expect(queue.size()).toBe(1);
    expect(queue.all()[0].attempts).toBe(1);

    await engine.run();
    expect(queue.size()).toBe(0);
    expect(engine.status().rejected).toBe(1);
  });

  it('does not treat other 409s (id-conflict, project-archived) as temporary', () => {
    expect(isTemporaryFailure(failed('x', 409, 'id-conflict'))).toBe(false);
    expect(isTemporaryFailure(failed('x', 409, 'project-archived'))).toBe(false);
    expect(isTemporaryFailure(failed('x', 422, 'limit-reached'))).toBe(false);
    expect(isTemporaryFailure(failed('x', 404))).toBe(false);
    expect(isTemporaryFailure(failed('x', 500))).toBe(true);
    expect(isTemporaryFailure(failed('x', 409, 'version-conflict'))).toBe(true);
  });

  it('a whole-request 5xx keeps the queue; a whole-request 400 counts against the batch', async () => {
    const { queue, engine, state } = setup({ maxAttempts: 1 });
    queue.enqueue(add('a'));
    state.reply = () => {
      throw new ApiError({ status: 503, title: 'down' });
    };
    await engine.run();
    expect(queue.size()).toBe(1);

    state.reply = () => {
      throw new ApiError({ status: 400, title: 'bad' });
    };
    await engine.run();
    expect(queue.size()).toBe(0); // dropped: one poison command must not block the queue for ever
    expect(engine.status().rejected).toBe(1);
  });

  it('starts over with a fresh token when the server calls the stored one invalid', async () => {
    const { engine, state, requests, storage } = setup();
    storage.data.set(SYNC_TOKEN_STORAGE_KEY, 'garbage');
    let first = true;
    state.reply = () => {
      if (first) {
        first = false;
        throw new ApiError({ status: 400, title: 'bad', code: 'sync-token-invalid' });
      }
      return response({ syncToken: 'fresh' });
    };

    await engine.run();

    expect(requests.map((r) => r.syncToken)).toEqual(['garbage', null]);
    expect(storage.data.get(SYNC_TOKEN_STORAGE_KEY)).toBe('fresh');
  });

  it('runs one request at a time and picks up a command enqueued meanwhile', async () => {
    const { queue, engine, state, requests } = setup();
    queue.enqueue(add('a'));
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    state.reply = async (req) => {
      calls += 1;
      if (calls === 1) await gate;
      return response({ results: req.commands.map((c) => ok(c.uuid)) });
    };

    const first = engine.run();
    queue.enqueue(add('b'));
    const second = engine.run();
    expect(engine.status().syncing).toBe(true);
    release();
    await Promise.all([first, second]);

    expect(requests.flatMap((r) => r.commands.map((c) => c.tempId))).toEqual(['a', 'b']);
    expect(queue.size()).toBe(0);
  });

  it('reset() forgets the token and ignores a response that arrives after it', async () => {
    const { queue, engine, state, storage } = setup();
    queue.enqueue(add('a'));
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.reply = async (req) => {
      await gate;
      return response({ syncToken: 'late', results: req.commands.map((c) => ok(c.uuid)) });
    };

    const running = engine.run();
    await new Promise((resolve) => setTimeout(resolve, 0)); // the request is on the wire now
    await engine.reset();
    release();
    await running;

    expect(storage.data.has(SYNC_TOKEN_STORAGE_KEY)).toBe(false);
  });

  it('a reset() before the request is even built voids the step', async () => {
    const { queue, engine, requests } = setup();
    queue.enqueue(add('a'));
    const running = engine.run();
    await engine.reset();
    await running;
    expect(requests).toHaveLength(0);
  });

  // ---- PERF: what the runtime needs to refresh narrowly and to back off ----

  it('tells which resources the server reported changed (changes keys and tombstone types)', async () => {
    const { engine, state, onServerChanged } = setup();
    await engine.run();
    state.reply = () =>
      response({ changes: { tasks: [{ id: 'x' }], labels: [], projects: [] }, deleted: [{ type: 'LABEL', id: 'l' }] });

    await engine.run();

    expect(onServerChanged).toHaveBeenCalledWith({ resources: ['tasks', 'LABEL'], everything: false });
  });

  it('asks for a full refresh when a command was refused (the optimistic patch must go)', async () => {
    const { queue, engine, state, onServerChanged } = setup();
    await engine.run();
    queue.enqueue({ type: 'task_update', args: { id: 'gone' } });
    state.reply = (req) => response({ results: [failed(req.commands[0].uuid, 404)] });

    await engine.run();

    expect(onServerChanged).toHaveBeenCalledWith(expect.objectContaining({ everything: true }));
  });

  it('asks for a full refresh when commands went out with the first-contact request (no change list)', async () => {
    const { queue, engine, onServerChanged } = setup();
    queue.enqueue(add('a'));
    await engine.run();
    expect(onServerChanged).toHaveBeenCalledWith(expect.objectContaining({ everything: true }));
  });

  it('answers how the run ended: done, failed or offline', async () => {
    const { queue, engine, state } = setup();
    await expect(engine.run()).resolves.toBe('done');

    queue.enqueue(add('a'));
    state.reply = () => {
      throw new NetworkError();
    };
    await expect(engine.run()).resolves.toBe('failed');

    state.reply = (req) => response({ results: [failed(req.commands[0].uuid, 409, 'version-conflict')] });
    await expect(engine.run()).resolves.toBe('failed');

    state.online = false;
    await expect(engine.run()).resolves.toBe('offline');
  });

  it('a run asked for while one is on the wire sends the new commands but no extra empty pull', async () => {
    const { queue, engine, state, requests } = setup();
    await engine.run(); // token
    queue.enqueue(add('a'));
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    state.reply = async (req) => {
      calls += 1;
      if (calls === 1) await gate;
      return response({ results: req.commands.map((c) => ok(c.uuid)) });
    };

    const first = engine.run();
    queue.enqueue(add('b'));
    const second = engine.run();
    release();
    await Promise.all([first, second]);

    expect(requests.slice(1).map((r) => r.commands.length)).toEqual([1, 1]);
  });

  it('reports status changes to subscribers', async () => {
    const { queue, engine } = setup();
    const seen: number[] = [];
    engine.subscribe(() => seen.push(engine.status().pending));
    queue.enqueue(add('a'));
    await engine.run();
    expect(seen[0]).toBe(1);
    expect(seen[seen.length - 1]).toBe(0);
  });
});
