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
import { gutter, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useMe } from '../auth/session';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { stampLabel } from '../comments/commentTime';
import { capabilitiesOf } from '../projects/projectCapabilities';
import { useProjectNameLabel } from '../projects/useProjectNameLabel';
import { useProjects } from '../projects/useProjects';
import { useWorkspaces } from '../team/useTeam';
import { useRequesterNames, useReviewActions, useReviewList } from './useReview';

const taskId = (task: Task) => task.id;

interface ReviewRowProps {
  task: Task;
  /** Already formatted ("Bình yêu cầu · 09:30"): the row keeps no hook of its own besides theme / i18n. */
  requested: string;
  projectName: string;
  canReview: boolean;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
}

/** One pending task: name, who asked and when, project; an Admin gets Duyệt / Trả lại. */
const ReviewRow = memo(function ReviewRow({ task, requested, projectName, canReview, onApprove, onReject }: ReviewRowProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  return (
    <View testID={`review-row-${task.id}`} style={styles.row}>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/task/${task.id}`)} style={styles.main}>
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
      {canReview ? (
        <View style={styles.actions}>
          <AppButton testID={`review-approve-${task.id}`} size="sm" label={t('review.approve')} onPress={() => onApprove(task.id)} />
          <AppButton testID={`review-reject-${task.id}`} size="sm" variant="outline" label={t('review.reject')} onPress={() => onReject(task.id)} />
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
  const { hidden, onApprove, onReject } = useReviewActions();
  const names = useRequesterNames();
  const me = useMe().data?.id;
  const { byId } = useProjects();
  const projectLabel = useProjectNameLabel();
  const { teams } = useWorkspaces();
  const isAdmin = teams.some((team) => team.role === 'ADMIN');

  const rows = useMemo(() => tasks.filter((task) => !hidden.has(task.id)), [tasks, hidden]);
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
          canReview={capabilitiesOf(byId.get(item.projectId)).canReview === true}
          onApprove={onApprove}
          onReject={onReject}
        />
      );
    },
    [me, names, now, timeZone, projectLabel, byId, onApprove, onReject, t],
  );

  return (
    <View testID="review-screen" style={styles.fill}>
      <SubHeader title={isAdmin ? t('review.title') : t('review.mineTitle')} onBack={() => router.back()} testID="review-header" />
      {isAdmin ? null : <Text style={styles.hint}>{t('review.readOnlyHint')}</Text>}
      {query.isPending || query.isError ? (
        <QueryStateView query={query} testID="review-state" />
      ) : (
        <FlatList
          testID="review-list"
          data={rows}
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
    title: { ...type.taskTitle, color: palette.ink },
    meta: { ...type.meta, color: palette.mute },
    actions: { flexDirection: 'row', gap: 8 },
  });
}
