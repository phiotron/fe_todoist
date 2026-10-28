import { screen } from '@testing-library/react-native';
import { jsonResponse } from '../../../test/http';
import { makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
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

function Harness() {
  const { query, tasks } = useTaskList({ projectId: 'p1' });
  return (
    <TaskSelectionProvider>
      <TaskListView rows={treeRows(tasks)} query={query} />
    </TaskSelectionProvider>
  );
}

describe('TaskRow — uncompletable task ("* " prefix, M6b)', () => {
  it('shows the name without "* " and no checkbox; a normal task keeps its checkbox', async () => {
    await renderSignedIn(<Harness />, {
      'GET /api/v1/tasks': () =>
        jsonResponse(200, page([makeTask({ id: 't1', content: '* Ghi chú' }), makeTask({ id: 't2', content: 'Mua sữa' })])),
    });

    expect(await screen.findByText('Ghi chú')).toBeOnTheScreen();
    expect(screen.queryByText('* Ghi chú')).toBeNull();
    expect(screen.queryByTestId('task-toggle-t1')).toBeNull();
    expect(screen.getByTestId('task-note-t1')).toBeOnTheScreen();
    expect(screen.getByTestId('task-toggle-t2')).toBeOnTheScreen();
  });
});
