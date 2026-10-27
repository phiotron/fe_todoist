import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import type { Task } from '../../../../api/models';
import viTaskDetail from '../../../../i18n/locales/vi/taskDetail.json';
import viTaskList from '../../../../i18n/locales/vi/taskList.json';
import vi from '../../../../i18n/locales/vi.json';
import { requestsTo, type ApiRoutes } from '../../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../../test/http';
import { makeTask, taskChange } from '../../../../test/m1Fixtures';
import { renderSignedIn } from '../../../../test/screen';
import { palette } from '../../../../theme';
import { SubtaskSection } from '../SubtaskSection';
import { useTaskDepth } from '../useSubtasks';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const root = makeTask({ id: 't1', projectId: 'p1', sectionId: 's1', subtaskCount: 2, completedSubtaskCount: 1 });
const done = makeTask({ id: 'k1', projectId: 'p1', parentId: 't1', content: 'Con đã xong', completedAt: '2026-10-22T00:00:00Z', sortOrder: 1024 });
const open = makeTask({ id: 'k2', projectId: 'p1', parentId: 't1', content: 'Con đang làm', sortOrder: 2048 });
const grandchild = makeTask({ id: 'g1', projectId: 'p1', parentId: 'k2', content: 'Cháu', sortOrder: 1024 });

function routes(extra: ApiRoutes = {}): ApiRoutes {
  return { 'GET /api/v1/tasks/t1/subtasks': () => jsonResponse(200, [done, open, grandchild]), ...extra };
}

async function show(props: Partial<Parameters<typeof SubtaskSection>[0]> = {}, extra: ApiRoutes = {}, task: Task = root) {
  const rendered = await renderSignedIn(<SubtaskSection task={task} depth={1} hideCompleted={false} {...props} />, routes(extra));
  await screen.findAllByText('Con đang làm'); // twice when the sort dialog is open
  return rendered;
}

