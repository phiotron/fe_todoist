import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Project } from '../../api/models';
import { projectsApi } from '../../api/projects';
import { queryKeys } from '../../api/queryKeys';
import { workspacesApi, type WorkspaceResponse } from '../../api/workspaces';
import { useIsOnline } from '../../lib/useIsOnline';
import { capabilitiesOf } from '../projects/projectCapabilities';
import { useProjectNameLabel } from '../projects/useProjectNameLabel';
import { projectOrigin, type ProjectOrigin } from './projectOrigin';
import type { ProjectCapabilities } from '../../api/projects';

/**
 * Everything a task row reads from shared data, looked up ONCE per list instead of once per row (perf: on a 300 task
 * list every row used to open its own query observers on the projects / workspaces lists, its own connection listener
 * and its own project-name lookup). Rows get it through context; a row outside a list wraps itself (TaskRow).
 */
export interface TaskRowEnv {
  online: boolean;
  /** Same function the Inbox-name label uses (follows the app language). */
  nameLabel: (projectId: string | null | undefined, projectName: string | null | undefined) => string;
  capabilitiesOf: (projectId: string | undefined) => ProjectCapabilities;
  originOf: (projectId: string) => ProjectOrigin;
}

const TaskRowEnvContext = createContext<TaskRowEnv | null>(null);

const ORIGIN_STALE_MS = 5 * 60 * 1000;

/**
 * `fetchLists`: the list shows the project (Today, Upcoming, Inbox › team…), so it loads the projects / workspaces lists
 * when they are missing (a cold start must not show team tasks without their team name). Without it the lists are only
 * read from the cache (capabilities: Browse, the drawer and Quick Add load them).
 */
export function TaskRowEnvProvider({ fetchLists, children }: { fetchLists: boolean; children: ReactNode }) {
  const projects = useQuery({
    queryKey: queryKeys.projects.list(false),
    queryFn: () => projectsApi.list(false),
    staleTime: ORIGIN_STALE_MS,
    enabled: fetchLists,
  }).data;
  const workspaces = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspacesApi.list(),
    staleTime: ORIGIN_STALE_MS,
    enabled: fetchLists,
  }).data;
  const online = useIsOnline();
  const nameLabel = useProjectNameLabel();
  const value = useMemo(() => createEnv(projects, workspaces, online, nameLabel), [projects, workspaces, online, nameLabel]);
  return <TaskRowEnvContext.Provider value={value}>{children}</TaskRowEnvContext.Provider>;
}

function createEnv(
  projects: readonly Project[] | undefined,
  workspaces: readonly WorkspaceResponse[] | undefined,
  online: boolean,
  nameLabel: TaskRowEnv['nameLabel'],
): TaskRowEnv {
  const byId = new Map<string, Project>();
  for (const project of projects ?? []) byId.set(project.id, project);
  return {
    online,
    nameLabel,
    capabilitiesOf: (projectId) => capabilitiesOf(projectId ? byId.get(projectId) : undefined),
    originOf: (projectId) => projectOrigin(byId.get(projectId), workspaces),
  };
}

/** null outside a TaskRowEnvProvider. */
export function useTaskRowEnv(): TaskRowEnv | null {
  return useContext(TaskRowEnvContext);
}
