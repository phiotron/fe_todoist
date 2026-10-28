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
 * Reads the projects / workspaces lists through the shared query keys. Every row uses the same two keys, so React
 * Query sends at most one request per list (deduplicated, then served from cache for ORIGIN_STALE_MS); a cold start
 * no longer shows team tasks without their team name until another screen happens to load the lists.
 */
const ORIGIN_STALE_MS = 5 * 60 * 1000;

export function useProjectOrigin(projectId: string): ProjectOrigin {
  const project = useQuery({
    queryKey: queryKeys.projects.list(false),
    queryFn: () => projectsApi.list(false),
    staleTime: ORIGIN_STALE_MS,
    select: (list: Project[]) => list.find((item) => item.id === projectId) as ProjectLike | undefined,
  });
  const workspaces = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspacesApi.list(),
    staleTime: ORIGIN_STALE_MS,
  });
  return projectOrigin(project.data, workspaces.data);
}
