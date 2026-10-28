import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { GroupBy } from '../../../api/viewOptions';
import { dateKeyInZone } from '../../../lib/dates';
import { tokenStore } from '../../../lib/tokenStore';
import { requestsTo, routeApi, type ApiRoutes } from '../../../test/apiRoutes';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { makeLabel, makeViewOptions } from '../../../test/m2Fixtures';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { useGroupContext } from '../useGroupContext';
import { useViewDisplay } from '../useViewDisplay';

async function signedInFetch(routes: ApiRoutes) {
  await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  const fetchMock = mockFetch();
  routeApi(fetchMock, { 'GET /api/v1/me': () => jsonResponse(200, testUser), ...routes });
  return fetchMock;
}

async function setup<T>(hook: () => T, routes: ApiRoutes) {
  const fetchMock = await signedInFetch(routes);
  const rendered = await renderHook(hook, { wrapper: createWrapper(createTestQueryClient()) });
  return { fetchMock, ...rendered };
}

describe('useViewDisplay', () => {
  it('is ready once the saved list is loaded and gives its parameters', async () => {
    const { result } = await setup(
      () => useViewDisplay('TODAY'),
      viewOptionsRoutes([], [makeViewOptions('TODAY', { sortBy: 'PRIORITY', sortDirection: 'DESC' })]),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.params).toEqual({ sort: 'priority', order: 'desc', group: 'none' });
    expect(result.current.isDefault).toBe(false);
  });

  it('falls back to defaults when the list cannot load', async () => {
    const { result } = await setup(() => useViewDisplay('label:l-1'), {
      'GET /api/v1/view-options': () => problem(500, 'Server Error'),
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.params).toEqual({ sort: 'date', order: 'asc', group: 'none' });
  });

  it('applies a change at once and saves it with PUT', async () => {
    const { result, fetchMock } = await setup(() => useViewDisplay('project:p-1'), viewOptionsRoutes(['project:p-1']));
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      result.current.save({ showCompleted: true });
    });

    expect(result.current.options.showCompleted).toBe(true);
    await waitFor(() => expect(requestsTo(fetchMock, 'PUT', '/api/v1/view-options/project:p-1')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/view-options/project:p-1')[0].body).toEqual({
      sortBy: 'MANUAL',
      sortDirection: 'ASC',
      groupBy: 'NONE',
      showCompleted: true,
      layout: 'LIST',
    });
    await waitFor(() => expect(result.current.options.showCompleted).toBe(true));
  });

  it('resets with DELETE', async () => {
    const { result, fetchMock } = await setup(
      () => useViewDisplay('TODAY'),
      viewOptionsRoutes(['TODAY'], [makeViewOptions('TODAY', { groupBy: 'PRIORITY' })]),
    );
    await waitFor(() => expect(result.current.options.groupBy).toBe('PRIORITY'));
    await act(async () => {
      result.current.reset();
    });
    expect(result.current.options.groupBy).toBe('NONE');
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/view-options/TODAY')).toHaveLength(1));
    expect(result.current.isDefault).toBe(true);
  });
});

describe('useGroupContext', () => {
  it('gives today in the account time zone and loads labels only for label grouping', async () => {
    const fetchMock = await signedInFetch({
      'GET /api/v1/labels': () => jsonResponse(200, [makeLabel({ id: 'l-1' })]),
    });
    const { result, rerender } = await renderHook(({ groupBy }: { groupBy: GroupBy }) => useGroupContext(groupBy), {
      wrapper: createWrapper(createTestQueryClient()),
      initialProps: { groupBy: 'NONE' as GroupBy },
    });
    await waitFor(() => expect(result.current.todayKey).toBe(dateKeyInZone(new Date(), testUser.timeZone)));
    expect(requestsTo(fetchMock, 'GET', '/api/v1/labels')).toHaveLength(0);

    await rerender({ groupBy: 'LABEL' });
    await waitFor(() => expect(result.current.labels.get('l-1')).toBeDefined());
  });
});
