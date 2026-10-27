import { Pressable } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import viSelection from '../../../i18n/locales/vi/selection.json';
import viTaskList from '../../../i18n/locales/vi/taskList.json';
import vi from '../../../i18n/locales/vi.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { affected, inboxProject, makeProject, makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { SelectionScope } from '../SelectionScope';
import { SelectionBar } from '../SelectionBar';
import { TaskSelectionProvider, useTaskSelection } from '../selection';
import { TaskListView } from '../TaskListView';
import { taskRows } from '../taskRows';
import { useTaskList } from '../useTaskList';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

function Harness() {
  const { query, tasks } = useTaskList({ view: 'today' });
  return (
    <SelectionScope>
      <TaskListView rows={taskRows(tasks)} query={query} />
    </SelectionScope>
  );
}

function routes(batch: ApiRoutes[string] = () => jsonResponse(200, affected(['t1', 't2']))): ApiRoutes {
  return {
    'GET /api/v1/tasks': () =>
      jsonResponse(200, page([makeTask({ id: 't1', content: 'Một' }), makeTask({ id: 't2', content: 'Hai' })])),
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, makeProject({ id: 'p1', name: 'Công ty' })]),
    'GET /api/v1/projects/p1/sections': () => jsonResponse(200, []),
    'POST /api/v1/tasks/batch': batch,
  };
}

async function selectTwo(extra?: ApiRoutes[string]) {
  const rendered = await renderSignedIn(<Harness />, routes(extra));
  await screen.findByText('Một');
  await fireEvent(screen.getByTestId('task-row-t1'), 'longPress');
  await fireEvent.press(screen.getByTestId('task-row-t2'));
  expect(screen.getByTestId('selection-count')).toHaveTextContent(viSelection.selection.count.replace('{{n}}', '2'));
  return rendered;
}

const batchBodies = (fetchMock: Parameters<typeof requestsTo>[0]) =>
  requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch').map((request) => request.body);

