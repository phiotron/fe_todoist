import type { Section, Task } from '../../api/models';
import { flattenTree, type TreeRow } from '../subtasks/tree';

export interface ProjectGroup {
  /** null = tasks without a section (always first). */
  section: Section | null;
  /** Open tasks of the group, subtasks nested (completed subtasks hidden). */
  rows: TreeRow<Task>[];
  /** Root tasks in display order: the container used by "reorder tasks" (spec 12.4). */
  rootTasks: Task[];
}

/**
 * Project screen layout (spec 9.2): "no section" first, then the active sections by sortOrder. Completed tasks are
 * left out (they show under Display → Completed tasks); a task of an unknown section falls back to "no section".
 */
export function groupProjectTasks(tasks: readonly Task[], sections: readonly Section[]): ProjectGroup[] {
  const known = new Set(sections.map((section) => section.id));
  const buckets = new Map<string | null, Task[]>();
  for (const task of tasks) {
    if (task.completedAt !== null) continue;
    const key = task.sectionId && known.has(task.sectionId) ? task.sectionId : null;
    const list = buckets.get(key) ?? [];
    list.push(task);
    buckets.set(key, list);
  }
  const ordered = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  return [null, ...ordered].map((section) => {
    const list = buckets.get(section ? section.id : null) ?? [];
    const ids = new Set(list.map((task) => task.id));
    return {
      section,
      rows: flattenTree(list),
      rootTasks: list.filter((task) => !task.parentId || !ids.has(task.parentId)),
    };
  });
}
