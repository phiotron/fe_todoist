import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import viProjectScreen from '../../../i18n/locales/vi/projectScreen.json';
import vi from '../../../i18n/locales/vi.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { inboxProject, makeProject, makeSection, makeTask, page, taskChange } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { ProjectScreen } from '../ProjectScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

// The server counts the descendants (3 sub-projects, one of them archived and not in the list below; 5 open tasks in them).
const project = makeProject({
  id: 'p1',
  name: 'Nhà',
  description: 'Việc nhà tuần này',
  activeTaskCount: 4,
  descendantProjectCount: 3,
  descendantActiveTaskCount: 5,
});
const child = makeProject({ id: 'p1a', name: 'Sân vườn', parentId: 'p1', sortOrder: 1024, activeTaskCount: 2 });
const grandChild = makeProject({ id: 'p1b', name: 'Cây ăn quả', parentId: 'p1', sortOrder: 2048, activeTaskCount: 0 });
const kitchen = makeSection({ id: 's1', projectId: 'p1', name: 'Bếp', activeTaskCount: 1 });
const tasks = [
  makeTask({ id: 'a', projectId: 'p1', content: 'Đổ rác', sortOrder: 1024 }),
  makeTask({ id: 'b', projectId: 'p1', content: 'Tưới cây', sortOrder: 2048 }),
  makeTask({ id: 'c', projectId: 'p1', sectionId: 's1', content: 'Rửa bát' }),
];

function routes(extra: ApiRoutes = {}, current = project): ApiRoutes {
  return {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, current, child, grandChild]),
    [`GET /api/v1/projects/${current.id}`]: () => jsonResponse(200, current),
    [`GET /api/v1/projects/${current.id}/sections`]: () => jsonResponse(200, [kitchen]),
    'GET /api/v1/tasks': (request) =>
      request.query.get('completed') === 'true'
        ? jsonResponse(200, page([makeTask({ id: 'x', projectId: 'p1', content: 'Đã xong', completedAt: '2026-10-22T00:00:00Z' })]))
        : jsonResponse(200, page(tasks)),
    ...viewOptionsRoutes([`project:${current.id}`]),
    ...extra,
  };
}

async function open(extra: ApiRoutes = {}, props: Partial<Parameters<typeof ProjectScreen>[0]> = {}) {
  const rendered = await renderSignedIn(<ProjectScreen projectId="p1" {...props} />, routes(extra));
  await screen.findByText('Tưới cây');
  return rendered;
}

async function menu(key: string) {
  await fireEvent.press(screen.getByTestId('project-menu-open'));
  await fireEvent.press(screen.getByTestId(`project-menu-${key}`));
}

