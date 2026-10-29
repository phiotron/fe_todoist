import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Task } from '../../api/models';
import { AppButton } from '../../components/AppButton';
import { QueryStateView } from '../../components/QueryStateView';
import { StateView } from '../../components/StateView';
import { SubHeader } from '../../components/SubHeader';
import { useDayStableNow } from '../../lib/dayStableNow';
import { useNow } from '../../lib/useNow';
import { gutter, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useMe } from '../auth/session';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { stampLabel } from '../comments/commentTime';
import { capabilitiesOf } from '../projects/projectCapabilities';
import { useProjectNameLabel } from '../projects/useProjectNameLabel';
import { useProjects } from '../projects/useProjects';
import { useWorkspaces } from '../team/useTeam';
import { ReviewSelectionBar } from './ReviewSelectionBar';
import { useRequesterNames, useReviewActions, useReviewList, useReviewSelection } from './useReview';

const taskId = (task: Task) => task.id;

interface ReviewRowProps {
  task: Task;
  /** Already formatted ("Bình yêu cầu · 09:30"): the row keeps no hook of its own besides theme / i18n. */
  requested: string;
  projectName: string;
  canReview: boolean;
  /** Multi-select mode: the row shows a checkbox instead of Duyệt / Trả lại, and a press ticks it. */
  selecting: boolean;
  selected: boolean;
  onApprove: (task: Task) => void;
  onReject: (task: Task) => void;
  onToggle: (taskId: string) => void;
  onStartSelect: (taskId: string) => void;
}

