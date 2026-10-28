import { createCommandQueue, QUEUE_STORAGE_KEY, type QueueStorage } from '../queue';

function memoryStorage(initial: Record<string, string> = {}): QueueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
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

let counter = 0;
const uuid = () => `u${++counter}`;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  counter = 0;
});

describe('command queue', () => {
  it('keeps commands in order and stamps uuid / time / attempts', () => {
    const queue = createCommandQueue(memoryStorage(), uuid, () => 1000);
    queue.enqueue({ type: 'task_add', tempId: 't', args: { id: 't' } });
    queue.enqueue({ type: 'task_close', args: { id: 't' } });

    expect(queue.size()).toBe(2);
    expect(queue.peek(10)).toEqual([
      { uuid: 'u1', type: 'task_add', tempId: 't', args: { id: 't' }, enqueuedAt: 1000, attempts: 0 },
      { uuid: 'u2', type: 'task_close', args: { id: 't' }, enqueuedAt: 1000, attempts: 0 },
    ]);
    expect(queue.peek(1)).toHaveLength(1);
  });

  it('writes every change to disk and removes the key when empty', async () => {
    const storage = memoryStorage();
    const queue = createCommandQueue(storage, uuid);
    const { uuid: first } = queue.enqueue({ type: 'label_add', tempId: 'l', args: { id: 'l' } });
    await flush();
    expect(JSON.parse(storage.data.get(QUEUE_STORAGE_KEY) ?? '[]')).toHaveLength(1);

    queue.remove(new Set([first]));
    await flush();
    expect(storage.data.has(QUEUE_STORAGE_KEY)).toBe(false);
  });

  it('loads what an earlier run left on disk, ahead of commands enqueued before load() finished', async () => {
    const stored = [{ uuid: 'old', type: 'task_add', args: { id: 'a' }, enqueuedAt: 1, attempts: 2 }];
    const storage = memoryStorage({ [QUEUE_STORAGE_KEY]: JSON.stringify(stored) });
    const queue = createCommandQueue(storage, uuid);
    queue.enqueue({ type: 'task_close', args: { id: 'a' } });

    await queue.load();

    expect(queue.all().map((c) => c.uuid)).toEqual(['old', 'u1']);
    expect(queue.all()[0].attempts).toBe(2);
  });

  it('survives a corrupt or foreign file', async () => {
    const queue = createCommandQueue(memoryStorage({ [QUEUE_STORAGE_KEY]: '{not json' }), uuid);
    await queue.load();
    expect(queue.size()).toBe(0);
    const other = createCommandQueue(memoryStorage({ [QUEUE_STORAGE_KEY]: JSON.stringify([1, { uuid: 5 }, null]) }), uuid);
    await other.load();
    expect(other.size()).toBe(0);
  });

  it('counts failures and drops a command past the limit', () => {
    const queue = createCommandQueue(memoryStorage(), uuid);
    const { uuid: id } = queue.enqueue({ type: 'task_add', tempId: 'a', args: { id: 'a' } });

    expect(queue.recordFailure(new Set([id]), 2)).toEqual([]);
    expect(queue.all()[0].attempts).toBe(1);
    const dropped = queue.recordFailure(new Set([id]), 2);
    expect(dropped.map((c) => c.uuid)).toEqual([id]);
    expect(queue.size()).toBe(0);
  });

  it('clear() empties memory and disk and is never undone by a late load()', async () => {
    const stored = [{ uuid: 'old', type: 'task_add', args: {}, enqueuedAt: 1, attempts: 0 }];
    const storage = memoryStorage({ [QUEUE_STORAGE_KEY]: JSON.stringify(stored) });
    const queue = createCommandQueue(storage, uuid);

    await queue.clear();
    await queue.load();

    expect(queue.size()).toBe(0);
    expect(storage.data.has(QUEUE_STORAGE_KEY)).toBe(false);
  });

  it('keeps the commands in memory when the disk write fails, and writes again on the next change', async () => {
    const storage = memoryStorage();
    let fail = true;
    const setItem = storage.setItem;
    storage.setItem = async (key, value) => {
      if (fail) throw new Error('disk full');
      await setItem(key, value);
    };
    const queue = createCommandQueue(storage, uuid);
    queue.enqueue({ type: 'label_add', tempId: 'a', args: { id: 'a' } });
    await flush();
    expect(queue.size()).toBe(1);

    fail = false;
    queue.enqueue({ type: 'label_add', tempId: 'b', args: { id: 'b' } });
    await flush();
    expect(JSON.parse(storage.data.get(QUEUE_STORAGE_KEY) ?? '[]')).toHaveLength(2);
  });

  it('notifies subscribers and survives a throwing one', () => {
    const queue = createCommandQueue(memoryStorage(), uuid);
    const bad = jest.fn(() => {
      throw new Error('boom');
    });
    const good = jest.fn();
    queue.subscribe(bad);
    const off = queue.subscribe(good);

    queue.enqueue({ type: 'label_add', args: {} });
    expect(good).toHaveBeenCalledTimes(1);
    off();
    queue.enqueue({ type: 'label_add', args: {} });
    expect(good).toHaveBeenCalledTimes(1);
  });
});
