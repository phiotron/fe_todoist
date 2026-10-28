import { useCallback, useRef, useState } from 'react';
import type { Task } from '../../api/models';
import { moveInList, type ListEntry, type MoveAnchor, type Placement } from './listDrop';

/** A drop shown before the server confirms it: where the task goes and what changed on it. */
export interface PendingDrop {
  task: Task;
  anchor: MoveAnchor;
  patch?: Partial<Task>;
}

/**
 * DND: keeps the dropped order on screen until the lists it was computed from change (refetch after the write, or the
 * offline queue's optimistic patch), so a drop does not jump back meanwhile. `bases` = the server lists of the screen;
 * `clear()` after a failed write.
 */
export function usePendingDrop(bases: readonly unknown[]) {
  const [state, setState] = useState<{ bases: readonly unknown[]; drop: PendingDrop } | null>(null);
  const basesRef = useRef(bases);
  basesRef.current = bases;
  const live =
    state && state.bases.length === bases.length && state.bases.every((base, index) => base === bases[index]) ? state.drop : null;
  const set = useCallback((drop: PendingDrop) => setState({ bases: basesRef.current, drop }), []);
  const clear = useCallback(() => setState(null), []);
  return { pending: live, set, clear };
}

/** `list` with the pending drop applied (the task inserted when it came from another list). */
export function withPendingDrop(list: readonly Task[], pending: PendingDrop | null): readonly Task[] {
  if (!pending) return list;
  return moveInList(list, pending.task.id, pending.anchor, pending.patch, pending.task);
}

/** `list` without the dragged task (the list it left, e.g. Upcoming's Overdue block). */
export function withoutPendingDrop(list: readonly Task[], pending: PendingDrop | null): readonly Task[] {
  return pending ? list.filter((task) => task.id !== pending.task.id) : list;
}

/** Where to insert locally: after `afterId`, else before the first sibling in the target block, else last. */
export function anchorOf(entries: readonly ListEntry[], draggedId: string, parentId: string | null, placement: Placement): MoveAnchor {
  if (placement.afterId) return { afterId: placement.afterId };
  const first = entries.find((entry) => entry.container === placement.container && entry.parentId === parentId && entry.id !== draggedId);
  return first ? { beforeId: first.id } : {};
}
