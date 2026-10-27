import type { Project } from '../../api/models';

/** Spec 2.1 / 5.7: sub-projects go at most 3 levels deep (root = 1). */
export const MAX_PROJECT_DEPTH = 3;

export interface ProjectRow {
  project: Project;
  /** 1 = root. */
  depth: number;
  hasChildren: boolean;
}

function childrenMap(projects: readonly Project[]): Map<string | null, Project[]> {
  const ids = new Set(projects.map((project) => project.id));
  const map = new Map<string | null, Project[]>();
  for (const project of projects) {
    if (project.isInbox) continue;
    // A child whose parent is not in the list (archived parent, filtered list) is shown as a root.
    const key = project.parentId && ids.has(project.parentId) ? project.parentId : null;
    const list = map.get(key) ?? [];
    list.push(project);
    map.set(key, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
  return map;
}

/** Depth-first rows without the Inbox; children of `collapsed` projects are left out. */
export function projectTreeRows(projects: readonly Project[], collapsed: ReadonlySet<string> = new Set()): ProjectRow[] {
  const map = childrenMap(projects);
  const rows: ProjectRow[] = [];
  const seen = new Set<string>();
  const visit = (project: Project, depth: number) => {
    if (seen.has(project.id)) return;
    seen.add(project.id);
    const children = map.get(project.id) ?? [];
    rows.push({ project, depth, hasChildren: children.length > 0 });
    if (collapsed.has(project.id)) return;
    for (const child of children) visit(child, depth + 1);
  };
  for (const root of map.get(null) ?? []) visit(root, 1);
  return rows;
}

export function descendantIds(projects: readonly Project[], id: string): string[] {
  const map = childrenMap(projects);
  const result: string[] = [];
  const stack = [...(map.get(id) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop() as Project;
    if (result.includes(next.id)) continue;
    result.push(next.id);
    stack.push(...(map.get(next.id) ?? []));
  }
  return result;
}

/**
 * Delete-project confirmation (spec 9.2 / 10.1 / 12.2): the numbers are the server's. `descendantProjectCount` counts every
 * descendant (archived ones too), `descendantActiveTaskCount` counts open tasks of the descendants only, so the dialog
 * shows `activeTaskCount + descendantActiveTaskCount`. Never re-summed from a project list: that list may miss children.
 */
export function deleteImpact(
  project: Pick<Project, 'activeTaskCount' | 'descendantProjectCount' | 'descendantActiveTaskCount'>,
): { subprojects: number; openTasks: number } {
  return {
    subprojects: project.descendantProjectCount,
    openTasks: project.activeTaskCount + project.descendantActiveTaskCount,
  };
}

/** 1 for a root; follows parents present in the list. */
export function projectDepth(projects: readonly Project[], id: string): number {
  const byId = new Map(projects.map((project) => [project.id, project]));
  let depth = 1;
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current?.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = byId.get(current.parentId);
  }
  return depth;
}

/** Levels of the subtree rooted at `id` (1 = no children). */
function subtreeHeight(projects: readonly Project[], id: string): number {
  const map = childrenMap(projects);
  const height = (projectId: string, guard: number): number =>
    guard > MAX_PROJECT_DEPTH + 1
      ? guard
      : 1 + Math.max(0, ...(map.get(projectId) ?? []).map((child) => height(child.id, guard + 1)));
  return height(id, 1);
}

/**
 * Possible parents in tree order: not the Inbox, not the project itself or its descendants, and deep enough room for
 * the moved subtree (depth(parent) + height(subtree) ≤ 3). The server checks the same rule (400).
 */
export function parentChoices(projects: readonly Project[], editingId?: string): Project[] {
  const excluded = new Set(editingId ? [editingId, ...descendantIds(projects, editingId)] : []);
  const height = editingId ? subtreeHeight(projects, editingId) : 1;
  return projectTreeRows(projects)
    .filter((row) => !excluded.has(row.project.id) && row.depth + height <= MAX_PROJECT_DEPTH)
    .map((row) => row.project);
}
