import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError, isNotFound } from '../../api/describeError';
import { invalidateData } from '../../api/queryKeys';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useDeleteTask } from './useTaskActions';

export interface DeletableTask {
  id: string;
  content: string;
  /** Direct sub-tasks: they are deleted with the task. */
  subtaskCount: number;
}

interface DeleteTaskDialogProps {
  /** null = closed. */
  task: DeletableTask | null;
  onClose: () => void;
}

/** Confirmation of the swipe action "Delete" (BR-11): permanent, no Undo; a 404 means it is already gone. */
export function DeleteTaskDialog({ task, onClose }: DeleteTaskDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const remove = useDeleteTask(); // M1: refuses while offline, refreshes the task lists afterwards
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);

  if (!task) return null;
  const target = task;

  async function onConfirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await remove.mutateAsync(target.id);
    } catch (caught) {
      // 404 = already deleted elsewhere (goal reached). Anything else — 409 project-archived / section-archived when the
      // project was archived meanwhile, offline, 5xx — stays in the dialog, which stays open.
      if (!isNotFound(caught)) {
        setError(describeError(caught).message);
        setBusy(false);
        inFlight.current = false;
        return;
      }
    }
    await invalidateData(queryClient);
    setBusy(false);
    inFlight.current = false;
    onClose();
  }

  return (
    <ConfirmDialog
      testID="swipe-delete-dialog"
      visible
      title={t('settings.swipeDelete.title')}
      message={
        target.subtaskCount > 0
          ? t('settings.swipeDelete.messageWithSubtasks', { name: target.content, count: target.subtaskCount })
          : t('settings.swipeDelete.message', { name: target.content })
      }
      confirmLabel={t('settings.swipeDelete.confirm')}
      busy={busy}
      error={error}
      onConfirm={() => void onConfirm()}
      onCancel={onClose}
    />
  );
}
