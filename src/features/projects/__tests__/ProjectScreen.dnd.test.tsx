import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject, makeSection, makeTask, page } from '../../../test/m1Fixtures';
import { makeViewOptions } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { ProjectScreen } from '../ProjectScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const project = makeProject({ id: 'p1', name: 'Nhà', activeTaskCount: 4 });
const kitchen = makeSection({ id: 's1', projectId: 'p1', name: 'Bếp', activeTaskCount: 1 });
const a = makeTask({ id: 'a', projectId: 'p1', content: 'Đổ rác', sortOrder: 1024 });
const a1 = makeTask({ id: 'a1', projectId: 'p1', parentId: 'a', content: 'Buộc túi', sortOrder: 1024 });
const b = makeTask({ id: 'b', projectId: 'p1', content: 'Tưới cây', sortOrder: 2048 });
const c = makeTask({ id: 'c', projectId: 'p1', sectionId: 's1', content: 'Rửa bát' });

function routes(extra: ApiRoutes = {}, sortBy: 'MANUAL' | 'PRIORITY' = 'MANUAL'): ApiRoutes {
  return {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project]),
    'GET /api/v1/projects/p1': () => jsonResponse(200, project),
    'GET /api/v1/projects/p1/sections': () => jsonResponse(200, [kitchen]),
    'GET /api/v1/tasks': () => jsonResponse(200, page([a, a1, b, c])),
    'POST /api/v1/reorder': (request) => jsonResponse(200, { ...(request.body as object), sortOrder: 512 }),
    'POST /api/v1/tasks/a/move': () => jsonResponse(200, { ...a, sectionId: 's1', version: 2 }),
    ...viewOptionsRoutes(['project:p1'], sortBy === 'MANUAL' ? [] : [makeViewOptions('project:p1', { sortBy })]),
    ...extra,
  };
}

async function open(sortBy: 'MANUAL' | 'PRIORITY' = 'MANUAL') {
  const rendered = await renderSignedIn(<ProjectScreen projectId="p1" />, routes({}, sortBy));
  await screen.findByText('Tưới cây');
  return rendered;
}

/** A drop on the upper / lower half of a 40 px high row. */
const upper = { x: 10, y: 5, width: 300, height: 40 };
const lower = { x: 10, y: 35, width: 300, height: 40 };

describe('ProjectScreen — drag and drop in the list (manual order)', () => {
  it('dropping a root task above another one in the same block reorders it (POST reorder TASK)', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-task-a'), 'drop', { taskIds: ['b'], task: b }, upper);
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'TASK', id: 'b', afterId: null });
  });

  it('dropping on a sub-task row puts the root after that sub-task’s parent', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-task-a1'), 'drop', { taskIds: ['c'], task: c }, upper);
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/c/move')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/c/move')[0].body).toEqual({
      projectId: 'p1',
      sectionId: null,
      parentId: null,
      afterId: 'a',
    });
  });

  it('dropping on another section header moves the task to the top of that section (sub-tasks follow on the server)', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-start-s1'), 'drop', { taskIds: ['a'], task: a }, upper);
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/a/move')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/a/move')[0].body).toEqual({
      projectId: 'p1',
      sectionId: 's1',
      parentId: null,
      afterId: null,
    });
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(0);
  });

  it('a drop that changes nothing sends nothing', async () => {
    const { fetchMock } = await open();
    await fireEvent(screen.getByTestId('drop-task-a'), 'drop', { taskIds: ['b'], task: b }, lower);
    await fireEvent(screen.getByTestId('drop-task-a'), 'drop', { taskIds: ['a1'], task: a1 }, upper);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')).toHaveLength(0);
  });

  it('a long press still enters the multi-select mode', async () => {
    await open();
    await fireEvent(screen.getByTestId('task-row-b'), 'longPress');
    expect(screen.getByTestId('selection-count')).toBeOnTheScreen();
  });
});

describe('ProjectScreen — sorted by something else than manual', () => {
  it('turns dragging off: no drop zones, long press selects', async () => {
    await open('PRIORITY');
    expect(screen.queryByTestId('drop-task-a')).toBeNull();
    await fireEvent(screen.getByTestId('task-row-b'), 'longPress');
    expect(screen.getByTestId('selection-count')).toBeOnTheScreen();
  });
});
