import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { Task } from '../../../../api/models';
import { queryKeys } from '../../../../api/queryKeys';
import viTaskDetail from '../../../../i18n/locales/vi/taskDetail.json';
import viTaskList from '../../../../i18n/locales/vi/taskList.json';
import vi from '../../../../i18n/locales/vi.json';
import { requestsTo, type ApiRoutes } from '../../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../../test/http';
import { inboxProject, makeProject, makeSection, makeTask, taskChange } from '../../../../test/m1Fixtures';
import { goOffline, goOnline } from '../../../../test/network';
import { createTestQueryClient } from '../../../../test/render';
import { renderSignedIn } from '../../../../test/screen';
import { TaskDetailScreen } from '../TaskDetailScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
// Friday 23/10/2026, 10:00 in Vietnam.
jest.mock('../../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

let server: Task;
const kitchen = makeSection({ id: 's1', projectId: 'p1', name: 'Bếp' });
const doneChild = makeTask({ id: 'k1', projectId: 'p1', parentId: 't1', content: 'Con đã xong', completedAt: '2026-10-22T00:00:00Z', sortOrder: 1024 });
const openChild = makeTask({ id: 'k2', projectId: 'p1', parentId: 't1', content: 'Con đang làm', sortOrder: 2048 });

function routes(extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/v1/tasks/t1': () => jsonResponse(200, server),
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, makeProject({ id: 'p1', name: 'Nhà' })]),
    'GET /api/v1/projects/p1': () => jsonResponse(200, makeProject({ id: 'p1', name: 'Nhà' })),
    'GET /api/v1/projects/p1/sections': () => jsonResponse(200, [kitchen]),
    'GET /api/v1/tasks/t1/subtasks': () => jsonResponse(200, [doneChild, openChild]),
    ...extra,
  };
}

const applyPatch: ApiRoutes[string] = (request) => {
  server = { ...server, ...(request.body as object), version: server.version + 1 };
  return jsonResponse(200, server);
};

async function open(extra: ApiRoutes = {}) {
  const rendered = await renderSignedIn(<TaskDetailScreen taskId="t1" />, routes(extra));
  await waitFor(() => expect(screen.getByTestId('task-content').props.value).toBe(server.content));
  return rendered;
}

const patches = (fetchMock: Parameters<typeof requestsTo>[0]) => requestsTo(fetchMock, 'PATCH', '/api/v1/tasks/t1').map((r) => r.body);

async function menu(key: string) {
  await fireEvent.press(screen.getByTestId('task-menu-open'));
  await fireEvent.press(screen.getByTestId(`task-menu-${key}`));
}

