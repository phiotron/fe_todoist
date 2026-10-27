import type { Project } from '../../api/models';

/**
 * Spec 5.7 / 12.10: an archived project is read-only — every write into it (create / edit / complete / move / delete a
 * task, section actions) answers 409 `project-archived`, so the UI hides or disables them. One rule shared by the project
 * screen (Task 25), the task detail (`taskReadOnly.ts`, Task 26) and M4 (reminders).
 */
export function isProjectReadOnly(project: Pick<Project, 'archivedAt'> | undefined): boolean {
  return project !== undefined && project.archivedAt !== null;
}
