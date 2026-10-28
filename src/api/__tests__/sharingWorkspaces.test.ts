import { tokenStore } from '../../lib/tokenStore';
import { jsonResponse, mockFetch, requestAt } from '../../test/http';
import { describeError } from '../describeError';
import { ApiError } from '../errors';
import { queryKeys } from '../queryKeys';
import { sharingApi } from '../sharing';
import { workspacesApi } from '../workspaces';

const pathOf = (url: string) => url.replace(/^.*\/api\/v1/, '');

describe('sharingApi (M8a)', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('reads members, invitations and the invite link of a project', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await sharingApi.members('p1');
    await sharingApi.invitations('p1');
    await sharingApi.inviteLink('p1');
    expect([0, 1, 2].map((i) => pathOf(requestAt(fetchMock, i).url))).toEqual([
      '/projects/p1/members',
      '/projects/p1/invitations',
      '/projects/p1/invite-link',
    ]);
  });

  it('invites by email, resets / turns off the link, removes a member, leaves, joins', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await sharingApi.invite('p1', 'bo@example.com');
    await sharingApi.resetInviteLink('p1');
    await sharingApi.disableInviteLink('p1');
    await sharingApi.removeMember('p1', 'u2');
    await sharingApi.leave('p1');
    await sharingApi.join('p1');
    const calls = [0, 1, 2, 3, 4, 5].map((i) => requestAt(fetchMock, i));
    expect(calls.map((c) => `${c.method} ${pathOf(c.url)}`)).toEqual([
      'POST /projects/p1/invitations',
      'PUT /projects/p1/invite-link',
      'DELETE /projects/p1/invite-link',
      'DELETE /projects/p1/members/u2',
      'POST /projects/p1/leave',
      'POST /projects/p1/join',
    ]);
    expect(calls[0].body).toEqual({ email: 'bo@example.com' });
  });

  it('moves a project into a team and handles the invitations addressed to me', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await sharingApi.moveToWorkspace('p1', { workspaceId: 'w1', access: 'RESTRICTED' });
    await sharingApi.mine();
    await sharingApi.acceptToken('tok-123');
    await sharingApi.accept('inv1');
    await sharingApi.decline('inv1');
    await sharingApi.revoke('inv1');
    const calls = [0, 1, 2, 3, 4, 5].map((i) => requestAt(fetchMock, i));
    expect(calls.map((c) => `${c.method} ${pathOf(c.url)}`)).toEqual([
      'POST /projects/p1/move-to-workspace',
      'GET /invitations',
      'POST /invitations/accept',
      'POST /invitations/inv1/accept',
      'POST /invitations/inv1/decline',
      'DELETE /invitations/inv1',
    ]);
    expect(calls[0].body).toEqual({ workspaceId: 'w1', access: 'RESTRICTED' });
    expect(calls[2].body).toEqual({ token: 'tok-123' });
  });
});

describe('workspacesApi (M8a)', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('covers the workspace, People, invitation, link, discovery and folder endpoints', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await workspacesApi.list();
    await workspacesApi.create('Công ty');
    await workspacesApi.rename('w1', 'Mới');
    await workspacesApi.remove('w1');
    await workspacesApi.leave('w1');
    await workspacesApi.members('w1');
    await workspacesApi.changeRole('w1', 'u2', 'ADMIN');
    await workspacesApi.removeMember('w1', 'u2');
    await workspacesApi.invitations('w1');
    await workspacesApi.invite('w1', { email: 'bo@example.com', role: 'ADMIN' });
    await workspacesApi.resetInviteLink('w1');
    await workspacesApi.projects('w1');
    await workspacesApi.createFolder('w1', 'Marketing');
    await workspacesApi.deleteFolder('f1');
    const calls = fetchMock.mock.calls.map((_, i) => requestAt(fetchMock, i));
    expect(calls.map((c) => `${c.method} ${pathOf(c.url)}`)).toEqual([
      'GET /workspaces',
      'POST /workspaces',
      'PATCH /workspaces/w1',
      'DELETE /workspaces/w1',
      'POST /workspaces/w1/leave',
      'GET /workspaces/w1/members',
      'PATCH /workspaces/w1/members/u2',
      'DELETE /workspaces/w1/members/u2',
      'GET /workspaces/w1/invitations',
      'POST /workspaces/w1/invitations',
      'PUT /workspaces/w1/invite-link',
      'GET /workspaces/w1/projects',
      'POST /workspaces/w1/folders',
      'DELETE /folders/f1',
    ]);
    expect(calls[1].body).toEqual({ name: 'Công ty' });
    expect(calls[6].body).toEqual({ role: 'ADMIN' });
    expect(calls[9].body).toEqual({ email: 'bo@example.com', role: 'ADMIN' });
  });
});

describe('M8a query keys and errors', () => {
  it('keys are namespaced so a write refreshes them (DATA_ROOTS) without touching other lists', () => {
    expect(queryKeys.sharing.members('p1')).toEqual(['sharing', 'members', 'p1']);
    expect(queryKeys.workspaces.projects('w1')).toEqual(['workspaces', 'projects', 'w1']);
  });

  it('answers the seat limit with its own sentence and falls back to the server text for the new 409 / 410', () => {
    const limit = new ApiError({ status: 422, title: 'x', code: 'limit-reached', limit: 'PROJECT_MEMBERS', max: 5 });
    expect(describeError(limit).message).toContain('5');
    expect(describeError(limit).message).not.toBe(describeError(new ApiError({ status: 422, title: 'x', code: 'limit-reached', limit: 'OTHER', max: 5 })).message);
    const gone = new ApiError({ status: 410, title: 'Gone', detail: 'Lời mời đã hết hạn' });
    expect(describeError(gone).message).toBe('Lời mời đã hết hạn');
    const member = new ApiError({ status: 409, title: 'Conflict', code: 'already-member', detail: 'Người này đã ở trong dự án' });
    expect(describeError(member).message).toBe('Người này đã ở trong dự án');
  });
});
