import type { Project, Section, Task } from '../../../api/models';
import { isProjectReadOnly } from '../../projects/projectReadOnly';
import { useProject } from '../../projects/useProjects';
import { useSections } from '../../sections/useSections';

export interface TaskAccess {
  /** The task is completed: fields are not edited (reopen it first). */
  completed: boolean;
  /** Its project or its section is archived: every write answers 409 `project-archived` / `section-archived`. */
  archived: boolean;
  /** completed || archived — the flag the detail screen and M4's reminder chip use to lock their controls. */
  readOnly: boolean;
}

type TaskPlace = Pick<Task, 'completedAt' | 'projectId' | 'sectionId'>;

/** Pure rule (spec 5.7 / 12.10). `project` / `section` are `undefined` while unknown: then only `completedAt` counts. */
export function taskAccess(
  task: Pick<Task, 'completedAt'>,
  project: Pick<Project, 'archivedAt'> | undefined,
  section: Pick<Section, 'archivedAt'> | undefined,
): TaskAccess {
  const completed = task.completedAt !== null;
  const archived = isProjectReadOnly(project) || (section !== undefined && section.archivedAt !== null);
  return { completed, archived, readOnly: completed || archived };
}

export function isTaskReadOnly(
  task: Pick<Task, 'completedAt'>,
  project: Pick<Project, 'archivedAt'> | undefined,
  section: Pick<Section, 'archivedAt'> | undefined,
): boolean {
  return taskAccess(task, project, section).readOnly;
}

/**
 * Access of a task from its project (`GET projects/{id}`, found by id so an ARCHIVED project is seen too) and its section
 * (the sections list holds the archived ones). Unknown / failed lookups count as not archived: the server still
 * refuses the write with 409 and `describeError` explains it.
 */
export function useTaskAccess(task: TaskPlace | undefined): TaskAccess {
  const project = useProject(task?.projectId).data;
  const { sections, archived } = useSections(task?.sectionId ? task.projectId : undefined);
  const section = task?.sectionId ? [...sections, ...archived].find((candidate) => candidate.id === task.sectionId) : undefined;
  return task ? taskAccess(task, project, section) : { completed: false, archived: false, readOnly: false };
}

/** `readOnly` of a task for any screen that edits it (task detail, M4 reminders): completed or in an archived project / section. */
export function useTaskReadOnly(task: TaskPlace | undefined): boolean {
  return useTaskAccess(task).readOnly;
}
