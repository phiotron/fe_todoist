/** Subtask tree helpers (spec 5.4), pure. Depth 1 = root task. */

export const MAX_DEPTH = 4;

export interface TreeNode {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

export interface TreeRow<T> {
  task: T;
  depth: number;
}

const bySortOrder = (a: TreeNode, b: TreeNode) => a.sortOrder - b.sortOrder;

/**
 * Depth-first rows: roots keep the input order (views have their own order), children follow their parent by
 * sortOrder. A task whose parent is not in the list is shown as a root.
 */
export function flattenTree<T extends TreeNode>(tasks: readonly T[]): TreeRow<T>[] {
  const ids = new Set(tasks.map((task) => task.id));
  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const task of tasks) {
    if (task.parentId && task.parentId !== task.id && ids.has(task.parentId)) {
      const list = children.get(task.parentId) ?? [];
      list.push(task);
      children.set(task.parentId, list);
    } else {
      roots.push(task);
    }
  }
  for (const list of children.values()) list.sort(bySortOrder);

  const rows: TreeRow<T>[] = [];
  const seen = new Set<string>();
  const visit = (task: T, depth: number) => {
    if (seen.has(task.id)) return;
    seen.add(task.id);
    rows.push({ task, depth });
    for (const child of children.get(task.id) ?? []) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 1);
  // Corrupt cyclic data has no root: still show every task once.
  for (const task of tasks) visit(task, 1);
  return rows;
}

export function childrenOf<T extends TreeNode>(tasks: readonly T[], parentId: string): T[] {
  return tasks.filter((task) => task.parentId === parentId).sort(bySortOrder);
}

/** 1 for a root; follows parents that are present in `tasks`. */
export function depthOf(tasks: readonly TreeNode[], id: string): number {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  let depth = 1;
  let current = byId.get(id);
  while (current?.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = byId.get(current.parentId);
  }
  return depth;
}

export function canAddSubtask(tasks: readonly TreeNode[], id: string): boolean {
  return depthOf(tasks, id) < MAX_DEPTH;
}

/** "2/5" (completed / direct subtasks) or null when the task has no subtasks. */
export function progressLabel(task: { subtaskCount: number; completedSubtaskCount: number }): string | null {
  return task.subtaskCount > 0 ? `${task.completedSubtaskCount}/${task.subtaskCount}` : null;
}
