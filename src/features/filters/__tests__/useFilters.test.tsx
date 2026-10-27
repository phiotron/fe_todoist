import { renderHook, waitFor } from '@testing-library/react-native';
import { filterSyntaxPosition } from '../../../api/problem';
import { tokenStore } from '../../../lib/tokenStore';
import { routeApi, requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { makeFilter } from '../../../test/m2Fixtures';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { useFilterValidation, useFilters } from '../useFilters';

async function setup<T>(hook: () => T, routes: Parameters<typeof routeApi>[1]) {
  await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  const fetchMock = mockFetch();
  routeApi(fetchMock, routes);
  const rendered = await renderHook(hook, { wrapper: createWrapper(createTestQueryClient()) });
  return { fetchMock, ...rendered };
}

describe('filter hooks', () => {
  it('loads every filter', async () => {
    const { result } = await setup(() => useFilters(), {
      'GET /api/v1/filters': () => jsonResponse(200, [makeFilter({ id: 'f-1', name: 'Gấp' })]),
    });
    await waitFor(() => expect(result.current.filters.map((f) => f.name)).toEqual(['Gấp']));
  });

  it('splits a query into parts', async () => {
    const { result, fetchMock } = await setup(() => useFilterValidation('today, overdue'), {
      'POST /api/v1/filters/validate': () => jsonResponse(200, { parts: ['today', 'overdue'] }),
    });
    await waitFor(() => expect(result.current.data?.parts).toEqual(['today', 'overdue']));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/filters/validate')[0].body).toEqual({ query: 'today, overdue' });
  });

  it('keeps a syntax error with its position and does not retry', async () => {
    const { result, fetchMock } = await setup(() => useFilterValidation('p1 & & today'), {
      'POST /api/v1/filters/validate': () => problem(400, 'Bad Request', { code: 'filter-syntax', position: 5 }),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(filterSyntaxPosition(result.current.error)).toBe(5);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/filters/validate')).toHaveLength(1);
  });

  it('sends nothing for an empty query', async () => {
    const { fetchMock } = await setup(() => useFilterValidation('   '), {});
    expect(requestsTo(fetchMock, 'POST', '/api/v1/filters/validate')).toHaveLength(0);
  });
});
