import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ViewKey, ViewOptions } from '../../../api/viewOptions';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeLabel, makeViewOptions } from '../../../test/m2Fixtures';
import { goOffline, goOnline } from '../../../test/network';
import { createTestQueryClient } from '../../../test/render';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { DisplaySheet } from '../DisplaySheet';

async function openSheet(viewKey: ViewKey, saved: ViewOptions[] = [], routes: ApiRoutes = {}) {
  return renderSignedIn(<DisplaySheet visible viewKey={viewKey} onClose={jest.fn()} />, {
    'GET /api/v1/labels': () => jsonResponse(200, []),
    ...viewOptionsRoutes([viewKey], saved),
    ...routes,
  });
}

const selected = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.selected;

describe('DisplaySheet', () => {
  afterEach(() => goOnline());

  it('shows the Today choices and saves a new sort at once', async () => {
    const { fetchMock } = await openSheet('TODAY');
    await waitFor(() => expect(selected('display-sort-date')).toBe(true));
    expect(screen.queryByTestId('display-sort-manual')).toBeNull();
    expect(screen.getByTestId('display-group-project')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('display-sort-priority'));

    expect(selected('display-sort-priority')).toBe(true);
    await waitFor(() => expect(requestsTo(fetchMock, 'PUT', '/api/v1/view-options/TODAY')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/view-options/TODAY')[0].body).toEqual({
      sortBy: 'PRIORITY',
      sortDirection: 'ASC',
      groupBy: 'NONE',
    });
  });

  it('has no grouping and no "no date" / "overdue" due filter on Upcoming (server: 400)', async () => {
    await openSheet('UPCOMING');
    await screen.findByTestId('display-sort-date');
    expect(screen.queryByTestId('display-group-none')).toBeNull();
    expect(screen.getByTestId('display-due-next_7_days')).toBeTruthy();
    expect(screen.queryByTestId('display-due-no_date')).toBeNull();
    expect(screen.queryByTestId('display-due-overdue')).toBeNull();
  });

  it('offers "overdue" but not "no date" as a due filter on Today (server: 400 for no_date)', async () => {
    await openSheet('TODAY');
    await screen.findByTestId('display-due-all');
    expect(screen.getByTestId('display-due-overdue')).toBeTruthy();
    expect(screen.queryByTestId('display-due-no_date')).toBeNull();
  });

  it('hides the order for manual sort and offers Completed tasks on a project', async () => {
    const { fetchMock } = await openSheet('project:p-1');
    const puts = () => requestsTo(fetchMock, 'PUT', '/api/v1/view-options/project:p-1');
    await waitFor(() => expect(selected('display-sort-manual')).toBe(true));
    expect(screen.queryByTestId('display-order-asc')).toBeNull();
    expect(screen.getByText('Theo section')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('display-sort-name'));
    expect(screen.getByTestId('display-order-desc')).toBeTruthy();
    await waitFor(() => expect(puts()).toHaveLength(1));

    await fireEvent.press(screen.getByTestId('display-completed'));
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts()[1].body).toEqual({ sortBy: 'NAME', sortDirection: 'ASC', groupBy: 'NONE', showCompleted: true });
  });

  it('filters by priority, due and label', async () => {
    const { fetchMock } = await openSheet('label:l-1', [], {
      'GET /api/v1/labels': () => jsonResponse(200, [makeLabel({ id: 'l-2', name: 'nha' })]),
    });
    const puts = () => requestsTo(fetchMock, 'PUT', '/api/v1/view-options/label:l-1');

    await fireEvent.press(await screen.findByTestId('display-priority-1'));
    await waitFor(() => expect(puts()).toHaveLength(1));
    await fireEvent.press(screen.getByTestId('display-due-next_7_days'));
    await waitFor(() => expect(puts()).toHaveLength(2));
    await fireEvent.press(await screen.findByTestId('display-label-l-2'));
    await waitFor(() => expect(puts()).toHaveLength(3));

    expect(puts()[2].body).toEqual({
      sortBy: 'DATE',
      sortDirection: 'ASC',
      groupBy: 'NONE',
      filterPriority: 1,
      filterDue: 'NEXT_7_DAYS',
      filterLabelId: 'l-2',
    });
  });

  it('resets to defaults with DELETE, and only when something differs', async () => {
    const { fetchMock } = await openSheet('TODAY', [makeViewOptions('TODAY', { groupBy: 'PRIORITY' })]);
    await waitFor(() => expect(selected('display-group-priority')).toBe(true));

    await fireEvent.press(screen.getByTestId('display-reset'));

    expect(selected('display-group-none')).toBe(true);
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/view-options/TODAY')).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByTestId('display-reset').props.accessibilityState).toMatchObject({ disabled: true }),
    );
  });

  it('shows a save error and reloads the saved list', async () => {
    const { fetchMock } = await openSheet('TODAY', [], {
      'PUT /api/v1/view-options/TODAY': () => problem(500, 'Server Error', { requestId: 'abcdef123456' }),
    });
    await fireEvent.press(await screen.findByTestId('display-sort-name'));
    expect(await screen.findByTestId('display-error')).toBeTruthy();
    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/view-options').length).toBeGreaterThan(1));
    await waitFor(() => expect(selected('display-sort-date')).toBe(true));
  });

  it('locks every choice while offline', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['viewOptions', 'list'], []);
    goOffline();
    await renderSignedIn(<DisplaySheet visible viewKey="TODAY" onClose={jest.fn()} />, {}, queryClient);
    expect(screen.getByTestId('display-sort-name').props.accessibilityState).toMatchObject({ disabled: true });
  });
});
