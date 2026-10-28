import { useQuery } from '@tanstack/react-query';
import type { Project } from '../../api/models';
import { projectsApi } from '../../api/projects';
import { queryKeys } from '../../api/queryKeys';
import type { ProjectSharingFields } from '../../api/sharing';
import { workspacesApi, type WorkspaceResponse } from '../../api/workspaces';

/**
 * Where a task's project comes from, for aggregated views (Today, Upcoming, Inbox › Team work): a team project shows
 * its team next to the project name, a shared personal project a "shared" mark (Todoist shows the project on the meta
 * line; the team name is ours, so personal and team work can be told apart — user request).
 */
export type ProjectOrigin =
  | { kind: 'personal' }
  | { kind: 'shared' }
  | { kind: 'team'; teamName: string | null; workspaceId: string };

type ProjectLike = Pick<Project, 'isInbox'> & ProjectSharingFields;

export function projectOrigin(
  project: ProjectLike | undefined,
  workspaces: readonly WorkspaceResponse[] | undefined,
): ProjectOrigin {
  if (!project || project.isInbox) return { kind: 'personal' };
  if (project.access !== undefined && project.access !== null && project.workspaceId) {
    const team = workspaces?.find((workspace) => workspace.id === project.workspaceId);
    return { kind: 'team', teamName: team?.name ?? null, workspaceId: project.workspaceId };
  }
  return (project.memberCount ?? 1) > 1 ? { kind: 'shared' } : { kind: 'personal' };
}

/**
 * Reads the projects / workspaces lists from the CACHE only (never fetches: the tab bar and the drawer keep them
 * loaded), so a long list does not start requests per row and nothing changes for screens without those lists.
 */
export function useProjectOrigin(projectId: string): ProjectOrigin {
  const project = useQuery({
    queryKey: queryKeys.projects.list(false),
    queryFn: () => projectsApi.list(false),
    enabled: false,
    select: (list: Project[]) => list.find((item) => item.id === projectId) as ProjectLike | undefined,
  });
  const workspaces = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspacesApi.list(),
    enabled: false,
  });
  return projectOrigin(project.data, workspaces.data);
}
