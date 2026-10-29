import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from '../../../components/Snackbar';
import { makeTask } from '../../../test/m1Fixtures';
import { createTestQueryClient } from '../../../test/render';
import { createSwipeArming } from '../swipeArming';
import { TaskRow } from '../TaskRow';
import { TaskRowEnvProvider } from '../taskRowEnv';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) } }));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));



const now = new Date('2026-10-23T03:00:00Z');

function rows(arming: ReturnType<typeof createSwipeArming>, ids: string[]) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <SnackbarProvider>
        <TaskRowEnvProvider fetchLists={false} arming={arming}>
          {ids.map((id) => (
            <TaskRow key={id} task={makeTask({ id, content: `Việc ${id}` })} now={now} timeZone="Asia/Ho_Chi_Minh" onToggle={jest.fn()} />
          ))}
        </TaskRowEnvProvider>
      </SnackbarProvider>
    </QueryClientProvider>
  );
}

describe('swipe arming: the swipe gesture (Reanimated shared values + 2 gesture handlers + action panels) is only mounted on rows that have settled in view', () => {
  it('before the list has a layout every row is swipeable (unchanged behaviour: tests, first draw)', async () => {
    const arming = createSwipeArming();
    await render(rows(arming, ['a', 'b']));
    expect(screen.queryAllByTestId(/^task-swipe-/)).toHaveLength(2);
  });

  it('after the layout is known a new row is a plain row (no gesture) until it is reported as settled in view', async () => {
    const arming = createSwipeArming();
    arming.setLayoutKnown();
    await render(rows(arming, ['a', 'b', 'c']));
    expect(screen.queryAllByTestId(/^task-row-/)).toHaveLength(3); // still drawn, still pressable
    expect(screen.queryAllByTestId(/^task-swipe-/)).toHaveLength(0);
    await act(async () => arming.setViewable(['b']));
    expect(screen.queryAllByTestId(/^task-swipe-/).map((n) => n.props.testID)).toEqual(['task-swipe-b']);
    expect(screen.getByTestId('task-row-b')).toBeTruthy();
  });

  it('a row that mounts while its key is already settled in view arms itself', async () => {
    const arming = createSwipeArming();
    arming.setLayoutKnown();
    arming.setViewable(['a']);
    await render(rows(arming, ['a']));
    expect(screen.queryByTestId('task-swipe-a')).not.toBeNull();
  });

  it('never swaps the row under a finger: arming waits for the touch to end', async () => {
    const arming = createSwipeArming();
    arming.setLayoutKnown();
    await render(rows(arming, ['a']));
    arming.setTouching(true);
    await act(async () => arming.setViewable(['a']));
    expect(screen.queryByTestId('task-swipe-a')).toBeNull();
    await act(async () => arming.setTouching(false));
    expect(screen.queryByTestId('task-swipe-a')).not.toBeNull();
  });

  it('a tap on a plain row still opens the task', async () => {
    const { router } = jest.requireMock('expo-router');
    const arming = createSwipeArming();
    arming.setLayoutKnown();
    await render(rows(arming, ['a']));
    await fireEvent.press(screen.getByTestId('task-row-a'));
    expect(router.push).toHaveBeenCalledWith('/task/a');
  });
});

describe('swipe arming wired into TaskListView', () => {
  jest.setTimeout(30000);
  const { jsonResponse } = require('../../../test/http');
  const { page } = require('../../../test/m1Fixtures');
  const { renderSignedIn } = require('../../../test/screen');
  const { TaskListView } = require('../TaskListView');
  const { treeRows } = require('../taskRows');
  const { useTaskList } = require('../useTaskList');
  const { TaskSelectionProvider } = require('../selection');
  function Harness() {
    const { query, tasks } = useTaskList({ projectId: 'p1' });
    return (
      <TaskSelectionProvider>
        <TaskListView rows={treeRows(tasks)} query={query} />
      </TaskSelectionProvider>
    );
  }
  const tasksOf = (ids: string[]) => () => jsonResponse(200, page(ids.map((id) => makeTask({ id, content: `Việc ${id}`, projectId: 'p1' }))));

  it('rows drawn before the layout are swipeable; rows drawn after it wait until the list reports them settled in view', async () => {
    const queryClient = createTestQueryClient();
    const { setRoutes } = await renderSignedIn(<Harness />, { 'GET /api/v1/tasks': tasksOf(['a']) }, queryClient);
    await screen.findByText('Việc a');
    expect(screen.queryByTestId('task-swipe-a')).not.toBeNull();

    const list = screen.getByTestId('task-list');
    await fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 700 } } });
    setRoutes({ 'GET /api/v1/tasks': tasksOf(['a', 'b']) });
    await act(async () => { void queryClient.invalidateQueries(); });
    await screen.findByText('Việc b');
    expect(screen.queryByTestId('task-swipe-b')).toBeNull();
    expect(screen.queryByTestId('task-row-b')).not.toBeNull();

    await fireEvent(list, 'viewableItemsChanged', { viewableItems: [{ key: 'b' }], changed: [] });
    expect(screen.queryByTestId('task-swipe-b')).not.toBeNull();
  });

  it('the list asks for settled-row reports only after the row stayed in view a moment', () => {
    // minimumViewTime keeps rows a fast scroll brushes past plain
    const { SWIPE_ARM_VIEW_MS } = require('../TaskListView');
    expect(SWIPE_ARM_VIEW_MS).toBeGreaterThanOrEqual(150);
  });
});
