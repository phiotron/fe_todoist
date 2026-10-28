import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { inboxProject, makeProject, makeSection, makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { ProjectScreen } from '../../projects/ProjectScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const project = makeProject({ id: 'p1', name: 'Nhà', activeTaskCount: 2 });
const other = makeProject({ id: 'p2', name: 'Công ty', sortOrder: 2048 });
const kitchen = makeSection({ id: 's1', projectId: 'p1', name: 'Bếp', sortOrder: 1024, activeTaskCount: 1 });
const living = makeSection({ id: 's2', projectId: 'p1', name: 'Phòng khách', sortOrder: 2048, activeTaskCount: 0 });
const tasks = [
  makeTask({ id: 'a', projectId: 'p1', content: 'Đổ rác', sortOrder: 1024 }),
  makeTask({ id: 'c', projectId: 'p1', sectionId: 's1', content: 'Rửa bát' }),
];

function routes(extra: ApiRoutes = {}, current = project, sections = [kitchen, living]): ApiRoutes {
  return {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, current, other]),
    [`GET /api/v1/projects/${current.id}`]: () => jsonResponse(200, current),
    [`GET /api/v1/projects/${current.id}/sections`]: () => jsonResponse(200, sections),
    'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
    'GET /api/v1/templates': () => jsonResponse(200, [{ id: 't1', name: 'Mẫu của tôi', description: '', color: 'red', sectionCount: 0, taskCount: 1, createdAt: '2026-10-20T03:00:00Z', updatedAt: '2026-10-20T03:00:00Z' }]),
    'GET /api/v1/templates/library': () => jsonResponse(200, [{ key: 'study-plan', category: 'POPULAR', name: 'Kế hoạch học tập', description: 'd', color: 'green', sectionCount: 3, taskCount: 6 }]),
    ...viewOptionsRoutes([`project:${current.id}`]),
    ...extra,
  };
}

async function open(extra: ApiRoutes = {}, current = project) {
  const rendered = await renderSignedIn(<ProjectScreen projectId={current.id} />, routes(extra, current));
  await screen.findByText('Rửa bát');
  return rendered;
}

async function projectMenu(key: string) {
  await fireEvent.press(screen.getByTestId('project-menu-open'));
  await fireEvent.press(screen.getByTestId(`project-menu-${key}`));
}

async function sectionMenu(sectionId: string, key: string) {
  await fireEvent.press(screen.getByTestId(`section-menu-open-${sectionId}`));
  await fireEvent.press(screen.getByTestId(`section-menu-${key}`));
}

