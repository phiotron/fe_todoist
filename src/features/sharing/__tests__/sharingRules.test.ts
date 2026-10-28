import { makeProject } from '../../../test/m1Fixtures';
import { makeSharedProject } from '../../../test/m8aFixtures';
import { canMoveToTeam, isValidInviteEmail, parseInviteToken, seatsLeft, sharingOf } from '../sharingRules';

describe('sharingOf', () => {
  it('reads a response without the M8a fields as a personal project of mine', () => {
    const sharing = sharingOf(makeProject({ id: 'p1' }));
    expect(sharing).toMatchObject({ isTeamProject: false, joined: true, canManage: true, memberCount: 1, preview: false });
    expect(sharing.canShare).toBe(true);
    expect(sharing.canLeave).toBe(false); // the owner cannot leave
    expect(sharing.canJoin).toBe(false);
  });

  it('a collaborator of a personal project can leave but not manage', () => {
    const sharing = sharingOf(makeSharedProject({ canManage: false }));
    expect(sharing.canLeave).toBe(true);
    expect(sharing.canShare).toBe(true); // everyone is equal: collaborators invite too
  });

  it('a team project I have not joined is a preview: join, no share, no leave', () => {
    const sharing = sharingOf(makeSharedProject({ access: 'TEAM', joined: false, canManage: false }));
    expect(sharing).toMatchObject({ isTeamProject: true, preview: true, canJoin: true, canShare: false, canLeave: false });
  });

  it('a joined team project can be left, even by its manager', () => {
    expect(sharingOf(makeSharedProject({ access: 'RESTRICTED', joined: true, canManage: true })).canLeave).toBe(true);
  });

  it('the Inbox and an archived project cannot be shared; an archived preview cannot be joined', () => {
    expect(sharingOf(makeProject({ isInbox: true })).canShare).toBe(false);
    expect(sharingOf(makeProject({ archivedAt: '2026-10-01T00:00:00Z' })).canShare).toBe(false);
    expect(sharingOf(makeSharedProject({ access: 'TEAM', joined: false, archivedAt: '2026-10-01T00:00:00Z' })).canJoin).toBe(false);
  });
});

describe('canMoveToTeam', () => {
  it('only the owner of a personal project without sub-projects', () => {
    expect(canMoveToTeam(makeSharedProject(), false)).toBe(true);
    expect(canMoveToTeam(makeSharedProject(), true)).toBe(false);
    expect(canMoveToTeam(makeSharedProject({ canManage: false }), false)).toBe(false);
    expect(canMoveToTeam(makeSharedProject({ access: 'TEAM' }), false)).toBe(false); // no way back out
    expect(canMoveToTeam(makeProject({ isInbox: true }), false)).toBe(false);
  });
});

describe('seatsLeft', () => {
  it('counts people and pending invitations against the limit of 5', () => {
    expect(seatsLeft(1, 0)).toBe(4);
    expect(seatsLeft(2, 3)).toBe(0);
    expect(seatsLeft(5, 2)).toBe(0);
  });
});

describe('parseInviteToken', () => {
  const TOKEN = 'abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12345';
  it('takes the token out of a taskly://join link or a bare code', () => {
    expect(parseInviteToken(`taskly://join/${TOKEN}`)).toBe(TOKEN);
    expect(parseInviteToken(`  ${TOKEN}\n`)).toBe(TOKEN);
    expect(parseInviteToken(`Mở link: taskly://join/${TOKEN} nhé`)).toBe(TOKEN);
  });
  it('rejects empty and malformed input', () => {
    expect(parseInviteToken('')).toBeNull();
    expect(parseInviteToken('   ')).toBeNull();
    expect(parseInviteToken('short')).toBeNull();
    expect(parseInviteToken('not a token with spaces')).toBeNull();
  });
});

describe('isValidInviteEmail', () => {
  it('accepts an email and rejects the rest', () => {
    expect(isValidInviteEmail('an@example.com')).toBe(true);
    expect(isValidInviteEmail(' an@example.com ')).toBe(true);
    expect(isValidInviteEmail('an@example')).toBe(false);
    expect(isValidInviteEmail('')).toBe(false);
    expect(isValidInviteEmail(`${'a'.repeat(250)}@e.co`)).toBe(false);
  });
});
