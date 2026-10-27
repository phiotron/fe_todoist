import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { queryKeys } from '../../../api/queryKeys';
import viTaskList from '../../../i18n/locales/vi/taskList.json';
import vi from '../../../i18n/locales/vi.json';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeTask, page, taskChange } from '../../../test/m1Fixtures';
import { goOffline, goOnline } from '../../../test/network';
import { createTestQueryClient } from '../../../test/render';
import { renderSignedIn } from '../../../test/screen';
import { palette } from '../../../theme';
import { TaskSelectionProvider } from '../selection';
import { TaskListView } from '../TaskListView';
import { treeRows } from '../taskRows';
import { useTaskList } from '../useTaskList';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const PARAMS = { projectId: 'p1' } as const;
const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

function Harness({ showCompletedTime = false }: { showCompletedTime?: boolean }) {
  const { query, tasks } = useTaskList(PARAMS);
  return (
    <TaskSelectionProvider>
      <TaskListView rows={treeRows(tasks)} query={query} showProject showCompletedTime={showCompletedTime} />
    </TaskSelectionProvider>
  );
}

describe('TaskListView + TaskRow', () => {
  afterEach(() => goOnline());

  it('draws the design row: priority ring with its soft fill, date colours, deadline, progress and project', async () => {
    const overdue = makeTask({ id: 't1', content: 'Nộp báo cáo', priority: 1, dueDate: '2026-10-22', projectName: 'Công ty' });
    const today = makeTask({
      id: 't2',
      content: 'Dọn nhà',
      description: 'Phòng khách trước',
      dueDatetime: '2026-10-23T14:30:00',
      durationMinutes: 30,
      deadlineDate: '2026-10-26',
      subtaskCount: 3,
      completedSubtaskCount: 1,
    });
    await renderSignedIn(<Harness />, { 'GET /api/v1/tasks': () => jsonResponse(200, page([overdue, today])) });

    expect(await screen.findByText('Nộp báo cáo')).toBeOnTheScreen();
    expect(flat('task-toggle-t1')).toMatchObject({ borderColor: palette.p1, backgroundColor: palette.p1s, width: 22 });
    expect(screen.getByTestId('task-due-t1')).toHaveTextContent('Hôm qua', { exact: false });
    expect(StyleSheet.flatten(screen.getByText('Hôm qua').props.style)).toMatchObject({ color: palette.warn });
    expect(screen.getByTestId('task-due-t2')).toHaveTextContent('Hôm nay 14:30–15:00', { exact: false });
    expect(StyleSheet.flatten(screen.getByText('Hôm nay 14:30–15:00').props.style)).toMatchObject({ color: palette.ok });
    expect(screen.getByTestId('task-deadline-t2')).toHaveTextContent('Còn 3 ngày', { exact: false });
    expect(screen.getByTestId('task-progress-t2')).toHaveTextContent('1/3', { exact: false });
    expect(screen.getByText('Phòng khách trước')).toBeOnTheScreen();
    expect(screen.getByText('Công ty')).toBeOnTheScreen();
  });

  it('shows the completion time in the account time zone, also for a 6-digit fraction (C2)', async () => {
    await renderSignedIn(<Harness showCompletedTime />, {
      'GET /api/v1/tasks': () =>
        jsonResponse(200, page([makeTask({ id: 't1', content: 'Xong rồi', completedAt: '2026-10-23T03:05:09.654321Z' })])),
    });

    expect(await screen.findByTestId('task-completed-at-t1')).toHaveTextContent('10:05');
  });

  it('indents subtasks under their parent', async () => {
    const root = makeTask({ id: 'r', content: 'Cha' });
    const child = makeTask({ id: 'c', parentId: 'r', content: 'Con' });
    await renderSignedIn(<Harness />, { 'GET /api/v1/tasks': () => jsonResponse(200, page([root, child])) });

    await screen.findByText('Con');
    expect(flat('task-row-r')).toMatchObject({ paddingLeft: 20 });
    expect(flat('task-row-c')).toMatchObject({ paddingLeft: 44 });
  });

  it('loads the next page when the end is reached and with the "load more" button', async () => {
    const { fetchMock } = await renderSignedIn(<Harness />, {
      'GET /api/v1/tasks': (request) => {
        const cursor = request.query.get('cursor');
        if (!cursor) return jsonResponse(200, page([makeTask({ id: 'a', content: 'A' })], 'c2'));
        if (cursor === 'c2') return jsonResponse(200, page([makeTask({ id: 'b', content: 'B' })], 'c3'));
        return jsonResponse(200, page([makeTask({ id: 'c', content: 'C' })]));
      },
    });
    await screen.findByText('A');

    await fireEvent(screen.getByTestId('task-list'), 'endReached');
    expect(await screen.findByText('B')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('task-list-load-more'));
    expect(await screen.findByText('C')).toBeOnTheScreen();

    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks').map((r) => r.query.get('cursor'))).toEqual([null, 'c2', 'c3']);
    expect(screen.queryByTestId('task-list-load-more')).toBeNull();
  });

  it('completing from the circle shows the Undo toast; Undo reopens with undo: true', async () => {
    let done = false;
    const { fetchMock } = await renderSignedIn(<Harness />, {
      'GET /api/v1/tasks': () => jsonResponse(200, page(done ? [] : [makeTask({ id: 't1', content: 'Mua sữa' })])),
      'POST /api/v1/tasks/t1/close': () => {
        done = true;
        return jsonResponse(200, taskChange(makeTask({ id: 't1', completedAt: '2026-10-23T03:00:00Z' })));
      },
      'POST /api/v1/tasks/t1/reopen': () => {
        done = false;
        return jsonResponse(200, taskChange(makeTask({ id: 't1' })));
      },
    });
    await screen.findByText('Mua sữa');

    await fireEvent.press(screen.getByTestId('task-toggle-t1'));

    expect(await screen.findByText(viTaskList.taskList.completedOne)).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('Mua sữa')).toBeNull());
    await fireEvent.press(screen.getByTestId('snackbar-action'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')[0].body).toEqual({ undo: true });
    expect(await screen.findByText('Mua sữa')).toBeOnTheScreen();
  });

  it('a completed task (Completed tasks block) reopens from its filled circle, without undo', async () => {
    const { fetchMock } = await renderSignedIn(<Harness />, {
      'GET /api/v1/tasks': () =>
        jsonResponse(200, page([makeTask({ id: 't1', content: 'Xong rồi', completedAt: '2026-10-22T05:00:00Z' })])),
      'POST /api/v1/tasks/t1/reopen': () => jsonResponse(200, taskChange(makeTask({ id: 't1' }))),
    });
    await screen.findByText('Xong rồi');
    expect(flat('task-toggle-t1')).toMatchObject({ backgroundColor: palette.acc });
    expect(StyleSheet.flatten(screen.getByText('Xong rồi').props.style)).toMatchObject({
      color: palette.mute,
      textDecorationLine: 'line-through',
    });

    await fireEvent.press(screen.getByTestId('task-toggle-t1'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')[0].body).toBeUndefined();
  });

  it('swiping right completes (with Undo); swiping left opens the date picker and saves with the version', async () => {
    const { fetchMock } = await renderSignedIn(<Harness />, {
      'GET /api/v1/tasks': () =>
        jsonResponse(200, page([makeTask({ id: 't1', content: 'Gọi điện', version: 7 }), makeTask({ id: 't2', content: 'Đi chợ' })])),
      'POST /api/v1/tasks/t2/close': () => jsonResponse(200, taskChange(makeTask({ id: 't2' }))),
      'PATCH /api/v1/tasks/t1': () => jsonResponse(200, makeTask({ id: 't1', version: 8 })),
    });
    await screen.findByText('Gọi điện');

    await fireEvent(screen.getByTestId('task-swipe-t2'), 'swipeableOpen', 'left');
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t2/close')).toHaveLength(1));
    expect(await screen.findByText(viTaskList.taskList.completedOne)).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('task-swipe-t1'), 'swipeableOpen', 'right');
    await fireEvent.press(await screen.findByTestId('schedule-tomorrow'));

    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/t1')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/t1')[0].body).toEqual({
      version: 7,
      dueDate: '2026-10-24',
      dueDatetime: null,
      durationMinutes: null,
    });
  });

  it('long press starts the selection mode: rows toggle instead of opening the detail', async () => {
    await renderSignedIn(<Harness />, {
      'GET /api/v1/tasks': () =>
        jsonResponse(200, page([makeTask({ id: 't1', content: 'Một' }), makeTask({ id: 't2', content: 'Hai' })])),
    });
    await screen.findByText('Một');

    await fireEvent(screen.getByTestId('task-row-t1'), 'longPress');
    expect(screen.getByTestId('task-row-t1')).toBeSelected();
    expect(flat('task-row-t1')).toMatchObject({ backgroundColor: palette.soft });

    await fireEvent.press(screen.getByTestId('task-row-t2'));
    expect(screen.getByTestId('task-row-t2')).toBeSelected();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('a completed task cannot start or join a selection (batch SCHEDULE / MOVE would answer task-completed)', async () => {
    await renderSignedIn(<Harness />, {
      'GET /api/v1/tasks': () =>
        jsonResponse(200, page([makeTask({ id: 't1', content: 'Xong rồi', completedAt: '2026-10-22T05:00:00Z' })])),
    });
    await screen.findByText('Xong rồi');

    await fireEvent(screen.getByTestId('task-row-t1'), 'longPress');

    expect(screen.getByTestId('task-row-t1')).not.toBeSelected();
  });

  it('shows a readable error when completing fails (task deleted for good elsewhere → 404)', async () => {
    await renderSignedIn(<Harness />, {
      'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 't1', content: 'Mua sữa' })])),
      'POST /api/v1/tasks/t1/close': () => problem(404, 'Not Found'),
    });
    await screen.findByText('Mua sữa');

    await fireEvent.press(screen.getByTestId('task-toggle-t1'));

    expect(await screen.findByText(vi.errors.notFound)).toBeOnTheScreen();
  });

  it('opens the task detail when the row is pressed', async () => {
    await renderSignedIn(<Harness />, {
      'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 't1', content: 'Mua sữa' })])),
    });

    await fireEvent.press(await screen.findByText('Mua sữa'));

    expect(router.push).toHaveBeenCalledWith('/task/t1');
  });

  it('shows the skeleton while loading, and the offline state when nothing is cached', async () => {
    goOffline();
    await renderSignedIn(<Harness />, { 'GET /api/v1/tasks': () => jsonResponse(200, page([])) });
    expect(await screen.findByText(vi.errors.offline)).toBeOnTheScreen();
  });

  it('offline with a cache shows the tasks and blocks completing and swiping', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.tasks.list(PARAMS), {
      pages: [page([makeTask({ id: 't1', content: 'Đã lưu sẵn' })])],
      pageParams: [null],
    });
    goOffline();
    const { fetchMock } = await renderSignedIn(<Harness />, {}, queryClient);

    expect(await screen.findByText('Đã lưu sẵn')).toBeOnTheScreen();
    expect(screen.getByTestId('task-toggle-t1')).toBeDisabled();
    expect(screen.queryByTestId('task-swipe-t1')).toBeNull();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/close')).toHaveLength(0);
  });
});
