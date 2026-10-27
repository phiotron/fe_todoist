import { useCallback, useState, type ReactNode } from 'react';
import { DeleteTaskDialog, type DeletableTask } from './DeleteTaskDialog';

/** Swipe action "Delete": `requestDelete(task)` opens the confirmation; render `dialog` next to what calls it (TaskRow does, one per row — it renders nothing while closed). */
export function useDeleteTaskSwipe(): { requestDelete: (task: DeletableTask) => void; dialog: ReactNode } {
  const [task, setTask] = useState<DeletableTask | null>(null);
  const requestDelete = useCallback((next: DeletableTask) => setTask(next), []);
  const dialog = <DeleteTaskDialog task={task} onClose={() => setTask(null)} />;
  return { requestDelete, dialog };
}
