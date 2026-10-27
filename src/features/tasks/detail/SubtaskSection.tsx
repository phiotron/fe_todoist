import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../../api/describeError';
import type { Task } from '../../../api/models';
import { AddRow } from '../../../components/AddRow';
import { ErrorText } from '../../../components/ErrorText';
import { ReorderModal } from '../../../components/ReorderModal';
import { SectionHeader } from '../../../components/SectionHeader';
import { palette, type } from '../../../theme';
import { openQuickAdd } from '../../quickAdd/quickAddTarget';
import { childrenOf, progressLabel } from '../../subtasks/tree';
import { Checkbox } from '../Checkbox';
import { useReorderTask, useToggleTask } from '../useTaskActions';
import { useSubtasks } from './useSubtasks';

interface SubtaskSectionProps {
  task: Task;
  /** Level of `task` (undefined while unknown): 4 hides the add row (spec 5.4). */
  depth: number | undefined;
  /** Menu ⋯ → hide the completed subtasks. */
  hideCompleted: boolean;
  /** Menu ⋯ → "Sắp xếp sub-task" (controlled by the screen). */
  reorderOpen?: boolean;
  onReorderClose?: () => void;
  /** Completed or archived parent: no add row, circles locked (spec 12.3 table rows 4–6). */
  readOnly?: boolean;
}

/** M-TaskDetail "Sub-task 1/3": direct children with their circles, "Thêm sub-task", and the sort dialog. */
export function SubtaskSection({ task, depth, hideCompleted, reorderOpen = false, onReorderClose, readOnly = false }: SubtaskSectionProps) {
  const { t } = useTranslation();
  const subtasks = useSubtasks(task.id);
  const { toggle, pendingId, errorMessage } = useToggleTask();
  const reorder = useReorderTask();
  const direct = useMemo(() => childrenOf(subtasks.data ?? [], task.id), [subtasks.data, task.id]);
  const visible = hideCompleted ? direct.filter((child) => child.completedAt === null) : direct;
  const openChildren = direct.filter((child) => child.completedAt === null);
  const progress = progressLabel(task);

  return (
    <View testID="subtasks">
      <SectionHeader title={t('taskDetail.subtasks.title')} count={progress ?? undefined} testID="subtasks-header" />
      {subtasks.isPending ? <ActivityIndicator testID="subtasks-loading" color={palette.acc} style={styles.loading} /> : null}
      {subtasks.isError ? <ErrorText message={describeError(subtasks.error).message} testID="subtasks-error" /> : null}
      <ErrorText message={errorMessage} testID="subtasks-toggle-error" />
      {visible.map((child) => {
        const completed = child.completedAt !== null;
        return (
          <View key={child.id} style={styles.row}>
            <Checkbox
              testID={`subtask-toggle-${child.id}`}
              priority={child.priority}
              checked={completed}
              disabled={readOnly || pendingId === child.id}
              label={completed ? t('taskDetail.subtasks.reopen', { name: child.content }) : t('taskDetail.subtasks.complete', { name: child.content })}
              onPress={() => toggle(child)}
            />
            <Pressable
              testID={`subtask-row-${child.id}`}
              accessibilityRole="button"
              onPress={() => router.push(`/task/${child.id}`)}
              style={styles.title}
            >
              <Text style={[type.subtaskTitle, completed ? styles.done : styles.open]} numberOfLines={2}>
                {child.content}
              </Text>
            </Pressable>
          </View>
        );
      })}
      {readOnly ? null : depth === 4 ? (
        <Text testID="subtasks-max-depth" style={styles.maxDepth}>
          {t('taskDetail.subtasks.maxDepth')}
        </Text>
      ) : (
        <AddRow
          label={t('taskDetail.subtasks.add')}
          requiresOnline
          onPress={() =>
            openQuickAdd({
              parentId: task.id,
              projectId: task.projectId,
              ...(task.sectionId ? { sectionId: task.sectionId } : {}),
            })
          }
          testID="subtask-add"
        />
      )}
      <ReorderModal
        visible={reorderOpen && !readOnly}
        title={t('taskDetail.subtasks.reorderTitle')}
        items={openChildren.map((child) => ({ id: child.id, label: child.content }))}
        onMove={(id, afterId) => reorder.mutate({ id, afterId })}
        onClose={() => onReorderClose?.()}
        error={reorder.error ? describeError(reorder.error).message : undefined}
        testID="subtask-reorder"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.line },
  title: { flex: 1, minHeight: 44, justifyContent: 'center', marginTop: -10 },
  open: { color: palette.ink },
  done: { color: palette.mute, textDecorationLine: 'line-through' },
  maxDepth: { ...type.meta, color: palette.mute, paddingVertical: 12 },
});
