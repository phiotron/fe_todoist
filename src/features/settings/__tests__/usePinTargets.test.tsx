import { renderHook, waitFor } from '@testing-library/react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { countRequests, jsonResponse, mockFetch, problem } from '../../../test/http';
import { routeFetch } from '../../../test/m3Routes';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { usePinTargets } from '../usePinTargets';

const PROJECTS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Marketing', isInbox: false, archivedAt: null },
];
const P1 = PROJECTS[0].id;

describe('usePinTargets', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('loads projects, labels and filters; knows which targets exist and their names', async () => {
    routeFetch(mockFetch(), {
      'GET /api/v1/projects': () => jsonResponse(200, PROJECTS),
      'GET /api/v1/labels': () => jsonResponse(200, [{ id: 'l1', name: 'urgent' }]),
      'GET /api/v1/filters': () => jsonResponse(200, []),
    });
    const { result } = await renderHook(() => usePinTargets(), { wrapper: createWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.settled).toEqual({ project: true, label: true, filter: true }));
    expect(result.current.options.project).toEqual([{ id: P1, name: 'Marketing' }]);
    expect(result.current.known.project?.has(P1)).toBe(true);
    expect(result.current.known.filter?.size).toBe(0);
    expect(result.current.nameOf({ kind: 'project', id: P1 })).toBe('Marketing');
    expect(result.current.nameOf({ kind: 'project', id: '22222222-2222-4222-8222-222222222222' })).toBeNull();
  });

  it('fetches only the kinds it is asked for; the others count as settled with nothing known', async () => {
    const fetchMock = mockFetch();
    routeFetch(fetchMock, { 'GET /api/v1/projects': () => jsonResponse(200, PROJECTS) });
    const { result } = await renderHook(() => usePinTargets(['project']), { wrapper: createWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.settled.project).toBe(true));
    expect(countRequests(fetchMock, '/api/v1/labels')).toBe(0);
    expect(result.current.settled.label).toBe(true);
    expect(result.current.known.label).toBeUndefined();
  });

  it('a failed load is settled but leaves that kind unknown (the stored value is trusted)', async () => {
    routeFetch(mockFetch(), { 'GET /api/v1/projects': () => problem(503, 'Service Unavailable') });
    const { result } = await renderHook(() => usePinTargets(['project']), { wrapper: createWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.settled.project).toBe(true));
    expect(result.current.known.project).toBeUndefined();
  });

  it('does nothing while signed out', async () => {
    await tokenStore.clear();
    const fetchMock = mockFetch();
    const { result } = await renderHook(() => usePinTargets(), { wrapper: createWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.options.project).toEqual([]));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
