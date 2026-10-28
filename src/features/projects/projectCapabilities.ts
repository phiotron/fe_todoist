import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { projectsApi, type ProjectCapabilities, type ProjectCapabilityFields } from '../../api/projects';
import { queryKeys } from '../../api/queryKeys';

/**
 * PERM — one rule for every screen (and for the other branches, e.g. drag & drop): in a TEAM project only Admins edit;
 * a joined Member / Guest may only complete / reopen tasks. Read from ProjectResponse.capabilities; a project without the
 * field (old cache, personal fixtures) or unknown (`undefined`) allows everything — the server still answers 403
 * `team-admin-only` and describeError explains it.
 */
const ALL: ProjectCapabilities = { canEditTasks: true, canCompleteTasks: true, canManageSections: true, canComment: true };

type Capable = ProjectCapabilityFields | object | undefined | null;

export function capabilitiesOf(project: Capable): ProjectCapabilities {
  const capabilities = project ? (project as ProjectCapabilityFields).capabilities : undefined;
  return capabilities ?? ALL;
}

/** Create / edit / delete / move / duplicate / reorder tasks, dates, priority, labels, reminders. */
export function canEditTasks(project: Capable): boolean {
  return capabilitiesOf(project).canEditTasks;
}

export function canCompleteTasks(project: Capable): boolean {
  return capabilitiesOf(project).canCompleteTasks;
}

export function canManageSections(project: Capable): boolean {
  return capabilitiesOf(project).canManageSections;
}

export function canComment(project: Capable): boolean {
  return capabilitiesOf(project).canComment;
}

/** A joined Member / Guest of a team project: may tick, nothing else (shows the "only admins edit" notice). */
export function isCompleteOnly(project: Capable): boolean {
  const capabilities = capabilitiesOf(project);
  return capabilities.canCompleteTasks && !capabilities.canEditTasks;
}

/**
 * Capabilities of a task's project for list rows (Today / Upcoming / project lists): read PASSIVELY from the cached
 * active-projects list (no request of its own — Browse, the drawer, Quick Add and the project screen load it). Not
 * cached yet → everything allowed; the server still refuses with 403 team-admin-only.
 */
export function useProjectCapabilities(projectId: string | undefined): ProjectCapabilities {
  const data = useCachedActiveProjects();
  return capabilitiesOf(projectId ? data?.find((project) => project.id === projectId) : undefined);
}

/**
 * Same passive read, for list-level logic over many tasks (drag & drop of Today / Upcoming): `canEdit(projectId)` is
 * false for a task of a team project where I am a Member / Guest — it may not be moved or rescheduled by a drop.
 */
export function useCanEditTasksOf(): (projectId: string | undefined) => boolean {
  const data = useCachedActiveProjects();
  return useCallback(
    (projectId: string | undefined) => canEditTasks(projectId ? data?.find((project) => project.id === projectId) : undefined),
    [data],
  );
}

function useCachedActiveProjects() {
  const { data } = useQuery({
    queryKey: queryKeys.projects.list(false),
    queryFn: () => projectsApi.list(false),
    enabled: false,
  });
  return data;
}