describe('project menu — M11', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Duplicate calls the API with an Idempotency-Key and opens the copy', async () => {
    const { fetchMock } = await open({
      'POST /api/v1/projects/p1/duplicate': () => jsonResponse(201, makeProject({ id: 'p1c', name: 'Bản sao của Nhà' })),
    });

    await projectMenu('duplicate');

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/duplicate')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/duplicate')[0].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/project/p1c'));
    expect(await screen.findByText('Đã tạo bản sao "Bản sao của Nhà"')).toBeOnTheScreen();
  });

  it('Duplicate shows the project limit message from the server', async () => {
    await open({
      'POST /api/v1/projects/p1/duplicate': () =>
        problem(422, 'Unprocessable', { code: 'limit-reached', limit: 'ACTIVE_PROJECTS', max: 300 }),
    });
    await projectMenu('duplicate');
    expect(await screen.findByText('Đã đạt tối đa 300 dự án đang hoạt động')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalledWith(expect.stringMatching(/^\/project\//));
  });

  it('Save as template asks for a name (default = project name) and posts it', async () => {
    const { fetchMock } = await open({
      'POST /api/v1/templates': () => jsonResponse(201, { id: 't9', name: 'Mẫu nhà', description: '', color: 'charcoal', sectionCount: 1, taskCount: 2, createdAt: '2026-10-23T03:00:00Z', updatedAt: '2026-10-23T03:00:00Z' }),
    });

    await projectMenu('save-template');
    expect(screen.getByTestId('save-template-name').props.value).toBe('Nhà');
    await fireEvent.changeText(screen.getByTestId('save-template-name'), ' Mẫu nhà ');
    await fireEvent.press(screen.getByTestId('save-template-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/templates')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/templates')[0].body).toEqual({ projectId: 'p1', name: 'Mẫu nhà' });
    await waitFor(() => expect(screen.queryByTestId('save-template')).toBeNull());
    expect(await screen.findByText('Đã lưu mẫu "Mẫu nhà"')).toBeOnTheScreen();
  });

  it('Save as template: the 101st template is refused with the limit message and the dialog stays', async () => {
    await open({
      'POST /api/v1/templates': () => problem(422, 'Unprocessable', { code: 'limit-reached', limit: 'TEMPLATES', max: 100 }),
    });
    await projectMenu('save-template');
    await fireEvent.press(screen.getByTestId('save-template-submit'));

    expect(await screen.findByText('Bạn đã có tối đa 100 mẫu — hãy xoá bớt mẫu cũ')).toBeOnTheScreen();
    expect(screen.getByTestId('save-template')).toBeOnTheScreen();
  });

  it('Apply a template lists mine + the library and appends the chosen one to this project', async () => {
    const { fetchMock } = await open({
      'POST /api/v1/templates/library/study-plan/apply': () => jsonResponse(200, project),
    });

    await projectMenu('apply-template');
    await screen.findByText('Mẫu của tôi');
    await fireEvent.press(screen.getByTestId('template-picker-library-study-plan'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/templates/library/study-plan/apply')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/templates/library/study-plan/apply')[0].body).toEqual({ projectId: 'p1' });
    expect(await screen.findByText('Đã thêm mẫu vào dự án')).toBeOnTheScreen();
  });

  it('the Inbox has none of the three entries', async () => {
    await renderSignedIn(<ProjectScreen projectId={inboxProject.id} tab />, routes({}, inboxProject, []));
    await screen.findByTestId('project-menu-open');
    await fireEvent.press(screen.getByTestId('project-menu-open'));
    expect(screen.queryByTestId('project-menu-duplicate')).toBeNull();
    expect(screen.queryByTestId('project-menu-save-template')).toBeNull();
    expect(screen.queryByTestId('project-menu-apply-template')).toBeNull();
  });

  it('an archived (read-only) project has none of the three entries', async () => {
    const archived = makeProject({ id: 'p1', name: 'Nhà', archivedAt: '2026-10-01T00:00:00Z' });
    await renderSignedIn(<ProjectScreen projectId="p1" />, routes({}, archived));
    await screen.findByTestId('project-archived-banner');
    await fireEvent.press(screen.getByTestId('project-menu-open'));
    expect(screen.queryByTestId('project-menu-duplicate')).toBeNull();
    expect(screen.queryByTestId('project-menu-save-template')).toBeNull();
  });
});

describe('section menu — M11', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Duplicate posts to the section duplicate route with an Idempotency-Key', async () => {
    const { fetchMock } = await open({
      'POST /api/v1/projects/p1/sections/s1/duplicate': () => jsonResponse(201, makeSection({ id: 's3', projectId: 'p1', name: 'Bếp' })),
    });

    await sectionMenu('s1', 'duplicate');

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections/s1/duplicate')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections/s1/duplicate')[0].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText('Đã nhân bản mục "Bếp"')).toBeOnTheScreen();
  });

  it('Move lists the other projects (not this one) and posts the destination', async () => {
    const { fetchMock } = await open({
      'POST /api/v1/projects/p1/sections/s1/move': () => jsonResponse(200, makeSection({ id: 's1', projectId: 'p2' })),
    });

    await sectionMenu('s1', 'move');
    await screen.findByTestId('move-section-project-p2');
    expect(screen.queryByTestId('move-section-project-p1')).toBeNull();
    await fireEvent.press(screen.getByTestId('move-section-project-p2'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections/s1/move')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections/s1/move')[0].body).toEqual({ projectId: 'p2' });
    expect(await screen.findByText('Đã chuyển mục sang "Công ty"')).toBeOnTheScreen();
  });

  it('Move: an archived destination shows the error and the sheet stays', async () => {
    await open({
      'POST /api/v1/projects/p1/sections/s1/move': () => problem(422, 'Unprocessable', { code: 'target-archived' }),
    });
    await sectionMenu('s1', 'move');
    await fireEvent.press(await screen.findByTestId('move-section-project-p2'));

    expect(await screen.findByText('Nơi chuyển đến đang được lưu trữ')).toBeOnTheScreen();
    expect(screen.getByTestId('move-section')).toBeOnTheScreen();
  });

  it('Reorder opens the section reorder dialog; with one section it is disabled', async () => {
    await open();
    await sectionMenu('s1', 'reorder');
    expect(await screen.findByTestId('project-reorder-sections')).toBeOnTheScreen();
  });

  it('Reorder is disabled with a single section', async () => {
    await renderSignedIn(<ProjectScreen projectId="p1" />, routes({}, project, [kitchen]));
    await screen.findByText('Rửa bát');
    await fireEvent.press(screen.getByTestId('section-menu-open-s1'));
    expect(screen.getByTestId('section-menu-reorder').props.accessibilityState.disabled).toBe(true);
  });
});