describe('SubtaskSection', () => {
  it('shows the progress and the direct subtasks only; a completed one is struck through', async () => {
    const { fetchMock } = await show();

    expect(screen.getByText(viTaskDetail.taskDetail.subtasks.title)).toBeOnTheScreen();
    expect(screen.getByText('1/2')).toBeOnTheScreen();
    expect(screen.getByText('Con đã xong')).toBeOnTheScreen();
    expect(screen.queryByText('Cháu')).toBeNull();
    expect(StyleSheet.flatten(screen.getByText('Con đã xong').props.style)).toMatchObject({
      color: palette.mute,
      textDecorationLine: 'line-through',
    });
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks/t1/subtasks')).toHaveLength(1);
  });

  it('can hide the completed subtasks', async () => {
    await show({ hideCompleted: true });
    expect(screen.queryByText('Con đã xong')).toBeNull();
    expect(screen.getByText('Con đang làm')).toBeOnTheScreen();
  });

  it('"Thêm sub-task" opens Quick Add under this task, in its project and section', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('subtask-add'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/quick-add',
      params: { parentId: 't1', projectId: 'p1', sectionId: 's1' },
    });
  });

  it('a task without a section sends no sectionId', async () => {
    await show({}, {}, { ...root, sectionId: null });
    await fireEvent.press(screen.getByTestId('subtask-add'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/quick-add', params: { parentId: 't1', projectId: 'p1' } });
  });

  it('completing a subtask shows the Undo toast; a completed one reopens from its circle', async () => {
    const { fetchMock } = await show(
      {},
      {
        'POST /api/v1/tasks/k2/close': () => jsonResponse(200, taskChange(open)),
        'POST /api/v1/tasks/k1/reopen': () => jsonResponse(200, taskChange(done)),
      },
    );

    await fireEvent.press(screen.getByTestId('subtask-toggle-k2'));
    expect(await screen.findByText(viTaskList.taskList.completedOne)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('subtask-toggle-k1'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/k1/reopen')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/k2/close')).toHaveLength(1);
  });

  it('opens a subtask in its own detail screen', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('subtask-row-k2'));
    expect(router.push).toHaveBeenCalledWith('/task/k2');
  });

  it('readOnly (completed or archived parent): no add row, locked circles, children still open', async () => {
    await show({ readOnly: true });
    expect(screen.queryByTestId('subtask-add')).toBeNull();
    expect(screen.getByTestId('subtask-toggle-k2')).toBeDisabled();
    expect(screen.getByTestId('subtask-toggle-k1')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('subtask-row-k2'));
    expect(router.push).toHaveBeenCalledWith('/task/k2');
  });

  it('at level 4 no more subtasks can be added', async () => {
    await show({ depth: 4 });
    expect(screen.queryByTestId('subtask-add')).toBeNull();
    expect(screen.getByTestId('subtasks-max-depth')).toHaveTextContent(viTaskDetail.taskDetail.subtasks.maxDepth);
  });

  it('shows the error of a failed load', async () => {
    await renderSignedIn(<SubtaskSection task={root} depth={1} hideCompleted={false} />, {
      'GET /api/v1/tasks/t1/subtasks': () => problem(500, 'Error', { requestId: '7f3c9a12-aaaa-4bbb-8ccc-dddddddddddd' }),
    });
    expect(await screen.findByText(vi.errors.server.replace('{{code}}', '7f3c9a12'))).toBeOnTheScreen();
  });

  it('sorts the open subtasks with afterId', async () => {
    const second = makeTask({ id: 'k3', projectId: 'p1', parentId: 't1', content: 'Con thứ ba', sortOrder: 3072 });
    const { fetchMock } = await show(
      { reorderOpen: true, onReorderClose: jest.fn() },
      {
        'GET /api/v1/tasks/t1/subtasks': () => jsonResponse(200, [done, open, second]),
        'POST /api/v1/reorder': () => jsonResponse(200, { type: 'TASK', id: 'k3', sortOrder: 512 }),
      },
    );

    await fireEvent.press(screen.getByTestId('subtask-reorder-up-k3'));

    await waitFor(() =>
      expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'TASK', id: 'k3', afterId: null }),
    );
  });
});

describe('useTaskDepth', () => {
  function Depth({ task }: { task: Task }) {
    const depth = useTaskDepth(task);
    return depth === undefined ? null : <Text testID="depth">{String(depth)}</Text>;
  }
  const l1 = makeTask({ id: 'l1' });
  const l2 = makeTask({ id: 'l2', parentId: 'l1' });
  const l3 = makeTask({ id: 'l3', parentId: 'l2' });
  const l4 = makeTask({ id: 'l4', parentId: 'l3' });
  const chain = (): ApiRoutes => ({
    'GET /api/v1/tasks/l1': () => jsonResponse(200, l1),
    'GET /api/v1/tasks/l2': () => jsonResponse(200, l2),
    'GET /api/v1/tasks/l3': () => jsonResponse(200, l3),
  });

  it('is 1 for a root task without asking the server', async () => {
    const { fetchMock } = await renderSignedIn(<Depth task={l1} />, chain());
    expect(await screen.findByTestId('depth')).toHaveTextContent('1');
    expect(fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => /\/tasks\/l\d$/.test(url))).toHaveLength(0);
  });

  it('level 3 needs the parent and the grandparent (two requests, not the task itself)', async () => {
    const { fetchMock } = await renderSignedIn(<Depth task={l3} />, chain());
    expect(await screen.findByTestId('depth')).toHaveTextContent('3');
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks/l2')).toHaveLength(1);
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks/l1')).toHaveLength(1);
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks/l3')).toHaveLength(0);
  });

  it('level 4 is found after three parent requests', async () => {
    await renderSignedIn(<Depth task={l4} />, chain());
    expect(await screen.findByTestId('depth')).toHaveTextContent('4');
  });
});
