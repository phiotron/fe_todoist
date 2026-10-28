import { apiFetch } from './client';
import type { InvitationResponse, InviteLinkResponse, ProjectAccess, WorkspaceRole, WorkspaceType } from './sharing';
import type { ProjectColor } from './models';

/** M8a team workspaces (spec 12.9). Hand-written from the backend DTOs until `npm run gen:api` runs at integration. */

/** DTO WorkspaceResponse: one workspace of the caller and the caller's role in it. */
export interface WorkspaceResponse {
  id: string;
  name: string;
  type: WorkspaceType;
  role: WorkspaceRole;
  memberCount: number;
}

/** DTO WorkspaceMemberResponse (People). */
export interface WorkspaceMemberResponse {
  userId: string;
  email: string;
  displayName: string;
  role: WorkspaceRole;
  joinedAt: string;
}

/** DTO FolderResponse. */
export interface FolderResponse {
  id: string;
  workspaceId: string;
  name: string;
  sortOrder: number;
}

/** DTO TeamProjectResponse (Team Discovery). */
export interface TeamProjectResponse {
  id: string;
  name: string;
  color: ProjectColor;
  folderId: string | null;
  access: ProjectAccess;
  memberCount: number;
  activeTaskCount: number;
  joined: boolean;
}

/** DTO InviteRequest of a workspace: only ADMIN | MEMBER (a guest comes through a project). */
export interface WorkspaceInviteRequest {
  email: string;
  role?: Exclude<WorkspaceRole, 'GUEST'>;
}

const workspace = (workspaceId: string) => `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`;

export const workspacesApi = {
  /** Personal workspace first, then the teams; `type: 'TEAM'` entries drive the Team tab. */
  list: () => apiFetch<WorkspaceResponse[]>('/api/v1/workspaces'),
  create: (name: string) => apiFetch<WorkspaceResponse>('/api/v1/workspaces', { method: 'POST', body: { name } }),
  rename: (workspaceId: string, name: string) =>
    apiFetch<WorkspaceResponse>(workspace(workspaceId), { method: 'PATCH', body: { name } }),
  remove: (workspaceId: string) => apiFetch<void>(workspace(workspaceId), { method: 'DELETE' }),
  leave: (workspaceId: string) => apiFetch<void>(`${workspace(workspaceId)}/leave`, { method: 'POST' }),

  members: (workspaceId: string) => apiFetch<WorkspaceMemberResponse[]>(`${workspace(workspaceId)}/members`),
  changeRole: (workspaceId: string, userId: string, role: WorkspaceRole) =>
    apiFetch<WorkspaceMemberResponse[]>(`${workspace(workspaceId)}/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: { role },
    }),
  removeMember: (workspaceId: string, userId: string) =>
    apiFetch<void>(`${workspace(workspaceId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),

  invitations: (workspaceId: string) => apiFetch<InvitationResponse[]>(`${workspace(workspaceId)}/invitations`),
  invite: (workspaceId: string, body: WorkspaceInviteRequest) =>
    apiFetch<InvitationResponse>(`${workspace(workspaceId)}/invitations`, { method: 'POST', body }),
  inviteLink: (workspaceId: string) => apiFetch<InviteLinkResponse>(`${workspace(workspaceId)}/invite-link`),
  resetInviteLink: (workspaceId: string) =>
    apiFetch<InviteLinkResponse>(`${workspace(workspaceId)}/invite-link`, { method: 'PUT' }),
  disableInviteLink: (workspaceId: string) =>
    apiFetch<void>(`${workspace(workspaceId)}/invite-link`, { method: 'DELETE' }),

  /** Team Discovery: every non-archived project the caller can see (Active), `joined` splits Joined / not joined. */
  projects: (workspaceId: string) => apiFetch<TeamProjectResponse[]>(`${workspace(workspaceId)}/projects`),
  folders: (workspaceId: string) => apiFetch<FolderResponse[]>(`${workspace(workspaceId)}/folders`),
  createFolder: (workspaceId: string, name: string) =>
    apiFetch<FolderResponse>(`${workspace(workspaceId)}/folders`, { method: 'POST', body: { name } }),
  renameFolder: (folderId: string, name: string) =>
    apiFetch<FolderResponse>(`/api/v1/folders/${encodeURIComponent(folderId)}`, { method: 'PATCH', body: { name } }),
  deleteFolder: (folderId: string) =>
    apiFetch<void>(`/api/v1/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' }),
};
