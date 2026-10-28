import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import viSharing from '../../../i18n/locales/vi/sharing.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { inboxProject, makeTask, page } from '../../../test/m1Fixtures';
import { makeSharedProject, makeWorkspace } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { ProjectScreen } from '../ProjectScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true), navigate: jest.fn() },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

type SharedOverrides = Parameters<typeof makeSharedProject>[0];

async function open(overrides: SharedOverrides, extra: ApiRoutes = {}) {
  const project = makeSharedProject({ id: 'p1', name: 'Website', workspaceId: 'w1', ...overrides });
  const rendered = await renderSignedIn(<ProjectScreen projectId="p1" />, {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project]),
    'GET /api/v1/projects/p1': () => jsonResponse(200, project),
    'GET /api/v1/projects/p1/sections': () => jsonResponse(200, []),
    'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 'a', projectId: 'p1', content: 'Việc chung' })])),
    'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ id: 'w1', role: 'ADMIN' })]),
    ...viewOptionsRoutes(['project:p1']),
    ...extra,
  });
  await screen.findByText('Việc chung');
  await fireEvent.press(screen.getByTestId('project-menu-open'));
  return rendered;
}

describe('Project menu: Team <-> Restricted (X2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('a TEAM project the person manages offers "Make restricted" and PATCHes access RESTRICTED', async () => {
    const { fetchMock } = await open(
      { access: 'TEAM', canManage: true },
      { 'PATCH /api/v1/projects/p1': () => jsonResponse(200, makeSharedProject({ id: 'p1', access: 'RESTRICTED' })) },
    );
    expect(screen.getByText(viSharing.sharing.menu.makeRestricted)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('project-menu-change-access'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/p1')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/p1')[0].body).toEqual({ access: 'RESTRICTED' });
    expect(await screen.findByText(viSharing.sharing.accessNowRestricted)).toBeOnTheScreen();
  });

  it('a RESTRICTED project offers "Make visible to the team" and PATCHes access TEAM', async () => {
    const { fetchMock } = await open(
      { access: 'RESTRICTED', canManage: true },
      { 'PATCH /api/v1/projects/p1': () => jsonResponse(200, makeSharedProject({ id: 'p1', access: 'TEAM' })) },
    );
    expect(screen.getByText(viSharing.sharing.menu.makeTeam)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('project-menu-change-access'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/p1')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/p1')[0].body).toEqual({ access: 'TEAM' });
  });

  it('a refusal from the server shows on the screen', async () => {
    await open({ access: 'TEAM', canManage: true }, { 'PATCH /api/v1/projects/p1': () => problem(403, 'Forbidden') });
    await fireEvent.press(screen.getByTestId('project-menu-change-access'));
    expect(await screen.findByTestId('project-error')).toBeOnTheScreen();
  });

  it.each([
    ['a member who cannot manage it', { access: 'TEAM' as const, canManage: false }],
    ['a project previewed without joining', { access: 'TEAM' as const, canManage: true, joined: false }],
    ['a personal project', { access: null, canManage: true }],
  ])('has no entry for %s', async (_label, overrides) => {
    await open(overrides as SharedOverrides);
    expect(screen.queryByTestId('project-menu-change-access')).toBeNull();
  });
});
