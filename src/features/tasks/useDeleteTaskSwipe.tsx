import { useCallback, useState, type ReactNode } from 'react';
import { DeleteTaskDialog, type DeletableTask } from './DeleteTaskDialog';

/**
 * Swipe action "Delete": `requestDelete(task)` opens the confirmation; render `dialog` next to what calls it.
 * The dialog (it owns a mutation observer) is only mounted while a delete is asked: every TaskRow calls this hook, and
 * a list of 300 rows must not hold 300 mutation observers.
 */
export function useDeleteTaskSwipe(): { requestDelete: (task: DeletableTask) => void; dialog: ReactNode } {
  const [task, setTask] = useState<DeletableTask | null>(null);
  const requestDelete = useCallback((next: DeletableTask) => setTask(next), []);
  const dialog = task ? <DeleteTaskDialog task={task} onClose={() => setTask(null)} /> : null;
  return { requestDelete, dialog };
}
