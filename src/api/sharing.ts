import { apiFetch } from './client';

/**
 * M8a (spec 12.9, plan docs/superpowers/plans/2026-10-27-m8a-chuc-nang.md). Hand-written from the backend DTOs until
 * `npm run gen:api` regenerates src/api/types.gen.ts at integration: same names as the DTO records.
 */
export type WorkspaceRole = 'ADMIN' | 'MEMBER' | 'GUEST';
export type WorkspaceType = 'PERSONAL' | 'TEAM';
/** Access of a team project: TEAM = every Admin / Member sees and can join it, RESTRICTED = invited people only. */
export type ProjectAccess = 'TEAM' | 'RESTRICTED';

/**
 * Fields M8a adds to ProjectResponse (the generated `Project` type does not have them yet). Optional here because
 * older cached responses and test fixtures lack them: read through `sharingOf` (features/sharing/sharingRules.ts).
 */
export interface ProjectSharingFields {
  workspaceId?: string;
  folderId?: string | null;
  /** null = personal project, TEAM | RESTRICTED = team project. */
  access?: ProjectAccess | null;
  /** Owner + collaborators (personal) or people who joined (team). */
  memberCount?: number;
  /** false = previewing a team project the caller has not joined (read only until Join). */
  joined?: boolean;
  /** Archive / delete / move / change access: owner of a personal project, Admin or creator of a team project. */
  canManage?: boolean;
}

/** DTO ProjectMemberResponse. */
export interface ProjectMemberResponse {
  userId: string;
  email: string;
  displayName: string;
  isOwner: boolean;
}

/** DTO InvitationResponse (never carries the token). */
export interface InvitationResponse {
  id: string;
  kind: 'PROJECT' | 'WORKSPACE';
  projectId: string | null;
  workspaceId: string | null;
  targetName: string;
  email: string;
  role: WorkspaceRole;
  invitedByName: string;
  expiresAt: string;
  createdAt: string;
  /** true = the invitee had Auto accept invites on and was added at once. */
  accepted: boolean;
}

/** DTO InviteLinkResponse: token / url null = the link is off. */
export interface InviteLinkResponse {
  token: string | null;
  url: string | null;
}

/** DTO AcceptInvitationResponse. */
export interface AcceptInvitationResponse {
  kind: 'PROJECT' | 'WORKSPACE';
  projectId: string | null;
  workspaceId: string;
}

/** DTO MoveToWorkspaceRequest. */
export interface MoveToWorkspaceRequest {
  workspaceId: string;
  access?: ProjectAccess;
  folderId?: string | null;
}

const project = (projectId: string) => `/api/v1/projects/${encodeURIComponent(projectId)}`;
const invitation = (invitationId: string) => `/api/v1/invitations/${encodeURIComponent(invitationId)}`;

/** Sharing of ONE project + the invitations addressed to the signed-in user (spec 12.9 M8a). */
export const sharingApi = {
  members: (projectId: string) => apiFetch<ProjectMemberResponse[]>(`${project(projectId)}/members`),
  /** Owner of a personal project / Admin / creator of a team project; a collaborator may remove only themselves. */
  removeMember: (projectId: string, userId: string) =>
    apiFetch<void>(`${project(projectId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  invitations: (projectId: string) => apiFetch<InvitationResponse[]>(`${project(projectId)}/invitations`),
  invite: (projectId: string, email: string) =>
    apiFetch<InvitationResponse>(`${project(projectId)}/invitations`, { method: 'POST', body: { email } }),
  inviteLink: (projectId: string) => apiFetch<InviteLinkResponse>(`${project(projectId)}/invite-link`),
  /** Turns the link on, or replaces it (the old link stops working). */
  resetInviteLink: (projectId: string) =>
    apiFetch<InviteLinkResponse>(`${project(projectId)}/invite-link`, { method: 'PUT' }),
  disableInviteLink: (projectId: string) => apiFetch<void>(`${project(projectId)}/invite-link`, { method: 'DELETE' }),
  leave: (projectId: string) => apiFetch<void>(`${project(projectId)}/leave`, { method: 'POST' }),
  /** Admin / Member joins a TEAM project they were previewing. */
  join: (projectId: string) => apiFetch<unknown>(`${project(projectId)}/join`, { method: 'POST' }),
  /** Personal → team only (there is no way back). */
  moveToWorkspace: (projectId: string, body: MoveToWorkspaceRequest) =>
    apiFetch<unknown>(`${project(projectId)}/move-to-workspace`, { method: 'POST', body }),

  /** Invitations sent to the signed-in user's email that are still open. */
  mine: () => apiFetch<InvitationResponse[]>('/api/v1/invitations'),
  /** Token from a mailed invitation or from an invite link (deep link taskly://join/<token> or pasted). */
  acceptToken: (token: string) =>
    apiFetch<AcceptInvitationResponse>('/api/v1/invitations/accept', { method: 'POST', body: { token } }),
  accept: (invitationId: string) =>
    apiFetch<AcceptInvitationResponse>(`${invitation(invitationId)}/accept`, { method: 'POST' }),
  decline: (invitationId: string) => apiFetch<void>(`${invitation(invitationId)}/decline`, { method: 'POST' }),
  revoke: (invitationId: string) => apiFetch<void>(invitation(invitationId), { method: 'DELETE' }),
};
