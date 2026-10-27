import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { PagedQuery } from '../../../lib/usePagedList';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeTask } from '../../../test/m1Fixtures';
import { makeLabel } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { TaskDetailScreen } from '../../tasks/detail/TaskDetailScreen';
import { taskRows } from '../../tasks/taskRows';
import { TaskListView } from '../../tasks/TaskListView';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));

const labels = [makeLabel({ id: 'l-1', name: 'gap' })];

const idleQuery: PagedQuery = {
  isPending: false,
  isError: false,
  error: null,
  fetchStatus: 'idle',
  isRefetching: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  refetch: jest.fn(),
  fetchNextPage: jest.fn(),
};

describe('labels on M1 task UI', () => {
  it('shows a task’s labels in its list row, between the progress and the project', async () => {
    const task = makeTask({ id: 't-1', content: 'Mua sữa', labelIds: ['l-1'] });
    await renderSignedIn(<TaskListView rows={taskRows([task])} query={idleQuery} />, {
      'GET /api/v1/labels': () => jsonResponse(200, labels),
    });
    expect(await screen.findByTestId('task-labels-t-1')).toBeTruthy();
    expect(screen.getByText('gap')).toBeTruthy();
  });

  it('a task without labels adds no label request and no empty meta line', async () => {
    const { fetchMock } = await renderSignedIn(
      <TaskListView rows={taskRows([makeTask({ id: 't-2', content: 'Gọi điện', labelIds: [] })])} query={idleQuery} />,
      { 'GET /api/v1/labels': () => jsonResponse(200, labels) },
    );
    expect(await screen.findByText('Gọi điện')).toBeTruthy();
    expect(screen.queryByTestId('task-labels-t-2')).toBeNull();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/labels')).toHaveLength(0);
  });

  it('saves the chosen labels from the task sheet with one PATCH carrying the version (through the draft)', async () => {
    const task = makeTask({ id: 't-1', content: 'Mua sữa', version: 3, labelIds: [] });
    const { fetchMock } = await renderSignedIn(<TaskDetailScreen taskId="t-1" />, {
      'GET /api/v1/tasks/t-1': () => jsonResponse(200, task),
      'GET /api/v1/tasks/t-1/subtasks': () => jsonResponse(200, []),
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject]),
      'GET /api/v1/projects/p-inbox/sections': () => jsonResponse(200, []),
      'GET /api/v1/labels': () => jsonResponse(200, labels),
      'PATCH /api/v1/tasks/t-1': () => jsonResponse(200, { ...task, version: 4, labelIds: ['l-1'] }),
    });

    await fireEvent.press(await screen.findByTestId('task-label-chip'));
    await fireEvent.press(await screen.findByTestId('task-label-chip-picker-item-l-1'));
    await fireEvent.press(screen.getByTestId('task-label-chip-picker-action-done'));

    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/t-1')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/t-1')[0].body).toEqual({ version: 3, labelIds: ['l-1'] });
  });
});
