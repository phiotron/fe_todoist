import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { describeError, isNotFound } from '../../../api/describeError';
import { invalidateData, queryKeys } from '../../../api/queryKeys';
import { ActionMenu, type ActionMenuItem } from '../../../components/ActionMenu';
import { AppButton } from '../../../components/AppButton';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorText } from '../../../components/ErrorText';
import { IconButton } from '../../../components/IconButton';
import { KeyboardScreen } from '../../../components/KeyboardScreen';
import { NotFoundView } from '../../../components/NotFoundView';
import { QueryStateView } from '../../../components/QueryStateView';
import { useSnackbar } from '../../../components/Snackbar';
import { SubHeader } from '../../../components/SubHeader';
import { useIdempotencyKeys } from '../../../lib/idempotency';
import { useIsOnline } from '../../../lib/useIsOnline';
import { useNow } from '../../../lib/useNow';
import { gutter, radius, type, useTheme, useThemedStyles } from '../../../theme';
import type { Palette } from '../../../theme/palette';
import { useUserTimeZone } from '../../auth/useUserTimeZone';
import { openQuickAdd } from '../../quickAdd/quickAddTarget';
import { childrenOf } from '../../subtasks/tree';
import { Checkbox } from '../Checkbox';
import { useCompleteWithUndo, useDeleteTask, useDuplicateTask, useReopenTask } from '../useTaskActions';
import { Breadcrumb } from './Breadcrumb';
import { SubtaskSection } from './SubtaskSection';
import { TaskChips } from './TaskChips';
import { useTaskAccess } from './taskReadOnly';
import { useSubtasks, useTaskDepth } from './useSubtasks';
import { useTaskEditor } from './useTaskEditor';
import { useTaskMove } from './useTaskMove';

