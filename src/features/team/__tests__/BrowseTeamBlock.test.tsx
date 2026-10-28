import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import vi from '../../../i18n/locales/vi/team.json';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeInvitation, makeWorkspace } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { BrowseTeamBlock } from '../BrowseTeamBlock';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));

describe('BrowseTeamBlock (Browse › Teams)', () => {
  beforeEach(() => jest.clearAllMocks());

  const routes = {
    'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ type: 'PERSONAL' }), makeWorkspace({ id: 'w1', name: 'Công ty', role: 'MEMBER' })]),
    'GET /api/v1/invitations': () => jsonResponse(200, [makeInvitation(), makeInvitation()]),
  };

  it('lists my teams with my role, the invitation count, Join and Create entries', async () => {
    await renderSignedIn(<BrowseTeamBlock />, routes);
    expect(await screen.findByTestId('browse-team-w1')).toBeOnTheScreen();
    expect(screen.getByText(vi.team.roles.MEMBER)).toBeOnTheScreen();
    expect(await screen.findByText('2')).toBeOnTheScreen(); // pending invitations

    await fireEvent.press(screen.getByTestId('browse-team-w1'));
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/team', params: { workspaceId: 'w1' } });
    await fireEvent.press(screen.getByTestId('browse-invitations'));
    expect(router.push).toHaveBeenCalledWith('/invitations');
    await fireEvent.press(screen.getByTestId('browse-join'));
    expect(router.push).toHaveBeenCalledWith('/join');
  });

  it('a person without any team still sees how to join or create one', async () => {
    await renderSignedIn(<BrowseTeamBlock />, {
      'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ type: 'PERSONAL' })]),
      'GET /api/v1/invitations': () => jsonResponse(200, []),
    });
    expect(await screen.findByTestId('browse-create-team')).toBeOnTheScreen();
    expect(screen.getByTestId('browse-join')).toBeOnTheScreen();
    expect(screen.queryByTestId('browse-team-w1')).toBeNull();
  });

  it('creates a team (name trimmed) and lands on the Team tab', async () => {
    const { fetchMock } = await renderSignedIn(<BrowseTeamBlock />, {
      ...routes,
      'POST /api/v1/workspaces': () => jsonResponse(201, makeWorkspace({ id: 'w9', name: 'Nhóm mới' })),
    });
    await fireEvent.press(await screen.findByTestId('browse-create-team'));
    await fireEvent.press(screen.getByTestId('create-team-submit'));
    expect(await screen.findByText(vi.team.create.nameRequired)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces')).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('create-team-name'), '  Nhóm mới ');
    await fireEvent.press(screen.getByTestId('create-team-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces')[0].body).toEqual({ name: 'Nhóm mới' });
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith({ pathname: '/team', params: { workspaceId: 'w9' } }));
  });

  it('keeps the dialog and the typed name when creating fails', async () => {
    await renderSignedIn(<BrowseTeamBlock />, { ...routes, 'POST /api/v1/workspaces': () => problem(500, 'Server Error') });
    await fireEvent.press(await screen.findByTestId('browse-create-team'));
    await fireEvent.changeText(screen.getByTestId('create-team-name'), 'Nhóm mới');
    await fireEvent.press(screen.getByTestId('create-team-submit'));
    await waitFor(() => expect(screen.getByTestId('create-team-name').props.value).toBe('Nhóm mới'));
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
