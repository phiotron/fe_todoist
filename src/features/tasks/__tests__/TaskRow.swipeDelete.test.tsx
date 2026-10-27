import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeTask, page } from '../../../test/m1Fixtures';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { renderSignedIn } from '../../../test/screen';
import { storedSettings, testAppSettings } from '../../../test/settingsFixtures';
import { SettingsProvider } from '../../settings/SettingsProvider';
import { TaskSelectionProvider } from '../selection';
import { TaskListView } from '../TaskListView';
import { treeRows } from '../taskRows';
import { useTaskList } from '../useTaskList';
import { viTranslation as vi } from '../../../i18n';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

function Harness({ readOnly = false }: { readOnly?: boolean }) {
  const { query, tasks } = useTaskList({ projectId: 'p1' });
  return (
    <TaskSelectionProvider>
      <TaskListView rows={treeRows(tasks)} query={query} readOnly={readOnly} />
    </TaskSelectionProvider>
  );
}

function withDeleteOnTheRight(ui: React.ReactElement) {
  const storage = memorySettingsStorage(storedSettings({ applied: testAppSettings({ swipeRight: 'DELETE' }) }));
  return (
    <SettingsProvider storage={storage} deviceTimeZone="Asia/Ho_Chi_Minh">
      {ui}
    </SettingsProvider>
  );
}

const routes = (deleted: () => void) => ({
  'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 't1', content: 'Gọi điện', subtaskCount: 2 })])),
  'DELETE /api/v1/tasks/t1': () => {
    deleted();
    return jsonResponse(204);
  },
});

describe('TaskRow — swipe Delete (spec 9.2, BR-11)', () => {
  it('swiping opens the confirmation and deletes nothing until it is confirmed', async () => {
    const deleted = jest.fn();
    const { fetchMock } = await renderSignedIn(withDeleteOnTheRight(<Harness />), routes(deleted));
    await screen.findByText('Gọi điện');

    // The left panel opens when the row moves right: that is the "swipe right" action.
    await fireEvent(await screen.findByTestId('task-swipe-t1'), 'swipeableOpen', 'left');

    expect(await screen.findByTestId('swipe-delete-dialog')).toBeOnTheScreen();
    expect(
      screen.getByText(vi.settings.swipeDelete.messageWithSubtasks.replace('{{name}}', 'Gọi điện').replace('{{count}}', '2')),
    ).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/tasks/t1')).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('swipe-delete-dialog-confirm'));

    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/tasks/t1')).toHaveLength(1));
    expect(deleted).toHaveBeenCalledTimes(1);
  });

  it('Cancel closes the confirmation without a request', async () => {
    const deleted = jest.fn();
    const { fetchMock } = await renderSignedIn(withDeleteOnTheRight(<Harness />), routes(deleted));
    await screen.findByText('Gọi điện');

    await fireEvent(await screen.findByTestId('task-swipe-t1'), 'swipeableOpen', 'left');
    await fireEvent.press(await screen.findByTestId('swipe-delete-dialog-cancel'));

    expect(screen.queryByTestId('swipe-delete-dialog')).toBeNull();
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/tasks/t1')).toHaveLength(0);
  });

  it('a row of an archived project (read only) cannot be swiped, so nothing opens', async () => {
    await renderSignedIn(withDeleteOnTheRight(<Harness readOnly />), routes(jest.fn()));
    await screen.findByText('Gọi điện');

    expect(screen.queryByTestId('task-swipe-t1')).toBeNull();
    expect(screen.queryByTestId('swipe-delete-dialog')).toBeNull();
  });
});
