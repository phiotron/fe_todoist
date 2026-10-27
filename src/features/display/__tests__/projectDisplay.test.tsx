import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ViewOptions } from '../../../api/viewOptions';
import { requestsTo, type ApiRoutes, type RoutedRequest } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject, makeSection, makeTask, page } from '../../../test/m1Fixtures';
import { makeViewOptions } from '../../../test/m2Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { ProjectScreen } from '../../projects/ProjectScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));

const project = makeProject({ id: 'p-1', name: 'Nhà' });
const section = makeSection({ id: 's-1', projectId: 'p-1', name: 'Bếp' });
const open = [
  makeTask({ id: 't-1', projectId: 'p-1', sectionId: 's-1', content: 'Rửa bát', priority: 1 }),
  makeTask({ id: 't-2', projectId: 'p-1', sectionId: null, content: 'Quét nhà', priority: 4 }),
  makeTask({ id: 't-3', projectId: 'p-1', sectionId: null, parentId: 't-2', content: 'Gom rác', priority: 1 }),
  makeTask({ id: 't-4', projectId: 'p-1', sectionId: null, content: 'Giặt đồ', priority: 4 }),
];
const done = [makeTask({ id: 't-9', projectId: 'p-1', content: 'Đã đi chợ', completedAt: '2026-10-25T03:00:00Z' })];

function tasks(request: RoutedRequest): Response {
  return jsonResponse(200, page(request.query.get('completed') === 'true' ? done : open));
}

async function render(saved: ViewOptions[] = []) {
  const routes: ApiRoutes = {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project]),
    'GET /api/v1/projects/p-1': () => jsonResponse(200, project),
    'GET /api/v1/projects/p-1/sections': () => jsonResponse(200, [section]),
    'GET /api/v1/tasks': tasks,
    ...viewOptionsRoutes(['project:p-1'], saved),
  };
  return renderSignedIn(<ProjectScreen projectId="p-1" />, routes);
}

const openCalls = (fetchMock: Parameters<typeof requestsTo>[0]) =>
  requestsTo(fetchMock, 'GET', '/api/v1/tasks').filter((request) => request.query.get('completed') !== 'true');

describe('project screen with Display', () => {
  it('fetches the open tasks once with sort=manual by default and keeps the sections', async () => {
    const { fetchMock } = await render();
    expect(await screen.findByText('Rửa bát')).toBeTruthy();
    // M1 titles a section row with key "s-<id>": testID section-header-s-<id>.
    expect(screen.getByTestId('section-header-s-s-1')).toBeTruthy();
    expect(screen.getByTestId('project-add-section')).toBeTruthy();
    const calls = openCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(Object.fromEntries(calls[0].query)).toEqual({ projectId: 'p-1', sort: 'manual', order: 'asc', group: 'none' });
  });

  it('replaces the sections by groups when grouped; a subtask follows its root; no "add section" row', async () => {
    await render([makeViewOptions('project:p-1', { sortBy: 'PRIORITY', groupBy: 'PRIORITY' })]);
    expect(await screen.findByText('Ưu tiên 1')).toBeTruthy();
    expect(screen.getByText('Ưu tiên 4')).toBeTruthy();
    // 'Gom rác' (priority 1) is a subtask of 'Quét nhà' (priority 4): it stays under its root, not in "Ưu tiên 1".
    expect(screen.getByText('Gom rác')).toBeTruthy();
    expect(screen.queryByTestId('section-header-s-s-1')).toBeNull();
    expect(screen.queryByTestId('project-add-section')).toBeNull();
    expect(screen.getByTestId('project-add-grouped')).toBeTruthy();
  });

  it('remembers "Completed tasks" per account and fetches them without any Display parameter', async () => {
    const { fetchMock } = await render([makeViewOptions('project:p-1', { sortBy: 'MANUAL', showCompleted: true })]);
    expect(await screen.findByText('Đã đi chợ')).toBeTruthy();
    const completed = requestsTo(fetchMock, 'GET', '/api/v1/tasks').filter((r) => r.query.get('completed') === 'true');
    expect(completed.length).toBeGreaterThanOrEqual(1);
    for (const call of completed) {
      for (const name of ['sort', 'order', 'group', 'filterPriority', 'filterLabelId', 'filterDue']) {
        expect(call.query.has(name)).toBe(false);
      }
    }
  });

  it('opens the Display sheet from the project menu and saves the switch', async () => {
    const { fetchMock } = await render();
    await fireEvent.press(await screen.findByTestId('project-menu-open'));
    await fireEvent.press(await screen.findByTestId('project-menu-display'));
    await fireEvent.press(await screen.findByTestId('display-completed'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PUT', '/api/v1/view-options/project:p-1')).toHaveLength(1));
    expect(await screen.findByText('Đã đi chợ')).toBeTruthy();
  });

  it('offers the manual "sort tasks" action while sorted by hand', async () => {
    await render();
    await fireEvent.press(await screen.findByTestId('project-menu-open'));
    expect(screen.getByTestId('project-menu-reorder-tasks')).not.toBeDisabled();
  });

  it('locks the manual "sort tasks" action while sorted otherwise or grouped (the order shown is no longer sort_order)', async () => {
    await render([makeViewOptions('project:p-1', { sortBy: 'NAME' })]);
    await fireEvent.press(await screen.findByTestId('project-menu-open'));
    expect(screen.getByTestId('project-menu-reorder-tasks')).toBeDisabled();
  });
});
