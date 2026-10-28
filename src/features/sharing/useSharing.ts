import { skipToken, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { sharingApi, type MoveToWorkspaceRequest } from '../../api/sharing';
import { useDataMutation } from '../../lib/useDataMutation';

/** "In this project": owner first, then the collaborators. */
export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sharing.members(projectId ?? ''),
    queryFn: projectId ? () => sharingApi.members(projectId) : skipToken,
  });
}

/** Pending email invitations of one project (only people who may invite can read them). */
export function useProjectInvitations(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sharing.invitations(projectId ?? ''),
    queryFn: projectId && enabled ? () => sharingApi.invitations(projectId) : skipToken,
  });
}

export function useProjectInviteLink(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sharing.inviteLink(projectId ?? ''),
    queryFn: projectId && enabled ? () => sharingApi.inviteLink(projectId) : skipToken,
  });
}

/** Invitations addressed to my email that are still open. */
export function useMyInvitations() {
  return useQuery({ queryKey: queryKeys.sharing.mine(), queryFn: () => sharingApi.mine() });
}

export const useInviteToProject = () =>
  useDataMutation(({ projectId, email }: { projectId: string; email: string }) => sharingApi.invite(projectId, email));

export const useRevokeInvitation = () => useDataMutation((invitationId: string) => sharingApi.revoke(invitationId));

export const useResetProjectInviteLink = () =>
  useDataMutation((projectId: string) => sharingApi.resetInviteLink(projectId));

export const useDisableProjectInviteLink = () =>
  useDataMutation((projectId: string) => sharingApi.disableInviteLink(projectId));

export const useRemoveProjectMember = () =>
  useDataMutation(({ projectId, userId }: { projectId: string; userId: string }) =>
    sharingApi.removeMember(projectId, userId),
  );

export const useLeaveProject = () => useDataMutation((projectId: string) => sharingApi.leave(projectId));

export const useJoinProject = () => useDataMutation((projectId: string) => sharingApi.join(projectId));

export const useMoveToWorkspace = () =>
  useDataMutation(({ projectId, body }: { projectId: string; body: MoveToWorkspaceRequest }) =>
    sharingApi.moveToWorkspace(projectId, body),
  );

export const useAcceptInvitationToken = () => useDataMutation((token: string) => sharingApi.acceptToken(token));
export const useAcceptInvitation = () => useDataMutation((invitationId: string) => sharingApi.accept(invitationId));
export const useDeclineInvitation = () => useDataMutation((invitationId: string) => sharingApi.decline(invitationId));
