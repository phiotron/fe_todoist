import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { Filter } from '../../../api/filters';
import { requestsTo, type ApiRoutes, type RoutedRequest } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeTask, page } from '../../../test/m1Fixtures';
import { makeFilter } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { FilterScreen } from '../FilterScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) },
}));

function tasksByPart(request: RoutedRequest): Response {
  if (request.query.get('filter') === 'p1') return jsonResponse(200, page([makeTask({ id: 't-1', content: 'Nộp thuế' })]));
  return jsonResponse(200, page([]));
}

async function open(filter: Filter, validate: ApiRoutes[string], extra: ApiRoutes = {}) {
  return renderSignedIn(<FilterScreen filterId={filter.id} />, {
    'GET /api/v1/filters': () => jsonResponse(200, [filter]),
    'POST /api/v1/filters/validate': validate,
    'GET /api/v1/tasks': tasksByPart,
    ...viewOptionsRoutes([`filter:${filter.id}`]),
    ...extra,
  });
}

describe('FilterScreen', () => {
  it('shows one list for a single-part query, with Display parameters', async () => {
    const filter = makeFilter({ id: 'f-1', name: 'Gấp', query: 'p1' });
    const { fetchMock } = await open(filter, () => jsonResponse(200, { parts: ['p1'] }));
    expect(await screen.findByText('Nộp thuế')).toBeTruthy();
    const calls = requestsTo(fetchMock, 'GET', '/api/v1/tasks');
    expect(calls).toHaveLength(1);
    expect(Object.fromEntries(calls[0].query)).toEqual({ filter: 'p1', sort: 'date', order: 'asc', group: 'none' });
  });

  it('shows one block per comma part, each titled by its part', async () => {
    const filter = makeFilter({ id: 'f-1', query: 'p1, no date' });
    const { fetchMock } = await open(filter, () => jsonResponse(200, { parts: ['p1', 'no date'] }));
    expect(await screen.findByText('Nộp thuế')).toBeTruthy();
    expect(screen.getByText('p1')).toBeTruthy();
    expect(screen.getByText('no date')).toBeTruthy();
    expect(screen.getByTestId('filter-part-1-empty')).toBeTruthy();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks').map((r) => r.query.get('filter')).sort()).toEqual([
      'no date',
      'p1',
    ]);
  });

  it('points at the syntax error and offers to edit the filter', async () => {
    const filter = makeFilter({ id: 'f-1', query: 'p1 & & x' });
    const { fetchMock } = await open(filter, () =>
      problem(400, 'Bad Request', { code: 'filter-syntax', position: 5 }),
    );
    expect(await screen.findByText('Lỗi cú pháp ở ký tự thứ 6: “& x”')).toBeTruthy();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks')).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('filter-syntax-edit'));
    expect(screen.getByTestId('filter-form-query').props.value).toBe('p1 & & x');
  });

  it('shows "no longer exists" for an unknown filter', async () => {
    await renderSignedIn(<FilterScreen filterId="gone" />, {
      'GET /api/v1/filters': () => jsonResponse(200, []),
      ...viewOptionsRoutes([]),
    });
    expect(await screen.findByTestId('filter-not-found')).toBeTruthy();
  });

  it('deletes after confirmation and goes back', async () => {
    const filter = makeFilter({ id: 'f-1', query: 'p1' });
    const { fetchMock } = await open(filter, () => jsonResponse(200, { parts: ['p1'] }), {
      'DELETE /api/v1/filters/f-1': () => jsonResponse(204),
    });
    await fireEvent.press(await screen.findByTestId('filter-menu-button'));
    await fireEvent.press(screen.getByTestId('filter-actions-delete'));
    await fireEvent.press(screen.getByTestId('filter-delete-confirm'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/filters/f-1')).toHaveLength(1);
  });
});
