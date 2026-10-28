import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import vi from '../../../i18n/locales/vi/sharing.json';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeInvitation } from '../../../test/m8aFixtures';
import { renderSignedIn } from '../../../test/screen';
import { InvitationsScreen } from '../InvitationsScreen';
import { JoinScreen } from '../JoinScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() } }));

const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';

describe('JoinScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pre-fills the code from a taskly://join deep link but waits for the Join button', async () => {
    const { fetchMock } = await renderSignedIn(<JoinScreen initialCode={TOKEN} />);
    expect(screen.getByTestId('join-code').props.value).toBe(TOKEN);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/invitations/accept')).toHaveLength(0);
  });

  it('takes the token out of a pasted link, joins and opens the project', async () => {
    const { fetchMock } = await renderSignedIn(<JoinScreen />, {
      'POST /api/v1/invitations/accept': () => jsonResponse(200, { kind: 'PROJECT', projectId: 'p9', workspaceId: 'w1' }),
    });
    await fireEvent.changeText(screen.getByTestId('join-code'), `taskly://join/${TOKEN}`);
    await fireEvent.press(screen.getByTestId('join-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/invitations/accept')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/invitations/accept')[0].body).toEqual({ token: TOKEN });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/project/[id]', params: { id: 'p9' } }));
    expect(await screen.findByText(vi.sharing.join.joinedProject)).toBeOnTheScreen();
  });

  it('a team link leads to the Team tab', async () => {
    await renderSignedIn(<JoinScreen />, {
      'POST /api/v1/invitations/accept': () => jsonResponse(200, { kind: 'WORKSPACE', projectId: null, workspaceId: 'w1' }),
    });
    await fireEvent.changeText(screen.getByTestId('join-code'), TOKEN);
    await fireEvent.press(screen.getByTestId('join-submit'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/team'));
  });

  it('rejects text that is not a code without a request', async () => {
    const { fetchMock } = await renderSignedIn(<JoinScreen />);
    await fireEvent.changeText(screen.getByTestId('join-code'), 'xin chao');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(await screen.findByText(vi.sharing.join.invalid)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/invitations/accept')).toHaveLength(0);
  });

  it('shows the server sentence for an expired invitation (410) and stays on the screen', async () => {
    await renderSignedIn(<JoinScreen initialCode={TOKEN} />, {
      'POST /api/v1/invitations/accept': () => problem(410, 'Gone', { code: 'invitation-expired', detail: 'Lời mời đã hết hạn hoặc đã được dùng' }),
    });
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(await screen.findByText('Lời mời đã hết hạn hoặc đã được dùng')).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('InvitationsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  const project = makeInvitation({ id: 'i1', kind: 'PROJECT', projectId: 'p1', targetName: 'Nhà', invitedByName: 'An' });
  const team = makeInvitation({ id: 'i2', kind: 'WORKSPACE', projectId: null, workspaceId: 'w1', targetName: 'Công ty', invitedByName: 'Bình' });

  it('lists my invitations with who sent them and what for', async () => {
    await renderSignedIn(<InvitationsScreen />, { 'GET /api/v1/invitations': () => jsonResponse(200, [project, team]) });
    expect(await screen.findByText('Nhà')).toBeOnTheScreen();
    expect(screen.getByText('Công ty')).toBeOnTheScreen();
    expect(screen.getByText(vi.sharing.invitations.from.replace('{{name}}', 'Bình'))).toBeOnTheScreen();
  });

  it('accepting opens the project', async () => {
    const { fetchMock } = await renderSignedIn(<InvitationsScreen />, {
      'GET /api/v1/invitations': () => jsonResponse(200, [project]),
      'POST /api/v1/invitations/i1/accept': () => jsonResponse(200, { kind: 'PROJECT', projectId: 'p1', workspaceId: 'w1' }),
    });
    await fireEvent.press(await screen.findByTestId('invitation-accept-i1'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/invitations/i1/accept')).toHaveLength(1));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/project/[id]', params: { id: 'p1' } }));
  });

  it('declining removes it from the list', async () => {
    let open = [project, team];
    const { fetchMock } = await renderSignedIn(<InvitationsScreen />, {
      'GET /api/v1/invitations': () => jsonResponse(200, open),
      'POST /api/v1/invitations/i2/decline': () => {
        open = [project];
        return jsonResponse(204);
      },
    });
    await fireEvent.press(await screen.findByTestId('invitation-decline-i2'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/invitations/i2/decline')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByTestId('invitation-i2')).toBeNull());
    expect(screen.getByTestId('invitation-i1')).toBeOnTheScreen();
  });

  it('an invitation that went stale (410) shows the error and keeps the screen', async () => {
    await renderSignedIn(<InvitationsScreen />, {
      'GET /api/v1/invitations': () => jsonResponse(200, [project]),
      'POST /api/v1/invitations/i1/accept': () => problem(410, 'Gone', { code: 'invitation-expired', detail: 'Lời mời đã hết hạn' }),
    });
    await fireEvent.press(await screen.findByTestId('invitation-accept-i1'));
    expect(await screen.findByText('Lời mời đã hết hạn')).toBeOnTheScreen();
  });

  it('has a friendly empty state', async () => {
    await renderSignedIn(<InvitationsScreen />, { 'GET /api/v1/invitations': () => jsonResponse(200, []) });
    expect(await screen.findByTestId('invitations-empty')).toBeOnTheScreen();
    expect(screen.getByText(vi.sharing.invitations.empty)).toBeOnTheScreen();
  });
});
