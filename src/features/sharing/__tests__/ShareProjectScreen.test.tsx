import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import vi from '../../../i18n/locales/vi/sharing.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeInvitation, makeProjectMember, makeSharedProject } from '../../../test/m8aFixtures';
import { testUser } from '../../../test/fixtures';
import { renderSignedIn } from '../../../test/screen';
import { ShareProjectScreen } from '../ShareProjectScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const owner = makeProjectMember({ userId: testUser.id, displayName: 'An', email: testUser.email, isOwner: true });
const bob = makeProjectMember({ userId: 'u-bob', displayName: 'Bob', email: 'bob@example.com' });
const pending = makeInvitation({ id: 'inv-1', email: 'carol@example.com' });
const URL = 'taskly://join/abcdefghijklmnop';

function routes(extra: ApiRoutes = {}, project = makeSharedProject({ id: 'p1', name: 'Nhà', memberCount: 2 })): ApiRoutes {
  return {
    'GET /api/v1/projects/p1': () => jsonResponse(200, project),
    'GET /api/v1/projects/p1/members': () => jsonResponse(200, [owner, bob]),
    'GET /api/v1/projects/p1/invitations': () => jsonResponse(200, [pending]),
    'GET /api/v1/projects/p1/invite-link': () => jsonResponse(200, { token: null, url: null }),
    ...extra,
  };
}

async function open(extra: ApiRoutes = {}, project?: ReturnType<typeof makeSharedProject>) {
  const rendered = await renderSignedIn(<ShareProjectScreen projectId="p1" />, routes(extra, project));
  await screen.findByTestId(`share-member-${bob.userId}`);
  return rendered;
}

