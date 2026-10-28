import type { WorkspaceRole } from '../../api/sharing';
import type { FolderResponse, TeamProjectResponse } from '../../api/workspaces';

/** The three tabs of Team Discovery (spec 3.2 M8a). */
export type TeamTab = 'active' | 'joined' | 'notJoined';
export const TEAM_TABS: readonly TeamTab[] = ['active', 'joined', 'notJoined'];

export function filterTeamProjects(projects: readonly TeamProjectResponse[], tab: TeamTab): TeamProjectResponse[] {
  switch (tab) {
    case 'joined':
      return projects.filter((project) => project.joined);
    case 'notJoined':
      return projects.filter((project) => !project.joined);
    default:
      return [...projects];
  }
}

export interface FolderGroup {
  /** null = projects without a folder. */
  folder: FolderResponse | null;
  projects: TeamProjectResponse[];
}

/** Folders (in server order) that have projects in this tab, then the projects without a folder. */
export function groupByFolder(projects: readonly TeamProjectResponse[], folders: readonly FolderResponse[]): FolderGroup[] {
  const groups: FolderGroup[] = [];
  for (const folder of folders) {
    const inFolder = projects.filter((project) => project.folderId === folder.id);
    if (inFolder.length > 0) groups.push({ folder, projects: inFolder });
  }
  const loose = projects.filter((project) => !project.folderId || !folders.some((folder) => folder.id === project.folderId));
  if (loose.length > 0) groups.push({ folder: null, projects: loose });
  return groups;
}

/** Guests only see the projects they were invited to: no Discovery, no People, no folders, no new projects. */
export function canBrowseTeam(role: WorkspaceRole): boolean {
  return role !== 'GUEST';
}

export function canCreateInTeam(role: WorkspaceRole): boolean {
  return role !== 'GUEST';
}

export function canManageTeam(role: WorkspaceRole): boolean {
  return role === 'ADMIN';
}

/** The role a person can be changed to in People (a guest becomes one through a project invitation). */
export const ASSIGNABLE_ROLES: readonly WorkspaceRole[] = ['ADMIN', 'MEMBER', 'GUEST'];