describe('SelectionBar', () => {
  it('sets the priority of every selected task in one request, then leaves the selection mode', async () => {
    const { fetchMock } = await selectTwo();
    await fireEvent.press(screen.getByTestId('selection-priority'));
    await fireEvent.press(screen.getByTestId('priority-menu-1'));

    await waitFor(() => expect(batchBodies(fetchMock)).toEqual([{ action: 'PRIORITY', taskIds: ['t1', 't2'], priority: 1 }]));
    await waitFor(() => expect(screen.queryByTestId('selection-count')).toBeNull());
  });

  it('schedules (tomorrow) and removes the date (no date = null)', async () => {
    const { fetchMock } = await selectTwo();
    await fireEvent.press(screen.getByTestId('selection-schedule'));
    await fireEvent.press(await screen.findByTestId('selection-schedule-sheet-tomorrow'));
    await waitFor(() => expect(batchBodies(fetchMock)).toHaveLength(1));

    await fireEvent(screen.getByTestId('task-row-t1'), 'longPress');
    await fireEvent.press(screen.getByTestId('selection-schedule'));
    await fireEvent.press(await screen.findByTestId('selection-schedule-sheet-noDate'));

    await waitFor(() =>
      expect(batchBodies(fetchMock)).toEqual([
        { action: 'SCHEDULE', taskIds: ['t1', 't2'], date: '2026-10-24' },
        { action: 'SCHEDULE', taskIds: ['t1'], date: null },
      ]),
    );
  });

  it('moves to a project without section (sectionId left out)', async () => {
    const { fetchMock } = await selectTwo();
    await fireEvent.press(screen.getByTestId('selection-move'));
    await fireEvent.press(await screen.findByTestId('selection-move-picker-project-p1'));
    await fireEvent.press(await screen.findByTestId('selection-move-picker-section-none'));

    await waitFor(() => expect(batchBodies(fetchMock)).toEqual([{ action: 'MOVE', taskIds: ['t1', 't2'], projectId: 'p1' }]));
  });

  it('asks before deleting; Cancel sends nothing', async () => {
    const { fetchMock } = await selectTwo();
    await fireEvent.press(screen.getByTestId('selection-delete'));
    expect(screen.getByText(viSelection.selection.deleteTitle.replace('{{n}}', '2'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('selection-delete-dialog-cancel'));
    expect(batchBodies(fetchMock)).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('selection-delete'));
    await fireEvent.press(screen.getByTestId('selection-delete-dialog-confirm'));
    await waitFor(() => expect(batchBodies(fetchMock)).toEqual([{ action: 'DELETE', taskIds: ['t1', 't2'] }]));
  });

  it('completes all with an Undo that reopens them in one request', async () => {
    const { fetchMock } = await selectTwo();
    await fireEvent.press(screen.getByTestId('selection-complete'));

    expect(await screen.findByText(viTaskList.taskList.completedMany.replace('{{n}}', '2'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('snackbar-action'));

    await waitFor(() =>
      expect(batchBodies(fetchMock)).toEqual([
        { action: 'CLOSE', taskIds: ['t1', 't2'] },
        { action: 'REOPEN', taskIds: ['t1', 't2'], undo: true },
      ]),
    );
  });

  it('a refused batch (409 archived section) changes nothing: the message shows and the selection stays', async () => {
    await selectTwo(() => problem(409, 'Conflict', { code: 'section-archived' }));
    await fireEvent.press(screen.getByTestId('selection-priority'));
    await fireEvent.press(screen.getByTestId('priority-menu-2'));

    expect(await screen.findByText(vi.errors.sectionArchived)).toBeOnTheScreen();
    expect(screen.getByTestId('selection-count')).toBeOnTheScreen();
  });

  it('SCHEDULE with a task completed elsewhere → 409 task-completed, selection kept', async () => {
    await selectTwo(() => problem(409, 'Conflict', { code: 'task-completed' }));
    await fireEvent.press(screen.getByTestId('selection-schedule'));
    await fireEvent.press(await screen.findByTestId('selection-schedule-sheet-tomorrow'));
    expect(await screen.findByText(vi.errors.taskCompleted)).toBeOnTheScreen();
    expect(screen.getByTestId('selection-count')).toBeOnTheScreen();
  });

  it('MOVE into an archived project → 422 target-archived, selection kept', async () => {
    await selectTwo(() => problem(422, 'Unprocessable Entity', { code: 'target-archived' }));
    await fireEvent.press(screen.getByTestId('selection-move'));
    await fireEvent.press(await screen.findByTestId('selection-move-picker-project-p1'));
    await fireEvent.press(await screen.findByTestId('selection-move-picker-section-none'));
    expect(await screen.findByText(vi.errors.targetArchived)).toBeOnTheScreen();
    expect(screen.getByTestId('selection-count')).toBeOnTheScreen();
  });

  it('every batch request carries an Idempotency-Key header', async () => {
    const { fetchMock } = await selectTwo();
    await fireEvent.press(screen.getByTestId('selection-priority'));
    await fireEvent.press(screen.getByTestId('priority-menu-3'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/batch')[0].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('✕ leaves the selection mode', async () => {
    await selectTwo();
    await fireEvent.press(screen.getByTestId('selection-close'));
    expect(screen.queryByTestId('selection-count')).toBeNull();
  });

  it('more than 200 selected: actions are blocked with a message and nothing is sent; at 200 they work', async () => {
    function Many({ n }: { n: number }) {
      const selection = useTaskSelection();
      return (
        <Pressable
          testID="fill"
          onPress={() => {
            selection?.start();
            for (let i = 0; i < n; i++) selection?.toggle(`x${i}`);
          }}
        />
      );
    }
    const { fetchMock } = await renderSignedIn(
      <TaskSelectionProvider>
        <Many n={201} />
        <SelectionBar />
      </TaskSelectionProvider>,
      routes(),
    );
    await fireEvent.press(screen.getByTestId('fill'));
    expect(screen.getByTestId('selection-count')).toHaveTextContent(viSelection.selection.count.replace('{{n}}', '201'));
    expect(screen.getByText(viSelection.selection.limit.replace('{{n}}', '200'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('selection-delete'));
    await fireEvent.press(screen.getByTestId('selection-complete'));
    expect(batchBodies(fetchMock)).toHaveLength(0);
    expect(screen.queryByTestId('selection-delete-dialog-confirm')).toBeNull();
  });
});