/** Task detail (M-TaskDetail, spec 9.2): header, name, description, date + chips, sub-tasks, menu ⋯, conflict banner. */
export function TaskDetailScreen({ taskId }: { taskId: string }) {
  const styles = useThemedStyles(createTaskDetailScreenStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const snackbar = useSnackbar();
  const online = useIsOnline();
  const editor = useTaskEditor(taskId);
  const { task, draft, base } = editor;
  // completed / archived project or section → read-only (spec 5.7, 12.10); archived additionally locks the circle and Delete.
  const access = useTaskAccess(task);
  const move = useTaskMove(task);
  const depth = useTaskDepth(task);
  const subtasks = useSubtasks(taskId);
  const { complete, errorMessage: completeError } = useCompleteWithUndo();
  const reopen = useReopenTask();
  const duplicate = useDuplicateTask();
  const remove = useDeleteTask();
  const duplicateKeys = useIdempotencyKeys();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [localGone, setLocalGone] = useState(false);

  function leave() {
    // Refresh the lists but not this detail (it is gone), then drop it from the cache.
    void invalidateData(queryClient, { keepDetail: true });
    queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(taskId) });
    router.back();
  }

  function onActionError(error: unknown) {
    if (isNotFound(error)) setLocalGone(true);
  }

  if (editor.gone || localGone) return <NotFoundView onBack={leave} testID="task-not-found" />;
  if (!task || !draft || !base) {
    return (
      <View style={styles.fill}>
        <SubHeader onBack={() => router.back()} testID="task-header" />
        <QueryStateView query={editor.taskQuery} testID="task-state" />
      </View>
    );
  }

  const completed = task.completedAt !== null;
  const children = childrenOf(subtasks.data ?? [], taskId);
  const openChildren = children.filter((child) => child.completedAt === null).length;

  const items: ActionMenuItem[] = [
    {
      key: 'add-subtask',
      label: t('taskDetail.menuAddSubtask'),
      icon: 'plus',
      requiresOnline: true,
      disabled: depth === 4,
      onPress: () =>
        openQuickAdd({ parentId: taskId, projectId: task.projectId, ...(task.sectionId ? { sectionId: task.sectionId } : {}) }),
    },
    {
      key: 'duplicate',
      label: t('taskDetail.menuDuplicate'),
      icon: 'copy',
      requiresOnline: true,
      onPress: () =>
        // mutateAsync: per-call mutate callbacks are dropped when this screen unmounts or a later mutate replaces them.
        void duplicate
          .mutateAsync({ taskId, idempotencyKey: duplicateKeys.keyFor({ duplicate: taskId }) })
          .then(() => {
            duplicateKeys.reset();
            snackbar.show({ message: t('taskDetail.duplicated') });
          }, onActionError),
    },
    {
      // M6c: ends the cycle (the task is really completed); Undo reopens it like any completion.
      key: 'complete-forever',
      label: t('recurrence.menu.forever'),
      icon: 'check-circle',
      requiresOnline: true,
      onPress: () => complete(taskId, { onError: onActionError, forever: true }),
    },
    {
      // M6c: next due AND the completed direct sub-tasks reopened (≤ 30), whatever the "Reset sub-tasks" setting says.
      key: 'complete-reset',
      label: t('recurrence.menu.reset'),
      icon: 'rotate-ccw',
      requiresOnline: true,
      onPress: () => complete(taskId, { onError: onActionError, resetSubtasks: true }),
    },
    {
      key: 'toggle-completed',
      label: hideCompleted ? t('taskDetail.menuShowCompleted') : t('taskDetail.menuHideCompleted'),
      icon: hideCompleted ? 'eye' : 'eye-off',
      onPress: () => setHideCompleted((value) => !value),
    },
    {
      key: 'reorder-subtasks',
      label: t('taskDetail.menuReorderSubtasks'),
      icon: 'move',
      requiresOnline: true,
      disabled: openChildren < 2,
      onPress: () => setReorderOpen(true),
    },
    {
      key: 'delete',
      label: t('taskDetail.menuDelete'),
      icon: 'trash-2',
      destructive: true,
      requiresOnline: true,
      onPress: () => {
        remove.reset();
        setDeleteOpen(true);
      },
    },
  ];

  // Which menu entries exist: read-only drops the writes under the task; an archived place also drops Delete (409).
  const allowed: Record<string, boolean> = {
    'add-subtask': !access.readOnly,
    duplicate: !access.readOnly,
    'complete-forever': task.isRecurring && !completed && !access.readOnly,
    'complete-reset': task.isRecurring && !completed && !access.readOnly && task.subtaskCount > 0,
    'toggle-completed': true,
    'reorder-subtasks': !access.readOnly,
    delete: !access.archived,
  };
  const visibleItems = items.filter((item) => allowed[item.key]);

  const errorMessage = editor.errors.form ?? move.errorMessage ?? completeError ?? (reopen.error ? describeError(reopen.error).message : undefined) ?? (duplicate.error ? describeError(duplicate.error).message : undefined);

  return (
    <View style={styles.fill}>
      <SubHeader
        onBack={() => router.back()}
        center={<Breadcrumb task={task} onPress={move.start} />}
        right={<IconButton icon="more-horizontal" label={t('taskDetail.menu')} onPress={() => setMenuOpen(true)} testID="task-menu-open" />}
        testID="task-header"
      />
      <KeyboardScreen contentStyle={styles.content}>
        {access.archived ? (
          <Text testID="task-archived-notice" style={[type.meta, styles.archivedNotice]}>
            {t('taskDetail.archivedNotice')}
          </Text>
        ) : null}
        {editor.conflict ? (
          <View style={styles.conflict} testID="task-conflict" accessibilityRole="alert">
            <Text style={[type.bodyStrong, styles.conflictTitle]}>{t('taskDetail.conflictTitle')}</Text>
            <Text style={[type.meta, styles.conflictText]}>{t('taskDetail.conflictHint')}</Text>
            <View style={styles.conflictActions}>
              <AppButton size="sm" label={t('taskDetail.keepMine')} onPress={() => void editor.keepMine()} requiresOnline testID="task-conflict-keep" />
              <AppButton variant="outline" size="sm" label={t('taskDetail.useLatest')} onPress={editor.acceptLatest} testID="task-conflict-latest" />
            </View>
          </View>
        ) : null}
        <View style={styles.titleRow}>
          <Checkbox
            large
            testID="task-toggle"
            priority={draft.priority}
            checked={completed}
            label={completed ? t('taskDetail.reopen') : t('taskDetail.complete')}
            disabled={access.archived || !online}
            onPress={() => (completed ? void reopen.mutateAsync({ taskId }).catch(onActionError) : complete(taskId, { onError: onActionError }))}
          />
          <TextInput
            testID="task-content"
            value={draft.content}
            onChangeText={(content) => editor.edit({ content })}
            onBlur={() => void editor.commit()}
            accessibilityLabel={t('taskDetail.content')}
            editable={!access.readOnly}
            multiline
            blurOnSubmit
            style={styles.title}
          />
        </View>
        <ErrorText message={editor.errors.content} testID="task-content-error" />
        <TextInput
          testID="task-description"
          value={draft.description}
          onChangeText={(description) => editor.edit({ description })}
          onBlur={() => void editor.commit()}
          placeholder={t('taskDetail.descriptionPlaceholder')}
          placeholderTextColor={palette.mute}
          accessibilityLabel={t('taskDetail.description')}
          editable={!access.readOnly}
          multiline
          style={styles.description}
        />
        <ErrorText message={editor.errors.description} testID="task-description-error" />
        <TaskChips
          task={task}
          draft={draft}
          now={now}
          timeZone={timeZone}
          onCommit={(patch) => void editor.commit(patch)}
          onMove={move.start}
          readOnly={access.readOnly}
        />
        <ErrorText message={errorMessage} testID="task-error" />
        <SubtaskSection
          task={task}
          depth={depth}
          hideCompleted={hideCompleted}
          reorderOpen={reorderOpen}
          onReorderClose={() => setReorderOpen(false)}
          readOnly={access.readOnly}
        />
      </KeyboardScreen>
      {move.picker}
      <ActionMenu visible={menuOpen} onClose={() => setMenuOpen(false)} items={visibleItems} testID="task-menu" />
      <ConfirmDialog
        visible={deleteOpen}
        title={t('taskDetail.deleteTitle')}
        message={
          task.subtaskCount > 0
            ? t('taskDetail.deleteMessageWithSubtasks', { name: task.content, n: task.subtaskCount })
            : t('taskDetail.deleteMessage', { name: task.content })
        }
        confirmLabel={t('common.delete')}
        busy={remove.isPending}
        error={remove.error && !isNotFound(remove.error) ? describeError(remove.error).message : undefined}
        onCancel={() => setDeleteOpen(false)}
        // A 404 means it is already gone: treat it as deleted (spec 5.6).
        onConfirm={() => remove.mutate(taskId, { onSuccess: leave, onError: (error) => isNotFound(error) && leave() })}
        testID="task-delete-dialog"
      />
    </View>
  );
}

function createTaskDetailScreenStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: gutter, paddingTop: 8, paddingBottom: 48 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8 },
    title: { ...type.detailTitle, flex: 1, color: palette.ink, paddingTop: 0, paddingBottom: 0 },
    description: { ...type.bodySmall, color: palette.mute, marginTop: 6, marginBottom: 12, marginLeft: 38, paddingVertical: 4 },
    conflict: { backgroundColor: palette.p2s, borderRadius: radius.control, padding: 12, gap: 6, marginBottom: 8 },
    conflictTitle: { color: palette.p2 },
    conflictText: { color: palette.ink },
    conflictActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    archivedNotice: { color: palette.mute, backgroundColor: palette.bg2, borderRadius: radius.control, padding: 12, marginBottom: 8 },
  });
}
