import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { makeFilter, makeLabel } from '../../test/m2Fixtures';
import { filtersApi } from '../filters';
import { labelsApi } from '../labels';

type FetchMock = ReturnType<typeof mockFetch>;

/** Method, path + query, headers and JSON body of the n-th request. */
function sent(fetchMock: FetchMock, index = 0) {
  const request = requestAt(fetchMock, index);
  const url = new URL(request.url);
  return { method: request.method, path: `${url.pathname}${url.search}`, headers: request.headers, body: request.body };
}

function answer(status: number, body?: unknown): FetchMock {
  const fetchMock = mockFetch();
  fetchMock.mockResolvedValue(jsonResponse(status, body));
  return fetchMock;
}

beforeEach(async () => {
  await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
});

describe('labelsApi (spec 12.7)', () => {
  it('lists every label in one request', async () => {
    const labels = [makeLabel({ id: 'l-1', name: 'gap' })];
    const fetchMock = answer(200, labels);
    await expect(labelsApi.list()).resolves.toEqual(labels);
    expect(sent(fetchMock)).toMatchObject({ method: 'GET', path: '/api/v1/labels' });
  });

  it('creates with an Idempotency-Key', async () => {
    const fetchMock = answer(201, makeLabel({ id: 'l-9', name: 'gap', color: 'red' }));
    await labelsApi.create({ name: 'gap', color: 'red' }, 'key-1');
    expect(sent(fetchMock)).toMatchObject({
      method: 'POST',
      path: '/api/v1/labels',
      body: { name: 'gap', color: 'red' },
    });
    expect(sent(fetchMock).headers['Idempotency-Key']).toBe('key-1');
  });

  it('passes a client-generated id through when given (spec 12.11, for M9); the M2 screens send none', async () => {
    const id = 'c0ffee00-0000-4000-8000-000000000001';
    const fetchMock = answer(201, makeLabel({ id, name: 'gap' }));
    await labelsApi.create({ id, name: 'gap' }, 'key-3');
    expect(sent(fetchMock).body).toEqual({ id, name: 'gap' });
  });

  it('updates, deletes and toggles favorite on the label path (id encoded)', async () => {
    const fetchMock = answer(200, makeLabel({ id: 'a/b' }));
    await labelsApi.update('a/b', { name: 'mới' });
    await labelsApi.setFavorite('l-1', true);
    await labelsApi.setFavorite('l-1', false);
    fetchMock.mockResolvedValueOnce(jsonResponse(204));
    await labelsApi.remove('l-1');

    expect(sent(fetchMock, 0)).toMatchObject({ method: 'PATCH', path: '/api/v1/labels/a%2Fb', body: { name: 'mới' } });
    expect(sent(fetchMock, 1)).toMatchObject({ method: 'PUT', path: '/api/v1/labels/l-1/favorite' });
    expect(sent(fetchMock, 2)).toMatchObject({ method: 'DELETE', path: '/api/v1/labels/l-1/favorite' });
    expect(sent(fetchMock, 3)).toMatchObject({ method: 'DELETE', path: '/api/v1/labels/l-1' });
  });

  it('reorders with type LABEL (spec 12.4)', async () => {
    const fetchMock = answer(200, { type: 'LABEL', id: 'l-2', sortOrder: 1024 });
    await labelsApi.reorder('l-2', 'l-1');
    await labelsApi.reorder('l-2', null);

    expect(sent(fetchMock, 0)).toMatchObject({
      method: 'POST',
      path: '/api/v1/reorder',
      body: { type: 'LABEL', id: 'l-2', afterId: 'l-1' },
    });
    expect(sent(fetchMock, 1).body).toEqual({ type: 'LABEL', id: 'l-2', afterId: null });
  });
});

describe('filtersApi (spec 12.7)', () => {
  it('lists, creates (Idempotency-Key), updates, deletes and toggles favorite', async () => {
    const fetchMock = answer(200, [makeFilter({ id: 'f-1' })]);
    await filtersApi.list();
    await filtersApi.create({ name: 'Gấp', query: 'p1 & today', color: 'red' }, 'key-2');
    await filtersApi.update('f-1', { query: 'p1' });
    await filtersApi.setFavorite('f-1', true);
    await filtersApi.setFavorite('f-1', false);
    fetchMock.mockResolvedValueOnce(jsonResponse(204));
    await filtersApi.remove('f-1');

    expect(sent(fetchMock, 0)).toMatchObject({ method: 'GET', path: '/api/v1/filters' });
    expect(sent(fetchMock, 1)).toMatchObject({
      method: 'POST',
      path: '/api/v1/filters',
      body: { name: 'Gấp', query: 'p1 & today', color: 'red' },
    });
    expect(sent(fetchMock, 1).headers['Idempotency-Key']).toBe('key-2');
    expect(sent(fetchMock, 2)).toMatchObject({ method: 'PATCH', path: '/api/v1/filters/f-1', body: { query: 'p1' } });
    expect(sent(fetchMock, 3)).toMatchObject({ method: 'PUT', path: '/api/v1/filters/f-1/favorite' });
    expect(sent(fetchMock, 4)).toMatchObject({ method: 'DELETE', path: '/api/v1/filters/f-1/favorite' });
    expect(sent(fetchMock, 5)).toMatchObject({ method: 'DELETE', path: '/api/v1/filters/f-1' });
  });

  it('passes a client-generated id through when given (spec 12.11, for M9)', async () => {
    const id = 'c0ffee00-0000-4000-8000-000000000002';
    const fetchMock = answer(201, makeFilter({ id, name: 'Gấp' }));
    await filtersApi.create({ id, name: 'Gấp', query: 'p1' }, 'key-4');
    expect(sent(fetchMock).body).toEqual({ id, name: 'Gấp', query: 'p1' });
  });

  it('reorders with type FILTER and validates a query', async () => {
    const fetchMock = answer(200, { parts: ['today', 'overdue'] });
    await filtersApi.reorder('f-2', 'f-1');
    await expect(filtersApi.validate('today, overdue')).resolves.toEqual({ parts: ['today', 'overdue'] });

    expect(sent(fetchMock, 0).body).toEqual({ type: 'FILTER', id: 'f-2', afterId: 'f-1' });
    expect(sent(fetchMock, 1)).toMatchObject({
      method: 'POST',
      path: '/api/v1/filters/validate',
      body: { query: 'today, overdue' },
    });
  });
});
