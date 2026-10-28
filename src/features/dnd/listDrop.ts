/**
 * DND in task LISTS (Inbox / project / Today / Upcoming): the pure rules of a drop. A screen describes its visible tasks
 * as entries (in screen order) and gets back where the dragged task goes: a container (section, day…) and the sibling it
 * goes right after (null = first). Roots only move among roots, sub-tasks only among the sub-tasks of their parent (their
 * own sub-tasks follow them on the server); a drop that changes nothing answers null.
 */

export interface ListEntry {
  id: string;
  /** null = a root of the list (flat views give null to every task). */
  parentId: string | null;
  /** Section id / 'none' (project), 'overdue' / 'today' (Today), 'd-<day>' (Upcoming). */
  container: string;
}

export type ListDropTarget =
  /** Dropped on a task row: `after` = on its lower half. */
  | { kind: 'task'; taskId: string; after: boolean }
  /** Dropped on a block header (start) or on its "Add task" row / a week-strip day (end). */
  | { kind: 'container'; container: string; edge: 'start' | 'end' };

export interface Placement {
  container: string;
  afterId: string | null;
}

/** Lower half of a row = drop after it. */
export function rowHalf(y: number, height: number): boolean {
  return y > height / 2;
}

export function placeDrop(entries: readonly ListEntry[], draggedId: string, target: ListDropTarget): Placement | null {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const dragged = byId.get(draggedId);
  if (!dragged) return null;
  const level = dragged.parentId;
  const siblingsIn = (container: string) =>
    entries.filter((entry) => entry.container === container && entry.parentId === level && entry.id !== draggedId);

  let placement: Placement;
  if (target.kind === 'container') {
    if (level !== null) return null; // a sub-task never leaves its parent
    const siblings = siblingsIn(target.container);
    placement = {
      container: target.container,
      afterId: target.edge === 'start' ? null : (siblings[siblings.length - 1]?.id ?? null),
    };
  } else {
    const hit = byId.get(target.taskId);
    if (!hit || hit.id === draggedId || isInside(byId, hit, draggedId)) return null;
    if (level !== null && hit.id === level) {
      // the parent itself: its lower half = first of its sub-tasks
      if (!target.after) return null;
      placement = { container: dragged.container, afterId: null };
    } else {
      // the sibling-level ancestor of the row hit; any deeper row counts as "after" that ancestor
      const anchor = ancestorAt(byId, hit, level);
      if (!anchor) return null;
      const after = anchor === hit ? target.after : true;
      if (after) {
        placement = { container: anchor.container, afterId: anchor.id };
      } else {
        const siblings = siblingsIn(anchor.container);
        const index = siblings.findIndex((entry) => entry.id === anchor.id);
        placement = { container: anchor.container, afterId: index > 0 ? siblings[index - 1].id : null };
      }
    }
  }

  // Unchanged position → nothing to send.
  if (placement.container === dragged.container) {
    const current = entries.filter((entry) => entry.container === dragged.container && entry.parentId === level);
    const index = current.findIndex((entry) => entry.id === draggedId);
    const previous = index > 0 ? current[index - 1].id : null;
    if (previous === placement.afterId) return null;
  }
  return placement;
}

/** true when `entry` is `ancestorId` or lies under it. */
function isInside(byId: ReadonlyMap<string, ListEntry>, entry: ListEntry, ancestorId: string): boolean {
  let current: ListEntry | undefined = entry;
  while (current) {
    if (current.id === ancestorId) return true;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

/** `entry` or its ancestor whose parent is `level`; undefined when the chain never reaches that level. */
function ancestorAt(byId: ReadonlyMap<string, ListEntry>, entry: ListEntry, level: string | null): ListEntry | undefined {
  let current: ListEntry | undefined = entry;
  while (current && current.parentId !== level) {
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return current;
}

export type MoveAnchor = { afterId: string } | { beforeId: string } | Record<string, never>;

/**
 * The list with `id` moved right after / before an anchor (no anchor or anchor missing = last), `patch` merged into it.
 * Screens show this until the next server answer, so a drop does not jump back meanwhile (also while queued offline).
 */
export function moveInList<T extends { id: string }>(
  list: readonly T[],
  id: string,
  anchor: MoveAnchor,
  patch?: Partial<T>,
  /** The task when it comes from another list (Upcoming: Overdue → a day); absent and not in the list = unchanged. */
  incoming?: T,
): readonly T[] {
  const index = list.findIndex((item) => item.id === id);
  const source = index >= 0 ? list[index] : incoming;
  if (!source) return list;
  const moved = patch ? { ...source, ...patch } : source;
  const rest = list.filter((item) => item.id !== id);
  let at = rest.length;
  if ('afterId' in anchor) {
    const found = rest.findIndex((item) => item.id === anchor.afterId);
    if (found >= 0) at = found + 1;
  } else if ('beforeId' in anchor) {
    const found = rest.findIndex((item) => item.id === anchor.beforeId);
    if (found >= 0) at = found;
  }
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}
