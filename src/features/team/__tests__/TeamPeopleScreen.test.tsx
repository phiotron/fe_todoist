import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import viTeam from '../../../i18n/locales/vi/team.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, problem } from '../../../test/http';
import { makeInvitation, makeMember, makeWorkspace } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { TeamPeopleScreen } from '../TeamPeopleScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const me = makeMember({ userId: testUser.id, displayName: 'An', email: testUser.email, role: 'ADMIN' });
const bob = makeMember({ userId: 'u-bob', displayName: 'Bob', email: 'bob@example.com', role: 'MEMBER' });
const guest = makeMember({ userId: 'u-gus', displayName: 'Gus', email: 'gus@example.com', role: 'GUEST' });
const pending = makeInvitation({ id: 'inv-w', kind: 'WORKSPACE', projectId: null, workspaceId: 'w1', email: 'dan@example.com', role: 'ADMIN' });

function routes(role: 'ADMIN' | 'MEMBER', extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/v1/workspaces': () => jsonResponse(200, [makeWorkspace({ id: 'w1', name: 'Công ty', role })]),
    'GET /api/v1/workspaces/w1/members': () => jsonResponse(200, [me, bob, guest]),
    'GET /api/v1/workspaces/w1/invitations': () => jsonResponse(200, [pending]),
    'GET /api/v1/workspaces/w1/invite-link': () => jsonResponse(200, { token: null, url: null }),
    ...extra,
  };
}

async function open(role: 'ADMIN' | 'MEMBER' = 'ADMIN', extra: ApiRoutes = {}) {
  const rendered = await renderSignedIn(<TeamPeopleScreen workspaceId="w1" />, routes(role, extra));
  await screen.findByTestId('team-member-u-bob');
  return rendered;
}

describe('TeamPeopleScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the people with their role, and the pending invitations (Admin)', async () => {
    await open();
    expect(screen.getByText(`${viTeam.team.roles.MEMBER} · bob@example.com`)).toBeOnTheScreen();
    expect(screen.getByText(`${viTeam.team.roles.GUEST} · gus@example.com`)).toBeOnTheScreen();
    expect(await screen.findByTestId('team-invitation-inv-w')).toBeOnTheScreen();
  });

  it('an Admin changes a role from the person menu and removes someone after a confirmation', async () => {
    const { fetchMock } = await open('ADMIN', {
      'PATCH /api/v1/workspaces/w1/members/u-bob': () => jsonResponse(200, [me, { ...bob, role: 'ADMIN' }, guest]),
      'DELETE /api/v1/workspaces/w1/members/u-gus': () => jsonResponse(204),
    });
    expect(screen.queryByTestId(`team-member-menu-${testUser.id}`)).toBeNull(); // not on myself

    await fireEvent.press(screen.getByTestId('team-member-menu-u-bob'));
    await fireEvent.press(await screen.findByTestId('team-member-menu-role-ADMIN'));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/v1/workspaces/w1/members/u-bob')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/workspaces/w1/members/u-bob')[0].body).toEqual({ role: 'ADMIN' });

    await fireEvent.press(screen.getByTestId('team-member-menu-u-gus'));
    await fireEvent.press(await screen.findByTestId('team-member-menu-remove'));
    expect(await screen.findByTestId('team-remove-dialog')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/workspaces/w1/members/u-gus')).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('team-remove-dialog-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/workspaces/w1/members/u-gus')).toHaveLength(1));
  });

  it('shows the last-admin refusal from the server', async () => {
    await open('ADMIN', {
      'PATCH /api/v1/workspaces/w1/members/u-bob': () => problem(409, 'Conflict', { code: 'last-admin', detail: 'Nhóm phải còn ít nhất một quản trị viên' }),
    });
    await fireEvent.press(screen.getByTestId('team-member-menu-u-bob'));
    await fireEvent.press(await screen.findByTestId('team-member-menu-role-GUEST'));
    expect(await screen.findByText('Nhóm phải còn ít nhất một quản trị viên')).toBeOnTheScreen();
  });

  it('invites by email with a role (default Member) and rejects a bad email locally', async () => {
    const { fetchMock } = await open('ADMIN', {
      'POST /api/v1/workspaces/w1/invitations': () => jsonResponse(201, makeInvitation({ kind: 'WORKSPACE', email: 'eva@example.com' })),
    });
    await fireEvent.changeText(screen.getByTestId('team-invite-email'), 'sai');
    await fireEvent.press(screen.getByTestId('team-invite-submit'));
    expect(await screen.findByText(viTeam.team.peopleScreen.emailInvalid)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces/w1/invitations')).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('team-invite-email'), 'Eva@Example.com');
    await fireEvent.press(screen.getByTestId('team-invite-role-ADMIN'));
    await fireEvent.press(screen.getByTestId('team-invite-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces/w1/invitations')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces/w1/invitations')[0].body).toEqual({ email: 'eva@example.com', role: 'ADMIN' });
  });

  it('copies the team link (turning it on first) and withdraws an invitation', async () => {
    const { fetchMock } = await open('ADMIN', {
      'PUT /api/v1/workspaces/w1/invite-link': () => jsonResponse(200, { token: 'tok', url: 'taskly://join/tok' }),
      'DELETE /api/v1/invitations/inv-w': () => jsonResponse(204),
    });
    await fireEvent.press(screen.getByTestId('team-copy-link'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('taskly://join/tok'));
    await fireEvent.press(await screen.findByTestId('team-revoke-inv-w'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/invitations/inv-w')).toHaveLength(1));
  });

  it('a Member sees the people but has no invite, role or remove controls — only Leave team', async () => {
    const { fetchMock } = await open('MEMBER');
    expect(screen.queryByTestId('team-invite-email')).toBeNull();
    expect(screen.queryByTestId('team-member-menu-u-bob')).toBeNull();
    expect(screen.queryByTestId('team-copy-link')).toBeNull();
    expect(screen.getByTestId('team-leave')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/workspaces/w1/invitations')).toHaveLength(0);
  });

  it('leaves the team after a confirmation and returns to Browse', async () => {
    const { fetchMock } = await open('MEMBER', { 'POST /api/v1/workspaces/w1/leave': () => jsonResponse(204) });
    await fireEvent.press(screen.getByTestId('team-leave'));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces/w1/leave')).toHaveLength(0);
    await fireEvent.press(await screen.findByTestId('team-leave-dialog-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/workspaces/w1/leave')).toHaveLength(1));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/browse'));
  });
});
