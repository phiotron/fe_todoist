import type { Project } from '../api/models';
import type { InvitationResponse, ProjectMemberResponse, ProjectSharingFields } from '../api/sharing';
import type { FolderResponse, TeamProjectResponse, WorkspaceMemberResponse, WorkspaceResponse } from '../api/workspaces';
import { makeProject } from './m1Fixtures';

const CREATED = '2026-10-20T00:00:00Z';
let counter = 0;
const nextId = (prefix: string) => `${prefix}${++counter}`;

/** A Project with the M8a fields the generated type does not have yet (defaults: shared personal project, mine). */
export function makeSharedProject(overrides: Partial<Project> & ProjectSharingFields = {}): Project {
  return { ...makeProject(), workspaceId: 'w-personal', folderId: null, access: null, memberCount: 2, joined: true, canManage: true, ...overrides } as Project;
}

export function makeWorkspace(overrides: Partial<WorkspaceResponse> = {}): WorkspaceResponse {
  return { id: nextId('w'), name: 'Công ty', type: 'TEAM', role: 'ADMIN', memberCount: 3, ...overrides };
}

export function makeMember(overrides: Partial<WorkspaceMemberResponse> = {}): WorkspaceMemberResponse {
  const id = nextId('u');
  return { userId: id, email: `${id}@example.com`, displayName: `Người ${id}`, role: 'MEMBER', joinedAt: CREATED, ...overrides };
}

export function makeProjectMember(overrides: Partial<ProjectMemberResponse> = {}): ProjectMemberResponse {
  const id = nextId('u');
  return { userId: id, email: `${id}@example.com`, displayName: `Người ${id}`, isOwner: false, ...overrides };
}

export function makeInvitation(overrides: Partial<InvitationResponse> = {}): InvitationResponse {
  const id = nextId('inv');
  return {
    id,
    kind: 'PROJECT',
    projectId: 'p1',
    workspaceId: null,
    targetName: 'Nhà',
    email: 'khach@example.com',
    role: 'MEMBER',
    invitedByName: 'An',
    expiresAt: '2026-10-27T00:00:00Z',
    createdAt: CREATED,
    accepted: false,
    ...overrides,
  };
}

export function makeTeamProject(overrides: Partial<TeamProjectResponse> = {}): TeamProjectResponse {
  return {
    id: nextId('tp'),
    name: 'Dự án nhóm',
    color: 'blue',
    folderId: null,
    access: 'TEAM',
    memberCount: 2,
    activeTaskCount: 0,
    joined: true,
    ...overrides,
  };
}

export function makeFolder(overrides: Partial<FolderResponse> = {}): FolderResponse {
  return { id: nextId('f'), workspaceId: 'w1', name: 'Marketing', sortOrder: 1024, ...overrides };
}
