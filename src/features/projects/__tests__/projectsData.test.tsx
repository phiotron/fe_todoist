import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { requestsTo, routeApi } from '../../../test/apiRoutes';
import { jsonResponse, mockFetch } from '../../../test/http';
import { inboxProject, makeFavorite, makeProject, makeSection } from '../../../test/m1Fixtures';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import {
  useArchiveSection,
  useCreateSection,
  useDeleteSection,
  useReorderSection,
  useSections,
  useUnarchiveSection,
  useUpdateSection,
} from '../../sections/useSections';
import { ProjectIcon } from '../ProjectIcon';
import { useFavoriteProjects, useProjects } from '../useProjects';

const work = makeProject({ id: 'p1', name: 'Công ty', color: 'blue', sortOrder: 1024 });
const home = makeProject({ id: 'p2', name: 'Nhà', sortOrder: 2048, isFavorite: true });
const garden = makeProject({ id: 'p3', name: 'Vườn', sortOrder: 3072, isFavorite: true });

async function setup() {
  await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  const fetchMock = mockFetch();
  routeApi(fetchMock, {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, work, home, garden]),
    // Favorites in the order they were added: garden first.
    'GET /api/v1/favorites': () => jsonResponse(200, [makeFavorite('p3'), makeFavorite('p2'), makeFavorite('gone')]),
    'GET /api/v1/projects/p1/sections': () =>
      jsonResponse(200, [
        makeSection({ id: 's2', projectId: 'p1', sortOrder: 2048 }),
        makeSection({ id: 's1', projectId: 'p1', sortOrder: 1024 }),
        makeSection({ id: 's9', projectId: 'p1', archivedAt: '2026-10-20T00:00:00Z' }),
      ]),
    'POST /api/v1/projects/p1/sections': () => jsonResponse(201, makeSection({ id: 's3' })),
    'PATCH /api/v1/projects/p1/sections/s1': () => jsonResponse(200, makeSection({ id: 's1' })),
    'POST /api/v1/projects/p1/sections/s1/archive': () => jsonResponse(200, makeSection({ id: 's1' })),
    'POST /api/v1/projects/p1/sections/s9/unarchive': () => jsonResponse(200, makeSection({ id: 's9' })),
    'DELETE /api/v1/projects/p1/sections/s1': () => jsonResponse(204),
    'POST /api/v1/reorder': () => jsonResponse(200, { type: 'SECTION', id: 's2', sortOrder: 512 }),
  });
  return fetchMock;
}

describe('project and section data', () => {
  it('useProjects exposes the Inbox apart and the tree in order', async () => {
    await setup();
    const { result } = await renderHook(() => useProjects(), { wrapper: createWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.inbox?.id).toBe('p-inbox'));
    expect(result.current.projects.map((p) => p.name)).toEqual(['Công ty', 'Nhà', 'Vườn']);
    expect(result.current.byId.get('p2')?.name).toBe('Nhà');
  });

  it('useFavoriteProjects follows GET favorites order and drops unknown ids', async () => {
    await setup();
    const { result } = await renderHook(() => useFavoriteProjects(), { wrapper: createWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.map((p) => p.id)).toEqual(['p3', 'p2']));
  });

  it('useSections splits active (by sortOrder) and archived sections, and every write hits its path', async () => {
    const fetchMock = await setup();
    const { result } = await renderHook(
      () => ({
        list: useSections('p1'),
        create: useCreateSection('p1'),
        update: useUpdateSection('p1'),
        archive: useArchiveSection('p1'),
        unarchive: useUnarchiveSection('p1'),
        remove: useDeleteSection('p1'),
        reorder: useReorderSection(),
      }),
      { wrapper: createWrapper(createTestQueryClient()) },
    );
    await waitFor(() => expect(result.current.list.sections.map((s) => s.id)).toEqual(['s1', 's2']));
    expect(result.current.list.archived.map((s) => s.id)).toEqual(['s9']);

    await act(async () => {
      await result.current.create.mutateAsync({ body: { name: 'Mới', description: 'Ghi chú' }, idempotencyKey: 'k1' });
      await result.current.update.mutateAsync({ sectionId: 's1', body: { name: 'Đổi' } });
      await result.current.archive.mutateAsync('s1');
      await result.current.unarchive.mutateAsync('s9');
      await result.current.remove.mutateAsync('s1');
      await result.current.reorder.mutateAsync({ id: 's2', afterId: null });
    });

    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections')[0]).toMatchObject({
      body: { name: 'Mới', description: 'Ghi chú' },
      headers: expect.objectContaining({ 'Idempotency-Key': 'k1' }),
    });
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/p1/sections/s1')[0].body).toEqual({ name: 'Đổi' });
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections/s1/archive')).toHaveLength(1);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections/s9/unarchive')).toHaveLength(1);
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/projects/p1/sections/s1')).toHaveLength(1);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'SECTION', id: 's2', afterId: null });
  });

  it('ProjectIcon: a "#" in the project colour, the Inbox tray in the accent colour', async () => {
    await render(
      <>
        <ProjectIcon project={work} testID="icon-work" />
        <ProjectIcon project={inboxProject} testID="icon-inbox" />
      </>,
    );
    expect(screen.getByTestId('icon-work')).toHaveTextContent('hash');
    expect(screen.getByTestId('icon-inbox')).toHaveTextContent('inbox');
  });
});
