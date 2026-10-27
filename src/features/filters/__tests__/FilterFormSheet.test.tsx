import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Filter } from '../../../api/filters';
import { requestsTo, type ApiRoutes, type RoutedRequest } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeFilter } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { FilterFormSheet } from '../FilterFormSheet';

/** today / overdue lists are valid; "p1 & & today" breaks at index 5. */
function validate(request: RoutedRequest): Response {
  const { query } = request.body as { query: string };
  if (query === 'p1 & & today') return problem(400, 'Bad Request', { code: 'filter-syntax', position: 5 });
  return jsonResponse(200, { parts: query.split(',').map((part) => part.trim()) });
}

async function openForm(routes: ApiRoutes, filter?: Filter) {
  const onClose = jest.fn();
  const rendered = await renderSignedIn(<FilterFormSheet visible filter={filter} onClose={onClose} />, {
    'POST /api/v1/filters/validate': validate,
    ...routes,
  });
  return { onClose, ...rendered };
}

describe('FilterFormSheet', () => {
  it('checks the query ~300 ms after typing and shows the number of lists', async () => {
    const { fetchMock } = await openForm({});
    await fireEvent.changeText(screen.getByTestId('filter-form-query'), 'today, overdue');
    expect(await screen.findByText('Hợp lệ · 2 danh sách')).toBeTruthy();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/filters/validate').map((r) => r.body)).toEqual([
      { query: 'today, overdue' },
    ]);
  });

  it('shows where the syntax breaks', async () => {
    await openForm({});
    await fireEvent.changeText(screen.getByTestId('filter-form-query'), 'p1 & & today');
    expect(await screen.findByText('Lỗi cú pháp ở ký tự thứ 6: “& today”')).toBeTruthy();
  });

  it('creates a filter with name, query, colour and favorite', async () => {
    const saved = makeFilter({ id: 'f-9', name: 'Gấp', query: 'p1', color: 'red' });
    const { fetchMock, onClose } = await openForm({
      'POST /api/v1/filters': () => jsonResponse(201, saved),
      'PUT /api/v1/filters/f-9/favorite': () => jsonResponse(200, { ...saved, isFavorite: true }),
    });
    await fireEvent.changeText(screen.getByTestId('filter-form-name'), ' Gấp ');
    await fireEvent.changeText(screen.getByTestId('filter-form-query'), ' p1 ');
    await fireEvent.press(screen.getByTestId('filter-form-color-red'));
    await fireEvent.press(screen.getByTestId('filter-form-favorite'));
    await fireEvent.press(screen.getByTestId('filter-form-save'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const post = requestsTo(fetchMock, 'POST', '/api/v1/filters')[0];
    expect(post.body).toEqual({ name: 'Gấp', query: 'p1', color: 'red' });
    expect(post.headers['Idempotency-Key']).toEqual(expect.any(String));
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/filters/f-9/favorite')).toHaveLength(1);
  });

  it('shows the position under the query when the server rejects it on save', async () => {
    const { onClose } = await openForm({
      'POST /api/v1/filters': () => problem(400, 'Bad Request', { code: 'filter-syntax', position: 3 }),
    });
    await fireEvent.changeText(screen.getByTestId('filter-form-name'), 'X');
    await fireEvent.changeText(screen.getByTestId('filter-form-query'), 'p1 (today');
    await fireEvent.press(screen.getByTestId('filter-form-save'));
    expect(await screen.findByTestId('filter-form-query-error')).toBeTruthy();
    expect(screen.getByText('Lỗi cú pháp ở ký tự thứ 4: “(today”')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('requires a name and a query before any request', async () => {
    const { fetchMock } = await openForm({});
    await fireEvent.press(screen.getByTestId('filter-form-save'));
    expect(await screen.findByText('Hãy nhập tên filter')).toBeTruthy();
    expect(screen.getByText('Hãy nhập truy vấn')).toBeTruthy();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/filters')).toHaveLength(0);
  });

  it('edits only what changed', async () => {
    const filter = makeFilter({ id: 'f-1', name: 'Gấp', query: 'p1', color: 'red' });
    const { fetchMock, onClose } = await openForm(
      { 'PATCH /api/v1/filters/f-1': () => jsonResponse(200, { ...filter, query: 'p1 | p2' }) },
      filter,
    );
    expect(screen.getByTestId('filter-form-query').props.value).toBe('p1');
    await fireEvent.changeText(screen.getByTestId('filter-form-query'), 'p1 | p2');
    await fireEvent.press(screen.getByTestId('filter-form-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/filters/f-1')[0].body).toEqual({ query: 'p1 | p2' });
  });
});
