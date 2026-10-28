import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import viEmail from '../../../i18n/locales/vi/email.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject, makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { ProjectScreen } from '../../projects/ProjectScreen';
import { TaskDetailScreen } from '../../tasks/detail/TaskDetailScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const t = viEmail.email;
const ADDRESS = 'abcdefghijklmnopqrstuvwxyz@in.example.com';

function projectRoutes(project = makeProject({ id: 'p1', name: 'Nhà' })): ApiRoutes {
  return {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project]),
    [`GET /api/v1/projects/${project.id}`]: () => jsonResponse(200, project),
    [`GET /api/v1/projects/${project.id}/sections`]: () => jsonResponse(200, []),
    'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 'a', projectId: project.id, content: 'Đổ rác' })])),
    [`PUT /api/v1/projects/${project.id}/email-address`]: () =>
      jsonResponse(200, { address: ADDRESS, targetType: 'PROJECT', targetId: project.id }),
    ...viewOptionsRoutes([`project:${project.id}`]),
  };
}

describe('M13a email menus', () => {
  it('project menu: "Email tasks to this project" opens the address dialog', async () => {
    const { fetchMock } = await renderSignedIn(<ProjectScreen projectId="p1" />, projectRoutes());
    await screen.findByText('Đổ rác');

    await fireEvent.press(screen.getByTestId('project-menu-open'));
    expect(screen.getByText(t.menuProject)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('project-menu-email'));

    expect(await screen.findByText(ADDRESS)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/projects/p1/email-address')).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('project-email-close'));
    await waitFor(() => expect(screen.queryByText(ADDRESS)).toBeNull());
  });

  it('Inbox menu says "Email tasks to Inbox"', async () => {
    await renderSignedIn(<ProjectScreen projectId={inboxProject.id} tab />, projectRoutes(inboxProject));
    await screen.findByText('Đổ rác');
    await fireEvent.press(screen.getByTestId('project-menu-open'));
    expect(screen.getByText(t.menuInbox)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('project-menu-email'));
    expect(await screen.findByText(ADDRESS)).toBeOnTheScreen();
  });

  it('an archived project has no email entry (mail would be refused)', async () => {
    await renderSignedIn(
      <ProjectScreen projectId="p1" />,
      projectRoutes(makeProject({ id: 'p1', name: 'Nhà', archivedAt: '2026-10-20T00:00:00Z' })),
    );
    await screen.findByText('Đổ rác');
    await fireEvent.press(screen.getByTestId('project-menu-open'));
    expect(screen.queryByTestId('project-menu-email')).toBeNull();
  });

  it('task menu: "Email to this task" asks for the task address', async () => {
    const task = makeTask({ id: 't1', projectId: 'p1', content: 'Viết báo cáo', version: 1 });
    const { fetchMock } = await renderSignedIn(<TaskDetailScreen taskId="t1" />, {
      'GET /api/v1/tasks/t1': () => jsonResponse(200, task),
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, makeProject({ id: 'p1', name: 'Nhà' })]),
      'GET /api/v1/projects/p1': () => jsonResponse(200, makeProject({ id: 'p1', name: 'Nhà' })),
      'GET /api/v1/projects/p1/sections': () => jsonResponse(200, []),
      'GET /api/v1/tasks/t1/subtasks': () => jsonResponse(200, []),
      'PUT /api/v1/tasks/t1/email-address': () => jsonResponse(200, { address: ADDRESS, targetType: 'TASK', targetId: 't1' }),
    });
    await waitFor(() => expect(screen.getByTestId('task-content').props.value).toBe('Viết báo cáo'));

    await fireEvent.press(screen.getByTestId('task-menu-open'));
    expect(screen.getByText(t.menuTask)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('task-menu-email'));
    expect(await screen.findByText(ADDRESS)).toBeOnTheScreen();
    expect(screen.getByText(t.hintTask)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/tasks/t1/email-address')).toHaveLength(1);
  });
});
