import { skipToken, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '../../api/queryKeys';
import type { WorkspaceInviteRequest, WorkspaceResponse } from '../../api/workspaces';
import { workspacesApi } from '../../api/workspaces';
import type { WorkspaceRole } from '../../api/sharing';
import { useSession } from '../auth/session';
import { useDataMutation } from '../../lib/useDataMutation';

/** Every workspace of the caller; the personal one is skipped by `teams`. */
export function useWorkspaces() {
  const { status } = useSession();
  const query = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspacesApi.list(),
    enabled: status === 'signedIn',
  });
  const teams = useMemo<WorkspaceResponse[]>(() => (query.data ?? []).filter((w) => w.type === 'TEAM'), [query.data]);
  return { query, all: query.data ?? [], teams };
}

/** true once a team workspace exists: the bar then shows the Team tab (spec 3.2 M8a). */
export function useHasTeam(): boolean {
  return useWorkspaces().teams.length > 0;
}

export function useWorkspaceMembers(workspaceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId ?? ''),
    queryFn: workspaceId && enabled ? () => workspacesApi.members(workspaceId) : skipToken,
  });
}

export function useWorkspaceInvitations(workspaceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaces.invitations(workspaceId ?? ''),
    queryFn: workspaceId && enabled ? () => workspacesApi.invitations(workspaceId) : skipToken,
  });
}

export function useWorkspaceInviteLink(workspaceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaces.inviteLink(workspaceId ?? ''),
    queryFn: workspaceId && enabled ? () => workspacesApi.inviteLink(workspaceId) : skipToken,
  });
}

/** Team Discovery rows (Active = all of them, Joined / not joined = split on `joined`). */
export function useTeamProjects(workspaceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaces.projects(workspaceId ?? ''),
    queryFn: workspaceId && enabled ? () => workspacesApi.projects(workspaceId) : skipToken,
  });
}

export function useTeamFolders(workspaceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaces.folders(workspaceId ?? ''),
    queryFn: workspaceId && enabled ? () => workspacesApi.folders(workspaceId) : skipToken,
  });
}

export const useCreateWorkspace = () => useDataMutation((name: string) => workspacesApi.create(name));

export const useRenameWorkspace = () =>
  useDataMutation(({ workspaceId, name }: { workspaceId: string; name: string }) =>
    workspacesApi.rename(workspaceId, name),
  );

export const useDeleteWorkspace = () => useDataMutation((workspaceId: string) => workspacesApi.remove(workspaceId));
export const useLeaveWorkspace = () => useDataMutation((workspaceId: string) => workspacesApi.leave(workspaceId));

export const useChangeMemberRole = () =>
  useDataMutation(({ workspaceId, userId, role }: { workspaceId: string; userId: string; role: WorkspaceRole }) =>
    workspacesApi.changeRole(workspaceId, userId, role),
  );

export const useRemoveWorkspaceMember = () =>
  useDataMutation(({ workspaceId, userId }: { workspaceId: string; userId: string }) =>
    workspacesApi.removeMember(workspaceId, userId),
  );

export const useInviteToWorkspace = () =>
  useDataMutation(({ workspaceId, body }: { workspaceId: string; body: WorkspaceInviteRequest }) =>
    workspacesApi.invite(workspaceId, body),
  );

export const useResetWorkspaceInviteLink = () =>
  useDataMutation((workspaceId: string) => workspacesApi.resetInviteLink(workspaceId));

export const useDisableWorkspaceInviteLink = () =>
  useDataMutation((workspaceId: string) => workspacesApi.disableInviteLink(workspaceId));

export const useCreateFolder = () =>
  useDataMutation(({ workspaceId, name }: { workspaceId: string; name: string }) =>
    workspacesApi.createFolder(workspaceId, name),
  );

export const useRenameFolder = () =>
  useDataMutation(({ folderId, name }: { folderId: string; name: string }) => workspacesApi.renameFolder(folderId, name));

export const useDeleteFolder = () => useDataMutation((folderId: string) => workspacesApi.deleteFolder(folderId));
