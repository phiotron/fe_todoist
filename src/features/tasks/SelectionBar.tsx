import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { describeError } from '../../api/describeError';
import type { TaskBatchRequest } from '../../api/models';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorText } from '../../components/ErrorText';
import { IconButton, type IconName } from '../../components/IconButton';
import { useTopInset } from '../../components/useTopInset';
import { useIsOnline } from '../../lib/useIsOnline';
import { gutter, shadow, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { ProjectSectionPicker } from '../projects/ProjectSectionPicker';
import { NO_DUE } from '../schedule/dueValue';
import { ScheduleSheet } from '../schedule/ScheduleSheet';
import { DEFAULT_PRIORITY } from './priority';
import { PriorityMenu } from './PriorityMenu';
import { MAX_BATCH_TASKS, useTaskSelection } from './selection';
import { SelectionLabelsAction } from './SelectionLabelsAction';
import { useCompleteWithUndo, useTaskBatch } from './useTaskActions';

type Sheet = 'none' | 'schedule' | 'priority' | 'move' | 'delete';

interface BarAction {
  key: 'complete' | 'schedule' | 'priority' | 'move' | 'delete';
  icon: IconName;
  color: string;
  onPress: () => void;
}

/** Top "N selected" bar + bottom action bar of the multi-select mode (spec 9.2). */
export function SelectionBar() {
  const styles = useThemedStyles(createSelectionBarStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const selection = useTaskSelection();
  const online = useIsOnline();
  const top = useTopInset();
  const insets = useSafeAreaInsets();
  const batch = useTaskBatch();
  const { completeMany, batchPending } = useCompleteWithUndo();
  const [sheet, setSheet] = useState<Sheet>('none');
  if (!selection?.active) return null;

  const taskIds = [...selection.ids];
  const done = () => {
    setSheet('none');
    selection.clear();
  };
  const send = (body: Omit<TaskBatchRequest, 'taskIds'>) =>
    batch.mutate({ ...body, taskIds } as TaskBatchRequest, { onSuccess: done });

  const actions: BarAction[] = [
    { key: 'complete', icon: 'check-circle', color: palette.ink2, onPress: () => completeMany(taskIds, { onSuccess: done }) },
    { key: 'schedule', icon: 'calendar', color: palette.ink2, onPress: () => setSheet('schedule') },
    { key: 'priority', icon: 'flag', color: palette.ink2, onPress: () => setSheet('priority') },
    { key: 'move', icon: 'arrow-right-circle', color: palette.ink2, onPress: () => setSheet('move') },
    { key: 'delete', icon: 'trash-2', color: palette.warn, onPress: () => setSheet('delete') },
  ];
  // PERM: a task of a team project where I only complete tasks is selected → Complete is the only action
  const completeOnly = selection.completeOnly;
  const shown = completeOnly ? actions.filter((action) => action.key === 'complete') : actions;
  const labels: Record<BarAction['key'], string> = {
    complete: t('selection.complete'),
    schedule: t('selection.schedule'),
    priority: t('selection.priority'),
    move: t('selection.move'),
    delete: t('selection.delete'),
  };
  const overLimit = taskIds.length > MAX_BATCH_TASKS;
  const message = overLimit
    ? t('selection.limit', { n: MAX_BATCH_TASKS })
    : batch.error
      ? describeError(batch.error).message
      : undefined; // bulk-complete failures are toasted per call (useCompleteWithUndo), not shown here
  const inactive = taskIds.length === 0 || overLimit || !online || batch.isPending || batchPending; // batchPending: the bulk close / Undo runs on useCompleteWithUndo's own mutation

  const renderAction = (action: BarAction) => (
    <Pressable
      key={action.key}
      testID={`selection-${action.key}`}
      accessibilityRole="button"
      accessibilityLabel={labels[action.key]}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={action.onPress}
      style={[styles.action, inactive && styles.inactive]}
    >
      <Feather name={action.icon} size={size.icon} color={action.color} />
      <Text style={[type.caption, { color: action.color }]}>{labels[action.key]}</Text>
    </Pressable>
  );

  return (
    <>
      <View style={[styles.topBar, { paddingTop: top + 4 }]}>
        <IconButton icon="x" label={t('selection.close')} onPress={selection.clear} testID="selection-close" />
        <Text testID="selection-count" style={[type.barTitle, styles.count]}>
          {t('selection.count', { n: taskIds.length })}
        </Text>
      </View>
      <View style={[styles.bottomBar, { paddingBottom: 8 + insets.bottom }]}>
        <ErrorText message={message} testID="selection-error" />
        <View style={styles.actions}>
          {completeOnly ? (
            shown.map(renderAction)
          ) : (
            <>
              {actions.slice(0, 3).map(renderAction)}
              <SelectionLabelsAction taskIds={taskIds} onDone={done} />
              {actions.slice(3).map(renderAction)}
            </>
          )}
        </View>
      </View>
      <ScheduleSheet
        visible={sheet === 'schedule'}
        mode="date"
        value={NO_DUE}
        onSelect={(due) => send({ action: 'SCHEDULE', date: due.dueDate })}
        onClose={() => setSheet('none')}
        testID="selection-schedule-sheet"
      />
      <PriorityMenu
        visible={sheet === 'priority'}
        value={DEFAULT_PRIORITY}
        bottom={96}
        onSelect={(priority) => send({ action: 'PRIORITY', priority })}
        onClose={() => setSheet('none')}
      />
      <ProjectSectionPicker
        visible={sheet === 'move'}
        title={t('selection.moveTitle')}
        value={{ projectId: undefined, sectionId: null }}
        onSelect={({ projectId, sectionId }) =>
          send(sectionId ? { action: 'MOVE', projectId, sectionId } : { action: 'MOVE', projectId })
        }
        onClose={() => setSheet('none')}
        testID="selection-move-picker"
      />
      <ConfirmDialog
        visible={sheet === 'delete'}
        title={t('selection.deleteTitle', { n: taskIds.length })}
        message={t('selection.deleteMessage')}
        confirmLabel={t('selection.delete')}
        busy={batch.isPending}
        error={batch.error ? describeError(batch.error).message : undefined}
        onCancel={() => setSheet('none')}
        onConfirm={() => send({ action: 'DELETE' })}
        testID="selection-delete-dialog"
      />
    </>
  );
}

function createSelectionBarStyles(palette: Palette) {
  return StyleSheet.create({
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 8,
      paddingBottom: 8,
      backgroundColor: palette.soft,
    },
    count: { color: palette.acc2 },
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: gutter,
      paddingTop: 6,
      backgroundColor: palette.bg,
      borderTopWidth: 1,
      borderTopColor: palette.line,
      ...shadow,
    },
    actions: { flexDirection: 'row', justifyContent: 'space-between' },
    action: { alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: size.touch, minHeight: size.tabItem },
    inactive: { opacity: 0.4 },
  });
}
