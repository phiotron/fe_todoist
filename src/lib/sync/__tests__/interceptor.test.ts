import { QueryClient } from '@tanstack/react-query';
import { OfflineError } from '../../../api/errors';
import { queryKeys } from '../../../api/queryKeys';
import { createWriteInterceptor } from '../interceptor';
import { createCommandQueue, type QueueStorage } from '../queue';

const storage: QueueStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

function setup(connected: boolean) {
  let n = 0;
  const queue = createCommandQueue(storage, () => `c${++n}`);
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const state = { connected };
  const trigger = jest.fn();
  const intercept = createWriteInterceptor({
    queue,
    queryClient,
    isConnected: () => state.connected,
    newId: () => `id-${++n}`,
    now: () => new Date('2026-10-28T10:00:00Z'),
    trigger,
  });
  return { queue, queryClient, state, trigger, intercept };
}

describe('write interceptor', () => {
  it('queues a mappable write while offline and answers with the built record', () => {
    const { queue, intercept, trigger } = setup(false);
    const handled = intercept('/api/v1/tasks', { method: 'POST', body: { content: 'offline task' }, idempotencyKey: 'k' });

    expect(handled?.value).toMatchObject({ content: 'offline task' });
    expect(queue.size()).toBe(1);
    expect(queue.peek(1)[0]).toMatchObject({ type: 'task_add' });
    expect(queue.peek(1)[0].tempId).toBeDefined();
    expect(queue.peek(1)[0].args.id).toBe(queue.peek(1)[0].tempId);
    expect(trigger).not.toHaveBeenCalled(); // offline: the engine runs when the network is back
  });

  it('lets a connected write with an empty queue go to the server untouched (M1–M5 behaviour)', () => {
    const { queue, intercept } = setup(true);
    expect(intercept('/api/v1/tasks', { method: 'POST', body: { content: 'x' } })).toBeNull();
    expect(queue.size()).toBe(0);
  });

  it('queues even while connected when earlier commands still wait (never overtake them) and wakes the engine', () => {
    const { queue, intercept, state, trigger } = setup(false);
    intercept('/api/v1/tasks', { method: 'POST', body: { content: 'first' } });
    state.connected = true;

    const handled = intercept('/api/v1/tasks/abc/close', { method: 'POST' });

    expect(handled).not.toBeNull();
    expect(queue.size()).toBe(2);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('never touches reads, public requests or requests with getBody', () => {
    const { queue, intercept } = setup(false);
    expect(intercept('/api/v1/tasks', {})).toBeNull();
    expect(intercept('/api/v1/tasks', { method: 'GET' })).toBeNull();
    expect(intercept('/api/v1/auth/login', { method: 'POST', body: {}, auth: false })).toBeNull();
    expect(intercept('/api/v1/auth/logout', { method: 'POST', getBody: async () => ({}) })).toBeNull();
    expect(queue.size()).toBe(0);
  });

  it('answers OfflineError for a write that cannot be queued while offline', () => {
    const { intercept } = setup(false);
    expect(() => intercept('/api/v1/tasks/batch', { method: 'POST', body: { action: 'DELETE' } })).toThrow(OfflineError);
    expect(() => intercept('/api/v1/reorder', { method: 'POST', body: {} })).toThrow(OfflineError);
    expect(() => intercept('/api/v1/me/settings', { method: 'PATCH', body: {} })).toThrow(OfflineError);
  });

  it('lets read-only POSTs through offline (they fail as a plain network error, like before)', () => {
    const { intercept } = setup(false);
    expect(intercept('/api/v1/filters/validate', { method: 'POST', body: { query: 'p1' } })).toBeNull();
  });

  it('passes an unmappable write through while connected', () => {
    const { intercept } = setup(true);
    expect(intercept('/api/v1/tasks/batch', { method: 'POST', body: {} })).toBeNull();
  });

  it('patches the caches so the offline edit shows at once', () => {
    const { intercept, queryClient } = setup(false);
    queryClient.setQueryData(queryKeys.labels.list(), []);
    intercept('/api/v1/labels', { method: 'POST', body: { name: 'home' } });
    expect(queryClient.getQueryData<{ name: string }[]>(queryKeys.labels.list())).toMatchObject([{ name: 'home' }]);
  });
});