describe('TaskDetailScreen', () => {
  beforeEach(() => {
    server = makeTask({
      id: 't1',
      projectId: 'p1',
      sectionId: 's1',
      content: 'Viết báo cáo',
      description: 'Mô tả cũ',
      priority: 2,
      dueDatetime: '2026-10-23T11:30:00',
      version: 3,
      subtaskCount: 2,
      completedSubtaskCount: 1,
    });
  });
  afterEach(() => goOnline());

  it('lays out the breadcrumb, name, description, date row, chips and the sub-tasks in the design order', async () => {
    await open();

    expect(await screen.findByText('Nhà / Bếp')).toBeOnTheScreen();
    expect(screen.getByTestId('task-description').props.value).toBe('Mô tả cũ');
    expect(screen.getByTestId('task-date')).toHaveTextContent(/Hôm nay 11:30/);
    expect(screen.getByTestId('task-priority-chip')).toHaveTextContent(/P2/);
    expect(screen.getByTestId('task-deadline-chip')).toBeOnTheScreen();
    expect(screen.getByTestId('task-move-chip')).toBeOnTheScreen();
    expect(await screen.findByText('Con đang làm')).toBeOnTheScreen();
    expect(screen.getByText('1/2')).toBeOnTheScreen();
  });

  it('saves the name and the description when each field loses focus (changed field + version only)', async () => {
    const { fetchMock } = await open({ 'PATCH /api/v1/tasks/t1': applyPatch });

    await fireEvent.changeText(screen.getByTestId('task-content'), 'Viết báo cáo quý');
    await fireEvent(screen.getByTestId('task-content'), 'blur');
    await waitFor(() => expect(patches(fetchMock)).toEqual([{ version: 3, content: 'Viết báo cáo quý' }]));

    await fireEvent.changeText(screen.getByTestId('task-description'), 'Mô tả mới');
    await fireEvent(screen.getByTestId('task-description'), 'blur');
    await waitFor(() => expect(patches(fetchMock)[1]).toEqual({ version: 4, description: 'Mô tả mới' }));
  });

  it('a chip saves at once: priority P1', async () => {
    const { fetchMock } = await open({ 'PATCH /api/v1/tasks/t1': applyPatch });

    await fireEvent.press(screen.getByTestId('task-priority-chip'));
    await fireEvent.press(screen.getByTestId('priority-menu-1'));

    await waitFor(() => expect(patches(fetchMock)).toEqual([{ version: 3, priority: 1 }]));
  });

  it('a blank name shows the message under the field and is not sent', async () => {
    const { fetchMock } = await open({ 'PATCH /api/v1/tasks/t1': applyPatch });
    await fireEvent.changeText(screen.getByTestId('task-content'), '   ');
    await fireEvent(screen.getByTestId('task-content'), 'blur');

    expect(await screen.findByText(viTaskList.taskList.validation.contentRequired)).toBeOnTheScreen();
    expect(patches(fetchMock)).toHaveLength(0);
  });

  it('409: banner "Đã có thay đổi ở nơi khác", the typed text stays, "keep mine" saves it with the new version', async () => {
    let attempt = 0;
    const { fetchMock } = await open({
      'PATCH /api/v1/tasks/t1': (request) => {
        attempt += 1;
        if (attempt === 1) {
          server = { ...server, content: 'Bản người khác', version: 4 };
          return problem(409, 'Conflict', { code: 'version-conflict', current: server });
        }
        return applyPatch(request);
      },
    });

    await fireEvent.changeText(screen.getByTestId('task-content'), 'Bản của tôi');
    await fireEvent(screen.getByTestId('task-content'), 'blur');

    expect(await screen.findByTestId('task-conflict')).toBeOnTheScreen();
    expect(screen.getByText(viTaskDetail.taskDetail.conflictTitle)).toBeOnTheScreen();
    expect(screen.getByTestId('task-content').props.value).toBe('Bản của tôi');

    await fireEvent.press(screen.getByTestId('task-conflict-keep'));

    await waitFor(() => expect(patches(fetchMock)[1]).toEqual({ version: 4, content: 'Bản của tôi' }));
    await waitFor(() => expect(screen.queryByTestId('task-conflict')).toBeNull());
  });

  it('409: "use latest" drops the draft and shows the other version', async () => {
    await open({
      'PATCH /api/v1/tasks/t1': () => {
        server = { ...server, content: 'Bản người khác', version: 4 };
        return problem(409, 'Conflict', { code: 'version-conflict', current: server });
      },
    });
    await fireEvent.changeText(screen.getByTestId('task-content'), 'Bản của tôi');
    await fireEvent(screen.getByTestId('task-content'), 'blur');
    await fireEvent.press(await screen.findByTestId('task-conflict-latest'));

    expect(screen.getByTestId('task-content').props.value).toBe('Bản người khác');
  });

  it('deleted for good elsewhere: 404 on open shows "no longer exists"; Back clears the cache and leaves', async () => {
    const queryClient = createTestQueryClient();
    const removeQueries = jest.spyOn(queryClient, 'removeQueries');
    await renderSignedIn(<TaskDetailScreen taskId="t1" />, routes({ 'GET /api/v1/tasks/t1': () => problem(404, 'Not Found') }), queryClient);

    expect(await screen.findByText(vi.errors.notFound)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('task-not-found-back'));

    expect(router.back).toHaveBeenCalled();
    // The still-mounted observer of this test (router.back is a mock) may re-create the entry afterwards: assert the removal itself.
    expect(removeQueries).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.detail('t1') });
  });

  it('404 while saving shows the same screen', async () => {
    await open({ 'PATCH /api/v1/tasks/t1': () => problem(404, 'Not Found') });
    await fireEvent.changeText(screen.getByTestId('task-content'), 'Sửa');
    await fireEvent(screen.getByTestId('task-content'), 'blur');
    expect(await screen.findByTestId('task-not-found-back')).toBeOnTheScreen();
  });

  it('completing from the circle shows the Undo toast; a completed task reopens', async () => {
    const { fetchMock } = await open({
      'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange({ ...server, completedAt: '2026-10-23T03:00:00Z' })),
      'POST /api/v1/tasks/t1/reopen': () => jsonResponse(200, taskChange(server)),
    });

    await fireEvent.press(screen.getByTestId('task-toggle'));
    expect(await screen.findByText(viTaskList.taskList.completedOne)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('snackbar-action'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')[0].body).toEqual({ undo: true });
  });

  it('the breadcrumb opens the project picker', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('task-breadcrumb'));
    expect(await screen.findByTestId('task-move-picker')).toBeOnTheScreen();
  });

  it('menu → Sao chép sends an Idempotency-Key and says so', async () => {
    const { fetchMock } = await open({ 'POST /api/v1/tasks/t1/duplicate': () => jsonResponse(201, makeTask({ id: 't2' })) });

    await menu('duplicate');

    expect(await screen.findByText(viTaskDetail.taskDetail.duplicated)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/duplicate')[0].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('menu → Thêm sub-task opens Quick Add; Ẩn sub-task đã xong hides the finished ones', async () => {
    await open();
    await screen.findByText('Con đã xong');

    await menu('add-subtask');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/quick-add', params: { parentId: 't1', projectId: 'p1', sectionId: 's1' } });

    await menu('toggle-completed');
    expect(screen.queryByText('Con đã xong')).toBeNull();
    await fireEvent.press(screen.getByTestId('task-menu-open'));
    expect(screen.getByText(viTaskDetail.taskDetail.menuShowCompleted)).toBeOnTheScreen();
  });

  it('delete asks first and counts the subtasks; Cancel sends nothing; Confirm deletes for good and leaves', async () => {
    const { fetchMock } = await open({ 'DELETE /api/v1/tasks/t1': () => jsonResponse(204) });

    await menu('delete');
    expect(screen.getByText(viTaskDetail.taskDetail.deleteMessageWithSubtasks.replace('{{name}}', 'Viết báo cáo').replace('{{n}}', '2'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('task-delete-dialog-cancel'));
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/tasks/t1')).toHaveLength(0);

    await menu('delete');
    await fireEvent.press(screen.getByTestId('task-delete-dialog-confirm'));

    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/tasks/t1')).toHaveLength(1));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('deleting something already deleted elsewhere (404) counts as deleted', async () => {
    await open({ 'DELETE /api/v1/tasks/t1': () => problem(404, 'Not Found') });
    await menu('delete');
    await fireEvent.press(screen.getByTestId('task-delete-dialog-confirm'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('the back button leaves', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('task-header-back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('a completed task is read-only (fields, chips, sub-task add) but can be reopened and deleted', async () => {
    server = { ...server, completedAt: '2026-10-22T05:00:00Z' };
    const { fetchMock } = await open({
      'POST /api/v1/tasks/t1/reopen': () => jsonResponse(200, taskChange({ ...server, completedAt: null, version: 4 })),
    });
    await screen.findByText('Con đang làm');

    expect(screen.getByTestId('task-content')).toHaveProp('editable', false);
    expect(screen.getByTestId('task-description')).toHaveProp('editable', false);
    expect(screen.getByTestId('task-priority-chip')).toBeDisabled();
    expect(screen.getByTestId('task-date')).toBeDisabled();
    expect(screen.queryByTestId('subtask-add')).toBeNull();
    expect(screen.queryByTestId('task-archived-notice')).toBeNull();

    await fireEvent.press(screen.getByTestId('task-menu-open'));
    expect(screen.queryByTestId('task-menu-add-subtask')).toBeNull();
    expect(screen.queryByTestId('task-menu-duplicate')).toBeNull();
    expect(screen.queryByTestId('task-menu-reorder-subtasks')).toBeNull();
    expect(screen.getByTestId('task-menu-delete')).toBeOnTheScreen();
    expect(screen.getByTestId('task-menu-toggle-completed')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('task-menu-toggle-completed')); // closes the menu

    await fireEvent.press(screen.getByTestId('task-toggle'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')[0].body).toBeUndefined();
  });

  it('in an ARCHIVED project everything is locked: no circle, no Delete (it would be 409), a notice on top', async () => {
    const archivedProject = makeProject({ id: 'p1', name: 'Nhà', archivedAt: '2026-10-01T00:00:00Z' });
    await open({ 'GET /api/v1/projects/p1': () => jsonResponse(200, archivedProject) });
    expect(await screen.findByTestId('task-archived-notice')).toHaveTextContent(viTaskDetail.taskDetail.archivedNotice);

    expect(screen.getByTestId('task-toggle')).toBeDisabled();
    expect(screen.getByTestId('task-content')).toHaveProp('editable', false);
    expect(screen.queryByTestId('subtask-add')).toBeNull();
    await fireEvent.press(screen.getByTestId('task-menu-open'));
    expect(screen.queryByTestId('task-menu-delete')).toBeNull();
    expect(screen.queryByTestId('task-menu-duplicate')).toBeNull();
    expect(screen.getByTestId('task-menu-toggle-completed')).toBeOnTheScreen();
  });

  it('in an ARCHIVED section the same lock applies (409 section-archived is what the server would answer)', async () => {
    await open({
      'GET /api/v1/projects/p1/sections': () => jsonResponse(200, [{ ...kitchen, archivedAt: '2026-10-01T00:00:00Z' }]),
    });
    expect(await screen.findByTestId('task-archived-notice')).toBeOnTheScreen();
    expect(screen.getByTestId('task-toggle')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('task-menu-open'));
    expect(screen.queryByTestId('task-menu-delete')).toBeNull();
  });

  it('a project archived elsewhere meanwhile: Delete is refused (409) and the dialog says why', async () => {
    const { fetchMock } = await open({ 'DELETE /api/v1/tasks/t1': () => problem(409, 'Conflict', { code: 'project-archived' }) });
    await menu('delete');
    await fireEvent.press(screen.getByTestId('task-delete-dialog-confirm'));

    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/tasks/t1')).toHaveLength(1));
    expect(await screen.findByText(vi.errors.projectArchived)).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('offline: the cached task is readable, the circle and the menu write entries are disabled', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.tasks.detail('t1'), server);
    goOffline();
    await renderSignedIn(<TaskDetailScreen taskId="t1" />, routes(), queryClient);

    await waitFor(() => expect(screen.getByTestId('task-content').props.value).toBe('Viết báo cáo'));
    expect(screen.getByTestId('task-toggle')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('task-menu-open'));
    expect(screen.getByTestId('task-menu-delete')).toBeDisabled();
  });
});