describe('ProjectScreen', () => {
  it('shows the title, task count and description above the sections; the + button adds to the project', async () => {
    const { fetchMock } = await open();

    expect(screen.getByText('Nhà')).toBeOnTheScreen();
    expect(screen.getByText('4 công việc')).toBeOnTheScreen();
    expect(screen.getByText('Việc nhà tuần này')).toBeOnTheScreen();
    expect(screen.getByText('Bếp')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks')[0].query.get('projectId')).toBe('p1');

    await fireEvent.press(screen.getByTestId('project-fab'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/quick-add', params: { projectId: 'p1' } });
    await fireEvent.press(screen.getByTestId('project-back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('as the Inbox tab: no back button and no FAB (the tab bar layout draws the +), no edit / archive / delete', async () => {
    await renderSignedIn(<ProjectScreen projectId="p-inbox" tab />, {
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject]),
      'GET /api/v1/projects/p-inbox': () => jsonResponse(200, { ...inboxProject, activeTaskCount: 1 }),
      'GET /api/v1/projects/p-inbox/sections': () => jsonResponse(200, []),
      'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 'i1', content: 'Việc trong Inbox' })])),
      ...viewOptionsRoutes(['project:p-inbox']),
    });
    await screen.findByText('Việc trong Inbox');
    expect(screen.getByText('Inbox')).toBeOnTheScreen();
    expect(screen.queryByTestId('project-back')).toBeNull();
    expect(screen.queryByTestId('project-fab')).toBeNull();

    await fireEvent.press(screen.getByTestId('project-menu-open'));
    expect(screen.getByTestId('project-menu-display')).toBeOnTheScreen();
    expect(screen.queryByTestId('project-menu-edit')).toBeNull();
    expect(screen.queryByTestId('project-menu-archive')).toBeNull();
    expect(screen.queryByTestId('project-menu-delete')).toBeNull();
    expect(screen.queryByTestId('project-menu-favorite')).toBeNull();
  });

  it('opens the project form to edit, or to add a sub-project', async () => {
    await open();

    await menu('edit');
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/project-form', params: { projectId: 'p1' } });
    await menu('add-subproject');
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/project-form', params: { parentId: 'p1' } });
  });

  it('a third-level project cannot get sub-projects (3 levels at most)', async () => {
    const leaf = makeProject({ id: 'p1a1', name: 'Cấp ba', parentId: 'p1a' });
    await renderSignedIn(<ProjectScreen projectId="p1a1" />, {
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project, child, leaf]),
      'GET /api/v1/projects/p1a1': () => jsonResponse(200, leaf),
      'GET /api/v1/projects/p1a1/sections': () => jsonResponse(200, []),
      'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 'z', content: 'Việc cấp ba' })])),
      ...viewOptionsRoutes(['project:p1a1']),
    });
    await screen.findByText('Việc cấp ba');
    await fireEvent.press(screen.getByTestId('project-menu-open'));
    expect(screen.getByTestId('project-menu-add-subproject')).toBeDisabled();
  });

  it('toggles the favorite from the menu', async () => {
    const { fetchMock } = await open({ 'PUT /api/v1/projects/p1/favorite': () => jsonResponse(200, { ...project, isFavorite: true }) });

    await menu('favorite');

    await waitFor(() => expect(requestsTo(fetchMock, 'PUT', '/api/v1/projects/p1/favorite')).toHaveLength(1));
  });

  it('archives straight from the menu (no question: it can be restored) and leaves', async () => {
    const { fetchMock } = await open({ 'POST /api/v1/projects/p1/archive': () => jsonResponse(200, { ...project, archivedAt: '2026-10-23T03:00:00Z' }) });

    await menu('archive');

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/archive')).toHaveLength(1));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('deleting asks first with the SERVER counts (descendantProjectCount, activeTaskCount + descendantActiveTaskCount); Cancel sends nothing', async () => {
    const { fetchMock } = await open({ 'DELETE /api/v1/projects/p1': () => jsonResponse(204) });

    await menu('delete');
    expect(screen.getByText(viProjectScreen.projectScreen.deleteTitle.replace('{{name}}', 'Nhà'))).toBeOnTheScreen();
    // 3 sub-projects (the list only holds 2 of them) and 4 + 5 = 9 open tasks: not re-summed from the list.
    expect(
      screen.getByText(viProjectScreen.projectScreen.deleteMessageWithChildren.replace('{{projects}}', '3').replace('{{tasks}}', '9')),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('project-delete-dialog-cancel'));
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/projects/p1')).toHaveLength(0);

    await menu('delete');
    await fireEvent.press(screen.getByTestId('project-delete-dialog-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/projects/p1')).toHaveLength(1));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('a project without sub-projects asks with the shorter sentence (own open tasks only)', async () => {
    const leaf = makeProject({ id: 'p1b', name: 'Cây ăn quả', parentId: 'p1', activeTaskCount: 3 });
    await renderSignedIn(<ProjectScreen projectId="p1b" />, routes({ 'DELETE /api/v1/projects/p1b': () => jsonResponse(204) }, leaf));
    await screen.findByText('Tưới cây');

    await fireEvent.press(screen.getByTestId('project-menu-open'));
    await fireEvent.press(screen.getByTestId('project-menu-delete'));

    expect(screen.getByText(viProjectScreen.projectScreen.deleteMessage.replace('{{tasks}}', '3'))).toBeOnTheScreen();
  });

  it('Display → Completed tasks loads the completed tasks of the project and they can be reopened', async () => {
    const { fetchMock } = await open({ 'POST /api/v1/tasks/x/reopen': () => jsonResponse(200, taskChange(makeTask({ id: 'x' }))) });
    expect(screen.queryByText('Đã xong')).toBeNull();

    await menu('display');
    await fireEvent.press(screen.getByTestId('display-completed'));
    await fireEvent.press(screen.getByTestId('display-done'));

    expect(await screen.findByText('Đã xong')).toBeOnTheScreen();
    const completed = requestsTo(fetchMock, 'GET', '/api/v1/tasks').filter((r) => r.query.get('completed') === 'true');
    expect(completed[0].query.get('projectId')).toBe('p1');

    await fireEvent.press(screen.getByTestId('task-toggle-x'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/x/reopen')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/x/reopen')[0].body).toBeUndefined();
  });

  it('sorts the root tasks without a section, the sections and the sub-projects with afterId', async () => {
    const { fetchMock } = await open({ 'POST /api/v1/reorder': () => jsonResponse(200, { type: 'TASK', id: 'b', sortOrder: 512 }) });

    await menu('reorder-tasks');
    await fireEvent.press(screen.getByTestId('project-reorder-tasks-up-b'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'TASK', id: 'b', afterId: null }));
    await fireEvent.press(screen.getByTestId('project-reorder-tasks-done'));

    await menu('reorder-subprojects');
    await fireEvent.press(screen.getByTestId('project-reorder-subprojects-down-p1a'));
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[1].body).toEqual({ type: 'PROJECT', id: 'p1a', afterId: 'p1b' }),
    );
  });

  it('"Chọn công việc" starts the selection mode', async () => {
    await open();
    await menu('select');
    expect(screen.getByTestId('selection-count')).toBeOnTheScreen();
  });

  it('an archived project is read-only: banner with Restore, no add rows, no FAB, a short menu', async () => {
    const archived = { ...project, archivedAt: '2026-10-01T00:00:00Z' };
    const { fetchMock } = await renderSignedIn(<ProjectScreen projectId="p1" />, routes({ 'POST /api/v1/projects/p1/unarchive': () => jsonResponse(200, project) }, archived));
    await screen.findByText('Tưới cây');

    expect(screen.getByText(viProjectScreen.projectScreen.archivedBanner)).toBeOnTheScreen();
    expect(screen.queryByTestId('project-fab')).toBeNull();
    expect(screen.queryByTestId('project-add-none')).toBeNull();
    expect(screen.queryByTestId('task-swipe-a')).toBeNull();
    expect(screen.getByTestId('task-toggle-a')).toBeDisabled(); // even completing is a write into an archived project
    await fireEvent.press(screen.getByTestId('project-menu-open'));
    expect(screen.queryByTestId('project-menu-edit')).toBeNull();
    expect(screen.getByTestId('project-menu-delete')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('project-menu-delete'));
    await fireEvent.press(screen.getByTestId('project-delete-dialog-cancel'));

    await fireEvent.press(screen.getByTestId('project-restore'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/unarchive')).toHaveLength(1));
  });

  it('a write on a project archived elsewhere is explained (409 project-archived)', async () => {
    await open({ 'PUT /api/v1/projects/p1/favorite': () => problem(409, 'Conflict', { code: 'project-archived' }) });
    await menu('favorite');
    expect(await screen.findByText(vi.errors.projectArchived)).toBeOnTheScreen();
  });

  it('a project deleted elsewhere shows "no longer exists" and Back clears the cache and leaves', async () => {
    const { queryClient } = await renderSignedIn(<ProjectScreen projectId="p1" />, routes({ 'GET /api/v1/projects/p1': () => problem(404, 'Not Found') }));

    expect(await screen.findByText(vi.errors.notFound)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('project-not-found-back'));

    expect(router.back).toHaveBeenCalled();
    expect(queryClient.getQueryState(['projects', 'detail', 'p1'])).toBeUndefined();
  });
});
