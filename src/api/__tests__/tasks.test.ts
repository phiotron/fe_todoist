import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { affected, makeTask, page, taskChange } from '../../test/m1Fixtures';
import { tasksApi } from '../tasks';

const pathOf = (url: string) => url.replace(/^.*\/api\/v1/, '');

describe('tasksApi', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('lists a view, a project or its completed tasks page by page', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, page([makeTask()])));

    await tasksApi.list({ view: 'today' }, null);
    await tasksApi.list({ view: 'upcoming', from: '2026-10-23', to: '2026-11-05' }, 'c2');
    await tasksApi.list({ projectId: 'p1' }, null);
    await tasksApi.list({ projectId: 'p1', completed: true }, null);
    await tasksApi.list({ view: 'overdue' }, null);
    await tasksApi.list({ view: 'completed' }, null);
    await tasksApi.list({ view: 'completed', since: '2026-10-01', until: '2026-10-23' }, 'c9');

    expect([0, 1, 2, 3, 4, 5, 6].map((i) => pathOf(requestAt(fetchMock, i).url))).toEqual([
      '/tasks?view=today',
      '/tasks?view=upcoming&from=2026-10-23&to=2026-11-05&cursor=c2',
      '/tasks?projectId=p1',
      '/tasks?projectId=p1&completed=true',
      '/tasks?view=overdue',
      '/tasks?view=completed',
      '/tasks?view=completed&since=2026-10-01&until=2026-10-23&cursor=c9',
    ]);
  });

  it('lists every subtask of a task in one call (not paged)', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, [makeTask({ id: 'k1', parentId: 't1' })]));

    await expect(tasksApi.subtasks('t1')).resolves.toHaveLength(1);

    expect(pathOf(requestAt(fetchMock, 0).url)).toBe('/tasks/t1/subtasks');
  });

  it('creates and duplicates with an Idempotency-Key', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(201, makeTask({ id: 't9' })));

    await tasksApi.create({ content: 'Mua sữa', dueDatetime: '2026-10-24T09:00:00', durationMinutes: 30 }, 'key-1');
    await tasksApi.duplicate('t1', 'key-2');

    expect(requestAt(fetchMock, 0)).toMatchObject({
      method: 'POST',
      body: { content: 'Mua sữa', dueDatetime: '2026-10-24T09:00:00', durationMinutes: 30 },
    });
    expect(requestAt(fetchMock, 0).headers['Idempotency-Key']).toBe('key-1');
    expect(pathOf(requestAt(fetchMock, 1).url)).toBe('/tasks/t1/duplicate');
    expect(requestAt(fetchMock, 1).headers['Idempotency-Key']).toBe('key-2');
  });

  it('updates with the version and sends explicit nulls to clear the due', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, makeTask({ id: 't1', version: 4 })));

    await tasksApi.update('t1', { version: 3, dueDate: null, dueDatetime: null, durationMinutes: null });

    expect(requestAt(fetchMock, 0)).toMatchObject({
      method: 'PATCH',
      body: { version: 3, dueDate: null, dueDatetime: null, durationMinutes: null },
    });
    expect(pathOf(requestAt(fetchMock, 0).url)).toBe('/tasks/t1');
  });

  it('closes, reopens (plain or as Undo), moves and deletes', async () => {
    const fetchMock = mockFetch();
    const task = makeTask({ id: 't1' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, task))
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          taskChange({ ...task, completedAt: '2026-10-23T03:00:00Z' }, [
            { id: 'k1', version: 3, completedAt: '2026-10-23T03:00:00Z' },
          ]),
        ),
      )
      .mockResolvedValueOnce(jsonResponse(200, taskChange(task)))
      .mockResolvedValueOnce(jsonResponse(200, taskChange(task, [{ id: 'k1', version: 4, completedAt: null }])))
      .mockResolvedValueOnce(jsonResponse(200, task))
      .mockResolvedValueOnce(jsonResponse(204));

    await tasksApi.get('t1');
    await expect(tasksApi.close('t1')).resolves.toMatchObject({
      cascaded: [{ id: 'k1', version: 3, completedAt: '2026-10-23T03:00:00Z' }],
    });
    await tasksApi.reopen('t1');
    await tasksApi.reopen('t1', true);
    await tasksApi.move('t1', { projectId: 'p-inbox', sectionId: null });
    await tasksApi.remove('t1');

    const calls = [0, 1, 2, 3, 4, 5].map((i) => requestAt(fetchMock, i));
    expect(calls.map((c) => `${c.method} ${pathOf(c.url)}`)).toEqual([
      'GET /tasks/t1',
      'POST /tasks/t1/close',
      'POST /tasks/t1/reopen',
      'POST /tasks/t1/reopen',
      'POST /tasks/t1/move',
      'DELETE /tasks/t1',
    ]);
    expect(calls[2].body).toBeUndefined();
    expect(calls[3].body).toEqual({ undo: true });
    expect(calls[4].body).toEqual({ projectId: 'p-inbox', sectionId: null });
  });

  it('M6c: close sends no body by default, {forever} / {resetSubtasks} when asked; the answer of a repeating task has no completedAt', async () => {
    const fetchMock = mockFetch();
    const repeating = makeTask({ id: 't1', dueDate: '2026-10-29', recurrenceRule: 'FREQ=DAILY', isRecurring: true, version: 1 });
    fetchMock.mockResolvedValue(jsonResponse(200, taskChange(repeating, [{ id: 'k1', version: 2, completedAt: null }])));

    await expect(tasksApi.close('t1')).resolves.toMatchObject({ task: { completedAt: null, isRecurring: true } });
    await tasksApi.close('t1', { forever: true });
    await tasksApi.close('t1', { resetSubtasks: true });

    expect([0, 1, 2].map((i) => pathOf(requestAt(fetchMock, i).url))).toEqual(['/tasks/t1/close', '/tasks/t1/close', '/tasks/t1/close']);
    expect(requestAt(fetchMock, 0).body).toBeUndefined();
    expect(requestAt(fetchMock, 1).body).toEqual({ forever: true });
    expect(requestAt(fetchMock, 2).body).toEqual({ resetSubtasks: true });
  });

  it('M6c: create / PATCH carry the repeat fields; absent = keep, null = stop repeating', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, makeTask({ id: 't1' })));

    await tasksApi.create(
      { content: 'A', dueDate: '2026-10-28', recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE', recurrenceFromCompletion: true, dueString: 'every! week' },
      'k-1',
    );
    await tasksApi.update('t1', { version: 1, recurrenceRule: null });
    await tasksApi.update('t1', { version: 2, priority: 1 });

    expect(requestAt(fetchMock, 0).body).toEqual({
      content: 'A',
      dueDate: '2026-10-28',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE',
      recurrenceFromCompletion: true,
      dueString: 'every! week',
    });
    expect(requestAt(fetchMock, 1).body).toEqual({ version: 1, recurrenceRule: null });
    expect('recurrenceRule' in (requestAt(fetchMock, 2).body as object)).toBe(false);
  });

  it('move / create: afterId absent = last, null = first (spec 3.1); no client id is sent by M1', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, makeTask({ id: 't1' })));

    await tasksApi.move('t1', { projectId: 'p1' });
    await tasksApi.move('t1', { projectId: 'p1', afterId: null });
    await tasksApi.move('t1', { projectId: 'p1', afterId: 't7' });
    await tasksApi.create({ content: 'A', afterId: null }, 'k-1');

    const bodies = [0, 1, 2, 3].map((i) => requestAt(fetchMock, i).body as Record<string, unknown>);
    expect('afterId' in bodies[0]).toBe(false);
    expect(bodies[1]).toEqual({ projectId: 'p1', afterId: null });
    expect(bodies[2]).toEqual({ projectId: 'p1', afterId: 't7' });
    expect(bodies[3]).toEqual({ content: 'A', afterId: null });
    expect('id' in bodies[3]).toBe(false);
  });

  it('PATCH keeps "absent" (keep) and null (clear) apart', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, makeTask({ id: 't1', version: 5 })));

    await tasksApi.update('t1', { version: 4, content: 'Mới' });
    await tasksApi.update('t1', { version: 5, deadlineDate: null });

    expect(requestAt(fetchMock, 0).body).toEqual({ version: 4, content: 'Mới' });
    expect(requestAt(fetchMock, 1).body).toEqual({ version: 5, deadlineDate: null });
  });

  it('sends one batch request with an Idempotency-Key, and the overdue reschedule', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, affected(['t1', 't2'])));

    await expect(
      tasksApi.batch({ action: 'PRIORITY', taskIds: ['t1', 't2'], priority: 1 }, 'batch-key-1'),
    ).resolves.toEqual({ affectedTaskIds: ['t1', 't2'] });
    await tasksApi.batch({ action: 'DELETE', taskIds: ['t1'] }, 'batch-key-2');
    await tasksApi.rescheduleOverdue('2026-10-24');

    expect(pathOf(requestAt(fetchMock, 0).url)).toBe('/tasks/batch');
    expect(requestAt(fetchMock, 0).body).toEqual({ action: 'PRIORITY', taskIds: ['t1', 't2'], priority: 1 });
    expect(requestAt(fetchMock, 0).headers['Idempotency-Key']).toBe('batch-key-1');
    expect(requestAt(fetchMock, 1).headers['Idempotency-Key']).toBe('batch-key-2');
    expect(pathOf(requestAt(fetchMock, 2).url)).toBe('/tasks/overdue/reschedule');
    expect(requestAt(fetchMock, 2).body).toEqual({ date: '2026-10-24' });
  });
});
