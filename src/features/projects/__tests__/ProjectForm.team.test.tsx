import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject } from '../../../test/m1Fixtures';
import { makeSharedProject } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { ProjectFormScreen } from '../ProjectFormScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

function routes(extra: ApiRoutes = {}): ApiRoutes {
  return { 'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, makeProject({ id: 'p0' })]), ...extra };
}

describe('ProjectFormScreen in a team workspace (M8a)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a team project: no parent picker, workspaceId + access TEAM by default', async () => {
    const { fetchMock } = await renderSignedIn(
      <ProjectFormScreen workspaceId="w1" />,
      routes({ 'POST /api/v1/projects': () => jsonResponse(201, makeSharedProject({ id: 'tp1' })) }),
    );
    expect(screen.queryByTestId('project-form-parent')).toBeNull();
    expect(screen.getByTestId('project-form-restricted')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('project-form-name'), 'Website');
    await fireEvent.press(screen.getByTestId('project-form-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects')[0].body).toMatchObject({ name: 'Website', workspaceId: 'w1', access: 'TEAM' });
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects')[0].body).not.toHaveProperty('parentId');
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('the Restricted switch sends access RESTRICTED', async () => {
    const { fetchMock } = await renderSignedIn(
      <ProjectFormScreen workspaceId="w1" />,
      routes({ 'POST /api/v1/projects': () => jsonResponse(201, makeSharedProject({ id: 'tp1' })) }),
    );
    await fireEvent.changeText(screen.getByTestId('project-form-name'), 'Kín');
    await fireEvent.press(screen.getByTestId('project-form-restricted'));
    await fireEvent.press(screen.getByTestId('project-form-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects')[0].body).toMatchObject({ access: 'RESTRICTED' });
  });

  it('a personal project keeps the parent picker and has no access switch', async () => {
    await renderSignedIn(<ProjectFormScreen />, routes());
    expect(screen.getByTestId('project-form-parent')).toBeOnTheScreen();
    expect(screen.queryByTestId('project-form-restricted')).toBeNull();
  });

  it('editing a team project the person manages changes its access; a plain member only renames', async () => {
    const managed = makeSharedProject({ id: 'tp1', name: 'Website', access: 'TEAM', canManage: true });
    const { fetchMock } = await renderSignedIn(
      <ProjectFormScreen projectId="tp1" />,
      routes({
        'GET /api/v1/projects/tp1': () => jsonResponse(200, managed),
        'PATCH /api/v1/projects/tp1': () => jsonResponse(200, managed),
      }),
    );
    await waitFor(() => expect(screen.getByTestId('project-form-name').props.value).toBe('Website'));
    expect(screen.queryByTestId('project-form-parent')).toBeNull();
    await fireEvent.press(screen.getByTestId('project-form-restricted'));
    await fireEvent.press(screen.getByTestId('project-form-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/tp1')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/tp1')[0].body).toMatchObject({ access: 'RESTRICTED' });
  });

  it('a team member who cannot manage the project does not get the access switch', async () => {
    const plain = makeSharedProject({ id: 'tp2', name: 'Chung', access: 'TEAM', canManage: false });
    await renderSignedIn(<ProjectFormScreen projectId="tp2" />, routes({ 'GET /api/v1/projects/tp2': () => jsonResponse(200, plain) }));
    await waitFor(() => expect(screen.getByTestId('project-form-name').props.value).toBe('Chung'));
    expect(screen.queryByTestId('project-form-restricted')).toBeNull();
  });
});
