import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { makeTask } from '../../test/m1Fixtures';
import type { CreateTaskRequest, Task, TaskBatchRequest, UpdateTaskRequest } from '../models';
import { tasksApi } from '../tasks';

function sentUrl(fetchMock: ReturnType<typeof mockFetch>, index = 0): URL {
  return new URL(requestAt(fetchMock, index).url);
}

describe('M2 task list parameters (spec 12.7)', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('sends labelId and every Display parameter as given', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [], nextCursor: null }));

    await tasksApi.list(
      {
        labelId: 'l-1',
        sort: 'priority',
        order: 'desc',
        group: 'project',
        filterPriority: 1,
        filterLabelId: 'l-2',
        filterDue: 'next_7_days',
      },
      null,
    );

    const url = sentUrl(fetchMock);
    expect(url.pathname).toBe('/api/v1/tasks');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      labelId: 'l-1',
      sort: 'priority',
      order: 'desc',
      group: 'project',
      filterPriority: '1',
      filterLabelId: 'l-2',
      filterDue: 'next_7_days',
    });
  });

  it('sends one filter part with its special characters intact, plus the cursor', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [], nextCursor: null }));

    await tasksApi.list({ filter: '#Việc nhà & p1', sort: 'date', order: 'asc', group: 'none' }, 'c-2');

    const params = sentUrl(fetchMock).searchParams;
    expect(params.get('filter')).toBe('#Việc nhà & p1');
    expect(params.get('cursor')).toBe('c-2');
  });

  it('never sends Display parameters for the overdue list, the Completed screen or completed project tasks (server answers 400)', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [], nextCursor: null }));
    const display = {
      sort: 'priority',
      order: 'desc',
      group: 'project',
      filterPriority: 1,
      filterLabelId: 'l-2',
      filterDue: 'today',
    } as const;

    await tasksApi.list({ view: 'overdue', ...display }, null);
    await tasksApi.list({ view: 'completed', since: '2026-10-01', ...display }, null);
    await tasksApi.list({ projectId: 'p-1', completed: true, ...display }, null);

    for (const index of [0, 1, 2]) {
      const params = sentUrl(fetchMock, index).searchParams;
      for (const name of ['sort', 'order', 'group', 'filterPriority', 'filterLabelId', 'filterDue']) {
        expect(params.has(name)).toBe(false);
      }
    }
    expect(sentUrl(fetchMock, 0).searchParams.get('view')).toBe('overdue');
    expect(sentUrl(fetchMock, 1).searchParams.get('since')).toBe('2026-10-01');
    expect(sentUrl(fetchMock, 2).searchParams.get('completed')).toBe('true');
  });

  it('sends them for Today, Upcoming, a project, a label and a filter', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [], nextCursor: null }));
    const lists = [
      { view: 'today' },
      { view: 'upcoming', from: '2026-10-26' },
      { projectId: 'p-1' },
      { labelId: 'l-1' },
      { filter: 'p1' },
    ] as const;

    for (const list of lists) await tasksApi.list({ ...list, sort: 'name', order: 'asc', group: 'none' }, null);

    lists.forEach((_, index) => {
      const params = sentUrl(fetchMock, index).searchParams;
      expect([params.get('sort'), params.get('order'), params.get('group')]).toEqual(['name', 'asc', 'none']);
    });
  });

  it('types labelIds on tasks, create / update requests and the ADD_LABELS / REMOVE_LABELS batch', () => {
    const task: Task = makeTask({ labelIds: ['l-1'] });
    const create: CreateTaskRequest = { projectId: 'p-1', content: 'Mua sữa', labelIds: ['l-1'] };
    const update: UpdateTaskRequest = { version: 2, labelIds: [] };
    const add: TaskBatchRequest = { action: 'ADD_LABELS', taskIds: ['t-1'], labelIds: ['l-1'] };
    const remove: TaskBatchRequest = { action: 'REMOVE_LABELS', taskIds: ['t-1'], labelIds: ['l-1'] };
    expect(task.labelIds).toEqual(['l-1']);
    expect(create.labelIds).toEqual(['l-1']);
    expect(update.labelIds).toEqual([]);
    expect([add.action, remove.action]).toEqual(['ADD_LABELS', 'REMOVE_LABELS']);
  });

  it('gives every fixture task an empty label list', () => {
    expect(makeTask().labelIds).toEqual([]);
  });
});
