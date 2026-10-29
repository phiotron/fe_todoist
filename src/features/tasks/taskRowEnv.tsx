import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { meQueryKey } from '../auth/session';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from '../../components/Snackbar';
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
  /** REVIEW: the signed-in user's id (read from the cache, no request): whose pending request a row shows. */
  meId: string | null;
  /** Same function the Inbox-name label uses (follows the app language). */
  nameLabel: (projectId: string | null | undefined, projectName: string | null | undefined) => string;
  capabilitiesOf: (projectId: string | undefined) => ProjectCapabilities;
  originOf: (projectId: string) => ProjectOrigin;
  /** PERM: a Member / Guest pressed the circle of a completed team task (locked): tell them why. One handler per list. */
  explainLockedDone: () => void;
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
  const meId = useQuery({ queryKey: meQueryKey, queryFn: authApi.me, enabled: false }).data?.id ?? null;
  const online = useIsOnline();
  const nameLabel = useProjectNameLabel();
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const explainLockedDone = useCallback(() => snackbar.show({ message: t('review.lockedDoneToast') }), [snackbar, t]);
  const value = useMemo(
    () => createEnv(projects, workspaces, online, nameLabel, meId, explainLockedDone),
    [projects, workspaces, online, nameLabel, meId, explainLockedDone],
  );
  return <TaskRowEnvContext.Provider value={value}>{children}</TaskRowEnvContext.Provider>;
}

function createEnv(
  projects: readonly Project[] | undefined,
  workspaces: readonly WorkspaceResponse[] | undefined,
  online: boolean,
  nameLabel: TaskRowEnv['nameLabel'],
  meId: string | null,
  explainLockedDone: () => void,
): TaskRowEnv {
  const byId = new Map<string, Project>();
  for (const project of projects ?? []) byId.set(project.id, project);
  return {
    online,
    meId,
    nameLabel,
    explainLockedDone,
    capabilitiesOf: (projectId) => capabilitiesOf(projectId ? byId.get(projectId) : undefined),
    originOf: (projectId) => projectOrigin(byId.get(projectId), workspaces),
  };
}

/** null outside a TaskRowEnvProvider. */
export function useTaskRowEnv(): TaskRowEnv | null {
  return useContext(TaskRowEnvContext);
}
