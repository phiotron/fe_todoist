import type { ProjectCapabilities, ProjectCapabilityFields } from '../../api/projects';

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
