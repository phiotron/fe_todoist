import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../../../api/describeError';
import type { Task } from '../../../api/models';
import { ProjectSectionPicker } from '../../projects/ProjectSectionPicker';
import { useMoveTask } from '../useTaskActions';

/**
 * "Chuyển tới": a project (Inbox first) and a section; the whole subtree follows (spec 5.4 / 10.1). No section =
 * `sectionId` left out. The caller renders `picker` and calls `start()` from the breadcrumb and the chip.
 */
export function useTaskMove(task: Pick<Task, 'id' | 'projectId' | 'sectionId'> | undefined): {
  start: () => void;
  picker: ReactNode;
  errorMessage: string | undefined;
} {
  const { t } = useTranslation();
  const move = useMoveTask();
  const [open, setOpen] = useState(false);
  const picker = task ? (
    <ProjectSectionPicker
      visible={open}
      title={t('taskDetail.move.title')}
      value={{ projectId: task.projectId, sectionId: task.sectionId }}
      onSelect={({ projectId, sectionId }) => {
        move.reset();
        move.mutate({ taskId: task.id, body: { projectId, ...(sectionId ? { sectionId } : {}) } });
      }}
      onClose={() => setOpen(false)}
      testID="task-move-picker"
    />
  ) : null;
  return { start: () => setOpen(true), picker, errorMessage: move.error ? describeError(move.error).message : undefined };
}