describe('ShareProjectScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the owner and the collaborators, the pending invitations and the access line', async () => {
    await open();
    expect(screen.getByTestId(`share-member-${owner.userId}`)).toBeOnTheScreen();
    expect(screen.getByText(`${vi.sharing.owner} · ${testUser.email}`)).toBeOnTheScreen();
    expect(screen.getByText('Bob')).toBeOnTheScreen();
    expect(screen.getByText('carol@example.com')).toBeOnTheScreen();
    expect(screen.getByText(vi.sharing.accessEveryone.replace('{{name}}', 'Nhà'))).toBeOnTheScreen();
    expect(screen.getByText(vi.sharing.seatsLeft.replace('{{n}}', '2'))).toBeOnTheScreen(); // 5 seats - 2 people - 1 pending invitation
  });

  it('invites by email (trimmed, lower case), clears the field and reloads the lists', async () => {
    const invite = jest.fn(() => jsonResponse(201, makeInvitation({ email: 'dan@example.com' })));
    const { fetchMock } = await open({ 'POST /api/v1/projects/p1/invitations': invite });

    await fireEvent.changeText(screen.getByTestId('share-invite-email'), '  Dan@Example.com ');
    await fireEvent.press(screen.getByTestId('share-invite-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/invitations')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/invitations')[0].body).toEqual({ email: 'dan@example.com' });
    await waitFor(() => expect(screen.getByTestId('share-invite-email').props.value).toBe(''));
    expect(await screen.findByText(vi.sharing.invited.replace('{{email}}', 'dan@example.com'))).toBeOnTheScreen();
    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/projects/p1/invitations').length).toBeGreaterThan(1));
  });

  it('says so when the invitee was added at once (their Auto accept invites is on)', async () => {
    await open({ 'POST /api/v1/projects/p1/invitations': () => jsonResponse(201, makeInvitation({ email: 'dan@example.com', accepted: true })) });
    await fireEvent.changeText(screen.getByTestId('share-invite-email'), 'dan@example.com');
    await fireEvent.press(screen.getByTestId('share-invite-submit'));
    expect(await screen.findByText(vi.sharing.invitedAdded.replace('{{email}}', 'dan@example.com'))).toBeOnTheScreen();
  });

  it('refuses an invalid email without a request', async () => {
    const { fetchMock } = await open();
    await fireEvent.changeText(screen.getByTestId('share-invite-email'), 'khong-phai-email');
    await fireEvent.press(screen.getByTestId('share-invite-submit'));
    expect(await screen.findByText(vi.sharing.emailInvalid)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/invitations')).toHaveLength(0);
  });

  it('shows the seat limit sentence on 422 and keeps the typed email', async () => {
    await open({
      'POST /api/v1/projects/p1/invitations': () => problem(422, 'Unprocessable', { code: 'limit-reached', limit: 'PROJECT_MEMBERS', max: 5 }),
    });
    await fireEvent.changeText(screen.getByTestId('share-invite-email'), 'dan@example.com');
    await fireEvent.press(screen.getByTestId('share-invite-submit'));
    expect(await screen.findByTestId('share-error')).toBeOnTheScreen();
    expect(screen.getByTestId('share-error')).toHaveTextContent(/5/);
    expect(screen.getByTestId('share-invite-email').props.value).toBe('dan@example.com');
  });

  it('Copy link turns the link on when it is off, then copies the taskly://join url', async () => {
    const { fetchMock } = await open({ 'PUT /api/v1/projects/p1/invite-link': () => jsonResponse(200, { token: 'abcdefghijklmnop', url: URL }) });
    await fireEvent.press(screen.getByTestId('share-copy-link'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(URL));
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/projects/p1/invite-link')).toHaveLength(1);
    expect(await screen.findByText(vi.sharing.linkCopied)).toBeOnTheScreen();
  });

  it('Copy link reuses an existing link (no PUT) and offers reset / turn off', async () => {
    const { fetchMock } = await open({
      'GET /api/v1/projects/p1/invite-link': () => jsonResponse(200, { token: 'abcdefghijklmnop', url: URL }),
      'DELETE /api/v1/projects/p1/invite-link': () => jsonResponse(204),
    });
    await screen.findByTestId('share-reset-link');
    await fireEvent.press(screen.getByTestId('share-copy-link'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(URL));
    expect(requestsTo(fetchMock, 'PUT', '/api/v1/projects/p1/invite-link')).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('share-disable-link'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/projects/p1/invite-link')).toHaveLength(1));
  });

  it('withdraws a pending invitation', async () => {
    const { fetchMock } = await open({ 'DELETE /api/v1/invitations/inv-1': () => jsonResponse(204) });
    await fireEvent.press(screen.getByTestId('share-revoke-inv-1'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/invitations/inv-1')).toHaveLength(1));
  });

  it('the owner removes a collaborator after a confirmation; the owner row has no remove button', async () => {
    const { fetchMock } = await open({ 'DELETE /api/v1/projects/p1/members/u-bob': () => jsonResponse(204) });
    expect(screen.queryByTestId(`share-remove-${owner.userId}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('share-remove-u-bob'));
    expect(await screen.findByTestId('share-remove-dialog')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/projects/p1/members/u-bob')).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('share-remove-dialog-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/projects/p1/members/u-bob')).toHaveLength(1));
  });

  it('a collaborator (cannot manage) sees everyone but cannot remove anyone', async () => {
    await open({}, makeSharedProject({ id: 'p1', name: 'Nhà', canManage: false }));
    expect(screen.queryByTestId('share-remove-u-bob')).toBeNull();
    expect(screen.getByTestId('share-invite-submit')).toBeOnTheScreen(); // everyone is equal: they can still invite
  });

  it('a team project has no Copy link / seat hint (invite by email only)', async () => {
    await open({}, makeSharedProject({ id: 'p1', name: 'Nhà', access: 'TEAM' }));
    expect(screen.queryByTestId('share-copy-link')).toBeNull();
    expect(screen.queryByText(vi.sharing.seatsLeft.replace('{{n}}', '2'))).toBeNull();
  });

  it('shows "not found" for a project the person cannot see and goes back', async () => {
    await renderSignedIn(<ShareProjectScreen projectId="p1" />, { 'GET /api/v1/projects/p1': () => problem(404, 'Not Found') });
    expect(await screen.findByTestId('share-not-found')).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
  });
});
