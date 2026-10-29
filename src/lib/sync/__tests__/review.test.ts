import { QueryClient } from '@tanstack/react-query';
import type { Task } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { mapRequest } from '../commandMap';
import { createWriteInterceptor } from '../interceptor';
import { impactOfWrite } from '../invalidation';
import { applyOptimistic } from '../optimistic';
import { createCommandQueue, type QueueStorage } from '../queue';

const NOW = '2026-10-29T10:00:00.000Z';
const newId = () => 'gen';

function task(id: string, extra: Record<string, unknown> = {}): Task {
  return {
    id, projectId: 'pt', sectionId: null, parentId: null, content: `task ${id}`, description: '', priority: 4,
    dueDate: null, dueDatetime: null, durationMinutes: null, deadlineDate: null, dueString: null, isOverdue: false,
    completedAt: null, subtaskCount: 0, completedSubtaskCount: 0, sortOrder: 1, version: 3, createdAt: NOW, updatedAt: NOW,
    projectName: 'Nhom', parentContent: null, labelIds: [],
    reviewStatus: 'NONE', reviewRequestedBy: null, reviewRequestedAt: null, ...extra,
  } as unknown as Task;
}

function setup(caps: Record<string, boolean>, t1: Record<string, unknown> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  qc.setQueryData(queryKeys.projects.list(false), [{ id: 'pt', name: 'Nhom', isInbox: false, capabilities: caps }]);
  qc.setQueryData(queryKeys.tasks.list({ view: 'today' }), { pages: [{ items: [task('t1', t1)], nextCursor: null }], pageParams: [null] });
  qc.setQueryData(queryKeys.tasks.list({ view: 'review' }), {
    pages: [{ items: [task('t1', { reviewStatus: 'PENDING' }), task('t2', { reviewStatus: 'PENDING' })], nextCursor: null }],
    pageParams: [null],
  });
  qc.setQueryData(queryKeys.tasks.detail('t1'), task('t1', t1));
  return qc;
}
const items = (qc: QueryClient, key: readonly unknown[]) =>
  (qc.getQueryData<{ pages: { items: Task[] }[] }>(key)?.pages ?? []).flatMap((p) => p.items);

const MEMBER = { canEditTasks: false, canCompleteTasks: true, canManageSections: false, canComment: false, canReview: false };
const ADMIN = { canEditTasks: true, canCompleteTasks: true, canManageSections: true, canComment: true, canReview: true };

describe('commandMap — review commands', () => {
  it('maps approve / reject to task_review_approve / task_review_reject with { taskId }', () => {
    expect(mapRequest('POST', '/api/v1/tasks/t1/review/approve', undefined, newId)).toEqual({ type: 'task_review_approve', args: { taskId: 't1' } });
    expect(mapRequest('POST', '/api/v1/tasks/t%201/review/reject', undefined, newId)).toEqual({ type: 'task_review_reject', args: { taskId: 't 1' } });
  });
  it('maps restore to task_review_restore with { id, requestedBy, requestedAt }', () => {
    const body = { requestedBy: 'u-binh', requestedAt: NOW };
    expect(mapRequest('POST', '/api/v1/tasks/t%201/review/restore', body, newId)).toEqual({
      type: 'task_review_restore',
      args: { id: 't 1', requestedBy: 'u-binh', requestedAt: NOW },
    });
  });
});

describe('applyOptimistic — tick by role', () => {
  it('Member ticking an open task: PENDING, stays open (not removed), not completed', () => {
    const qc = setup(MEMBER);
    const answer = applyOptimistic(qc, { type: 'task_close', args: { id: 't1' } }, NOW) as { task: Task };
    expect(answer.task).toMatchObject({ completedAt: null, reviewStatus: 'PENDING', reviewRequestedAt: NOW });
    expect(items(qc, queryKeys.tasks.list({ view: 'today' })).map((t) => [t.id, t.reviewStatus])).toEqual([['t1', 'PENDING']]);
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('t1'))?.reviewStatus).toBe('PENDING');
  });
  it('Member ticking their own pending task cancels the request (NONE, still open)', () => {
    const qc = setup(MEMBER, { reviewStatus: 'PENDING', reviewRequestedBy: 'u1', reviewRequestedAt: NOW });
    const answer = applyOptimistic(qc, { type: 'task_close', args: { id: 't1' } }, NOW) as { task: Task };
    expect(answer.task).toMatchObject({ completedAt: null, reviewStatus: 'NONE', reviewRequestedBy: null });
    expect(items(qc, queryKeys.tasks.list({ view: 'today' }))).toHaveLength(1);
  });
  it('Admin completes at once (leaves open lists)', () => {
    const qc = setup(ADMIN);
    const answer = applyOptimistic(qc, { type: 'task_close', args: { id: 't1' } }, NOW) as { task: Task };
    expect(answer.task).toMatchObject({ completedAt: NOW, reviewStatus: 'NONE' });
    expect(items(qc, queryKeys.tasks.list({ view: 'today' }))).toEqual([]);
  });
});

