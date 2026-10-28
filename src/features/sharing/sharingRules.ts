import type { Project } from '../../api/models';
import type { ProjectAccess, ProjectSharingFields } from '../../api/sharing';
import { isProjectReadOnly } from '../projects/projectReadOnly';

/** Max people of a personal project, owner included (Todoist Pro; mirrors the server's PROJECT_MEMBERS limit). */
export const MAX_PROJECT_MEMBERS = 5;

type ProjectLike = Pick<Project, 'isInbox' | 'archivedAt'> & ProjectSharingFields;

/** What the UI may offer on a project, derived from the M8a fields of ProjectResponse (plan M8a F1). */
export interface ProjectSharing {
  /** Project of a team workspace (access TEAM | RESTRICTED); a personal project has no access. */
  isTeamProject: boolean;
  joined: boolean;
  canManage: boolean;
  memberCount: number;
  /** Team project the caller can read but has not joined: every write answers 403 until Join. */
  preview: boolean;
  /** Share screen: Copy link / invite. Never for the Inbox, an archived project or a preview. */
  canShare: boolean;
  /** Leave project: not the owner of a personal project, and only once joined. */
  canLeave: boolean;
  /** Join: Admin / Member previewing a TEAM project. */
  canJoin: boolean;
}

/** Fields the server does not send yet (cached responses, old fixtures) read as "personal project, mine". */
export function sharingOf(project: ProjectLike): ProjectSharing {
  const isTeamProject = project.access !== undefined && project.access !== null;
  const joined = project.joined ?? true;
  const canManage = project.canManage ?? true;
  const preview = isTeamProject && !joined;
  const archived = isProjectReadOnly(project);
  return {
    isTeamProject,
    joined,
    canManage,
    memberCount: project.memberCount ?? 1,
    preview,
    canShare: !project.isInbox && !archived && !preview,
    canLeave: !project.isInbox && joined && (isTeamProject || !canManage),
    canJoin: !project.isInbox && !archived && preview,
  };
}

/** A personal project can move into a team only as a root project without sub-projects, by its owner. */
export function canMoveToTeam(project: ProjectLike, hasChildren: boolean): boolean {
  const sharing = sharingOf(project);
  return !project.isInbox && !isProjectReadOnly(project) && !sharing.isTeamProject && sharing.canManage && !hasChildren;
}

/** Team <-> Restricted from the project menu: only whoever manages a joined, live team project. */
export function canChangeAccess(project: ProjectLike): boolean {
  const sharing = sharingOf(project);
  return sharing.isTeamProject && sharing.canManage && sharing.joined && !project.isInbox && !isProjectReadOnly(project);
}

/** The access the menu switches a team project to. */
export function otherAccess(access: ProjectAccess | null | undefined): ProjectAccess {
  return access === 'RESTRICTED' ? 'TEAM' : 'RESTRICTED';
}

/** Seats of a personal project still free for people + pending email invitations (UI hint; the server decides). */
export function seatsLeft(memberCount: number, pendingInvitations: number): number {
  return Math.max(0, MAX_PROJECT_MEMBERS - memberCount - pendingInvitations);
}

const TOKEN_FROM_LINK = /taskly:\/\/join\/([A-Za-z0-9_-]+)/;

/** Invite token from what the user pasted: the whole taskly://join/<token> link or just the code. Empty → null. */
export function parseInviteToken(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const fromLink = TOKEN_FROM_LINK.exec(text);
  const token = fromLink ? fromLink[1] : text;
  return /^[A-Za-z0-9_-]{8,128}$/.test(token) ? token : null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidInviteEmail(email: string): boolean {
  const text = email.trim();
  return text.length > 0 && text.length <= 254 && EMAIL_PATTERN.test(text);
}
