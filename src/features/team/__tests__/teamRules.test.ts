import { makeFolder, makeTeamProject } from '../../../test/m8aFixtures';
import { canBrowseTeam, canCreateInTeam, canManageTeam, filterTeamProjects, groupByFolder } from '../teamRules';

const joined = makeTeamProject({ id: 'a', joined: true });
const open = makeTeamProject({ id: 'b', joined: false });
const inFolder = makeTeamProject({ id: 'c', joined: true, folderId: 'f1' });

describe('filterTeamProjects (Team Discovery tabs)', () => {
  it('Active shows everything, Joined and "not joined" split on `joined`', () => {
    const all = [joined, open, inFolder];
    expect(filterTeamProjects(all, 'active').map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(filterTeamProjects(all, 'joined').map((p) => p.id)).toEqual(['a', 'c']);
    expect(filterTeamProjects(all, 'notJoined').map((p) => p.id)).toEqual(['b']);
  });
});

describe('groupByFolder', () => {
  it('lists folders that have projects first, then the projects without a folder', () => {
    const folders = [makeFolder({ id: 'f1', name: 'Marketing' }), makeFolder({ id: 'f2', name: 'Trống' })];
    const groups = groupByFolder([joined, open, inFolder], folders);
    expect(groups.map((g) => g.folder?.id ?? null)).toEqual(['f1', null]);
    expect(groups[0].projects.map((p) => p.id)).toEqual(['c']);
    expect(groups[1].projects.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('treats a project whose folder is unknown as having no folder', () => {
    expect(groupByFolder([makeTeamProject({ id: 'x', folderId: 'gone' })], [])[0].folder).toBeNull();
  });

  it('returns no group for an empty list', () => {
    expect(groupByFolder([], [makeFolder()])).toEqual([]);
  });
});

describe('role rules', () => {
  it('Guests cannot browse the team or create in it; only Admins manage it', () => {
    expect([canBrowseTeam('GUEST'), canBrowseTeam('MEMBER'), canBrowseTeam('ADMIN')]).toEqual([false, true, true]);
    expect([canCreateInTeam('GUEST'), canCreateInTeam('MEMBER'), canCreateInTeam('ADMIN')]).toEqual([false, false, true]);
    expect([canManageTeam('GUEST'), canManageTeam('MEMBER'), canManageTeam('ADMIN')]).toEqual([false, false, true]);
  });
});