describe('applyOptimistic — approve / reject', () => {
  it('approve: completes, leaves the review list and the open lists', () => {
    const qc = setup(ADMIN, { reviewStatus: 'PENDING' });
    applyOptimistic(qc, { type: 'task_review_approve', args: { taskId: 't1' } }, NOW);
    expect(items(qc, queryKeys.tasks.list({ view: 'review' })).map((t) => t.id)).toEqual(['t2']);
    expect(items(qc, queryKeys.tasks.list({ view: 'today' }))).toEqual([]);
    expect(qc.getQueryData<Task>(queryKeys.tasks.detail('t1'))).toMatchObject({ completedAt: NOW, reviewStatus: 'NONE' });
  });
  it('reject: back to NONE, stays open, leaves the review list only', () => {
    const qc = setup(ADMIN, { reviewStatus: 'PENDING' });
    applyOptimistic(qc, { type: 'task_review_reject', args: { taskId: 't1' } }, NOW);
    expect(items(qc, queryKeys.tasks.list({ view: 'review' })).map((t) => t.id)).toEqual(['t2']);
    expect(items(qc, queryKeys.tasks.list({ view: 'today' })).map((t) => [t.id, t.reviewStatus, t.completedAt])).toEqual([['t1', 'NONE', null]]);
  });
  it('restore after reject: back to PENDING with the old requester, and the row is in the review list again', () => {
    const qc = setup(ADMIN, { reviewStatus: 'PENDING', reviewRequestedBy: 'u-binh', reviewRequestedAt: '2026-10-29T02:30:00Z' });
    applyOptimistic(qc, { type: 'task_review_reject', args: { taskId: 't1' } }, NOW);
    expect(items(qc, queryKeys.tasks.list({ view: 'review' })).map((t) => t.id)).toEqual(['t2']);
    applyOptimistic(qc, { type: 'task_review_restore', args: { id: 't1', requestedBy: 'u-binh', requestedAt: '2026-10-29T02:30:00Z' } }, NOW);
    expect(items(qc, queryKeys.tasks.list({ view: 'review' })).map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(items(qc, queryKeys.tasks.list({ view: 'today' }))[0]).toMatchObject({
      reviewStatus: 'PENDING', reviewRequestedBy: 'u-binh', reviewRequestedAt: '2026-10-29T02:30:00Z', completedAt: null,
    });
  });
  it('restore of an unknown task does not throw', () => {
    const qc = setup(ADMIN);
    expect(() => applyOptimistic(qc, { type: 'task_review_restore', args: { id: 'zz', requestedBy: 'u', requestedAt: NOW } }, NOW)).not.toThrow();
  });
  it('an unknown task does not throw', () => {
    const qc = setup(ADMIN);
    expect(() => applyOptimistic(qc, { type: 'task_review_approve', args: { taskId: 'zz' } }, NOW)).not.toThrow();
  });
});

describe('impactOfWrite — review writes stay narrow', () => {
  it('restore only edits state (no productivity, no reminders, not "all")', () => {
    const restore = impactOfWrite('POST', '/api/v1/tasks/t1/review/restore', { requestedBy: 'u', requestedAt: NOW });
    expect(restore.roots).not.toBe('all');
    expect([...(restore.roots as Set<string>)]).not.toContain('productivity');
    expect(restore.reminders).toBe(false);
  });
  it('approve completes (productivity, reminders); reject only edits state', () => {
    const approve = impactOfWrite('POST', '/api/v1/tasks/t1/review/approve', undefined);
    const reject = impactOfWrite('POST', '/api/v1/tasks/t1/review/reject', undefined);
    expect([...(approve.roots as Set<string>)]).toContain('productivity');
    expect(approve.reminders).toBe(true);
    expect(reject.roots).not.toBe('all');
    expect([...(reject.roots as Set<string>)]).not.toContain('productivity');
    expect(reject.reminders).toBe(false);
  });
});

function memoryStorage(): QueueStorage {
  const data = new Map<string, string>();
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  };
}

describe('interceptor — review while offline', () => {
  function build(connected: boolean) {
    const qc = setup(ADMIN, { reviewStatus: 'PENDING' });
    const queue = createCommandQueue(memoryStorage(), () => 'u1', () => 1);
    const trigger = jest.fn();
    const intercept = createWriteInterceptor({ queue, queryClient: qc, isConnected: () => connected, newId, now: () => new Date(NOW), trigger });
    return { qc, queue, trigger, intercept };
  }
  it('offline approve is queued with its optimistic effect', () => {
    const { qc, queue, intercept } = build(false);
    expect(intercept('/api/v1/tasks/t1/review/approve', { method: 'POST' })).not.toBeNull();
    expect(queue.size()).toBe(1);
    expect(queue.peek(1)[0]).toMatchObject({ type: 'task_review_approve', args: { taskId: 't1' } });
    expect(items(qc, queryKeys.tasks.list({ view: 'review' })).map((t) => t.id)).toEqual(['t2']);
  });
  it('offline reject then restore are queued in that order, args intact, and the cache ends PENDING', () => {
    const { qc, queue, intercept } = build(false);
    intercept('/api/v1/tasks/t1/review/reject', { method: 'POST' });
    intercept('/api/v1/tasks/t1/review/restore', { method: 'POST', body: { requestedBy: 'u-binh', requestedAt: NOW } });
    expect(queue.peek(5).map((c) => [c.type, c.args])).toEqual([
      ['task_review_reject', { taskId: 't1' }],
      ['task_review_restore', { id: 't1', requestedBy: 'u-binh', requestedAt: NOW }],
    ]);
    expect(items(qc, queryKeys.tasks.list({ view: 'review' })).map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });
  it('connected with an empty queue: plain REST (null), nothing queued', () => {
    const { queue, intercept } = build(true);
    expect(intercept('/api/v1/tasks/t1/review/reject', { method: 'POST' })).toBeNull();
    expect(queue.size()).toBe(0);
  });
});