/** One pending task: name, who asked and when, project; an Admin gets Duyệt / Trả lại. */
const ReviewRow = memo(function ReviewRow({ task, requested, projectName, canReview, selecting, selected, onApprove, onReject, onToggle, onStartSelect }: ReviewRowProps) {
  const styles = useThemedStyles(createStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const onPress = () => {
    if (!selecting) router.push(`/task/${task.id}`);
    else if (canReview) onToggle(task.id);
  };
  return (
    <View testID={`review-row-${task.id}`} style={styles.row}>
      <Pressable
        testID={`review-open-${task.id}`}
        accessibilityRole="button"
        onPress={onPress}
        onLongPress={canReview && !selecting ? () => onStartSelect(task.id) : undefined}
        style={styles.main}
      >
        {selecting && canReview ? (
          <Feather
            testID={`review-check-${task.id}`}
            accessibilityRole="checkbox"
            accessibilityLabel={t('review.selectRow', { name: task.content })}
            accessibilityState={{ checked: selected }}
            name={selected ? 'check-square' : 'square'}
            size={22}
            color={selected ? palette.acc : palette.mute}
            style={styles.check}
          />
        ) : null}
        <Text style={styles.title} numberOfLines={2}>
          {task.content}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {requested}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {projectName}
        </Text>
      </Pressable>
      {canReview && !selecting ? (
        <View style={styles.actions}>
          <AppButton testID={`review-approve-${task.id}`} size="sm" label={t('review.approve')} onPress={() => onApprove(task)} />
          <AppButton testID={`review-reject-${task.id}`} size="sm" variant="outline" label={t('review.reject')} onPress={() => onReject(task)} />
        </View>
      ) : null}
    </View>
  );
});

/**
 * "Chờ duyệt" (Team tab): tasks a Member / Guest ticked in a team project, waiting for an Admin. Admin: Duyệt / Trả lại
 * on each row (with Undo). Member: "Đang chờ duyệt của tôi", read only. Paged by cursor like every list.
 */
export function ReviewScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const timeZone = useUserTimeZone();
  const now = useDayStableNow(useNow(), timeZone);
  const { query, tasks } = useReviewList();
  const { hidden, onApprove, onReject, approveTasks, rejectTasks } = useReviewActions();
  const selection = useReviewSelection();
  const names = useRequesterNames();
  const me = useMe().data?.id;
  const { byId } = useProjects();
  const projectLabel = useProjectNameLabel();
  const { teams } = useWorkspaces();
  const isAdmin = teams.some((team) => team.role === 'ADMIN');

  const rows = useMemo(() => tasks.filter((task) => !hidden.has(task.id)), [tasks, hidden]);
  const canReviewTask = useCallback((task: Task) => capabilitiesOf(byId.get(task.projectId)).canReview === true, [byId]);
  const reviewable = useMemo(() => rows.filter(canReviewTask), [rows, canReviewTask]);
  // only rows still on the list count (a row can vanish after a refresh)
  const picked = useMemo(() => reviewable.filter((task) => selection.ids.has(task.id)), [reviewable, selection.ids]);
  const { selecting, ids: selectedIds } = selection;
  const selectAll = useCallback(() => selection.selectAll(reviewable.map(taskId)), [selection, reviewable]);
  const finishBatch = (run: (tasks: readonly Task[]) => void) => () => {
    const tasks = picked;
    selection.clear();
    run(tasks);
  };
  const renderItem = useCallback(
    ({ item }: { item: Task }) => {
      const time = item.reviewRequestedAt ? stampLabel(item.reviewRequestedAt, now, timeZone) : '';
      const mine = me !== undefined && item.reviewRequestedBy === me;
      const who = (item.reviewRequestedBy && names.get(item.reviewRequestedBy)) || t('review.unknownPerson');
      return (
        <ReviewRow
          task={item}
          requested={mine ? t('review.requestedByMe', { time }) : t('review.requestedBy', { name: who, time })}
          projectName={projectLabel(item.projectId, item.projectName)}
          canReview={canReviewTask(item)}
          selecting={selecting}
          selected={selectedIds.has(item.id)}
          onApprove={onApprove}
          onReject={onReject}
          onToggle={selection.toggle}
          onStartSelect={selection.start}
        />
      );
    },
    [me, names, now, timeZone, projectLabel, canReviewTask, selecting, selectedIds, onApprove, onReject, selection.toggle, selection.start, t],
  );

  return (
    <View testID="review-screen" style={styles.fill}>
      <SubHeader
        title={selecting ? t('review.selectedCount', { n: picked.length }) : isAdmin ? t('review.title') : t('review.mineTitle')}
        onBack={() => (selecting ? selection.clear() : router.back())}
        testID="review-header"
        right={
          selecting ? (
            <AppButton testID="review-select-done" size="sm" variant="ghost" label={t('common.done')} onPress={selection.clear} />
          ) : isAdmin && reviewable.length > 0 ? (
            <AppButton testID="review-select" size="sm" variant="ghost" label={t('review.select')} onPress={() => selection.start()} />
          ) : undefined
        }
      />
      {isAdmin ? null : <Text style={styles.hint}>{t('review.readOnlyHint')}</Text>}
      {query.isPending || query.isError ? (
        <QueryStateView query={query} testID="review-state" />
      ) : (
        <FlatList
          testID="review-list"
          data={rows}
          extraData={selectedIds}
          keyExtractor={taskId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <StateView tone="ok" icon="check-circle" title={isAdmin ? t('review.empty') : t('review.emptyMine')} testID="review-empty" />
          }
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator testID="review-more" /> : undefined}
        />
      )}
      {selecting ? (
        <ReviewSelectionBar count={picked.length} onSelectAll={selectAll} onApprove={finishBatch(approveTasks)} onReject={finishBatch(rejectTasks)} />
      ) : null}
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    hint: { ...type.bodySmall, color: palette.mute, paddingHorizontal: gutter, paddingBottom: 8 },
    list: { paddingHorizontal: gutter, paddingBottom: 48, flexGrow: 1 },
    row: { paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: palette.line },
    main: { gap: 2 },
    check: { marginBottom: 4 },
    title: { ...type.taskTitle, color: palette.ink },
    meta: { ...type.meta, color: palette.mute },
    actions: { flexDirection: 'row', gap: 8 },
  });
}
