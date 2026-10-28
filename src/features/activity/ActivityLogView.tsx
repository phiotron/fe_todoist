import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ACTIVITY_EVENT_TYPES, type ActivityEventType, type ActivityItem, type ActivityParams } from '../../api/activity';
import { AppButton } from '../../components/AppButton';
import { BottomSheet } from '../../components/BottomSheet';
import { Chip } from '../../components/Chip';
import { QueryStateView } from '../../components/QueryStateView';
import { SectionHeader } from '../../components/SectionHeader';
import { StateView } from '../../components/StateView';
import { addDays, dateKeyInZone } from '../../lib/dates';
import { formatDateKey, weekdayName } from '../../lib/dates/format';
import { useNow } from '../../lib/useNow';
import { gutter, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useMe } from '../auth/session';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { projectDisplayName } from '../projects/appearance';
import { useProjects } from '../projects/useProjects';
import { sharingOf } from '../sharing/sharingRules';
import { useProjectMembers } from '../sharing/useSharing';
import { ChoiceList } from '../settings/ui';
import { groupByDay } from './activityModel';
import { useActivity } from './useActivity';

type Row = { type: 'header'; key: string; title: string; count: number } | { type: 'item'; key: string; item: ActivityItem };

interface ActivityLogViewProps {
  /** Fixed scope: projectId / taskId of "View activity" (the filters below never override them). */
  scope?: Pick<ActivityParams, 'projectId' | 'taskId'>;
  /** Event-type and project chips (the Activity log tab of Completed shows them; a task's own log does not). */
  filters?: boolean;
  testID?: string;
}

const ALL = 'ALL';

/**
 * Activity log list (M10 plan F5, design M-Completed tab "Activity log"): events newest first, grouped by day in the
 * account time zone, filter by event type and project, load more by cursor. Read-only.
 */
export function ActivityLogView({ scope = {}, filters = true, testID = 'activity-log' }: ActivityLogViewProps) {
  const styles = useThemedStyles(createStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const today = dateKeyInZone(now, timeZone);
  const { all: projects } = useProjects();
  const [eventType, setEventType] = useState<ActivityEventType | undefined>();
  const [projectId, setProjectId] = useState<string | undefined>();
  const [projectSheet, setProjectSheet] = useState(false);
  const [personSheet, setPersonSheet] = useState(false);
  // X2: the person filter belongs to ONE project, so it is forgotten when the project changes.
  const [chosenPerson, setChosenPerson] = useState<{ projectId: string | undefined; id: string } | undefined>();
  const me = useMe();

  const effectiveProjectId = scope.projectId ?? projectId;
  const effectiveProject = projects.find((project) => project.id === effectiveProjectId);
  const effectiveSharing = effectiveProject ? sharingOf(effectiveProject) : undefined;
  // A shared project (team project or one with collaborators) that I have joined: its members can be told apart.
  const sharedProjectId = effectiveSharing && (effectiveSharing.isTeamProject || effectiveSharing.memberCount > 1) && effectiveSharing.joined ? effectiveProjectId : undefined;
  const members = useProjectMembers(sharedProjectId);
  const people = sharedProjectId ? (members.data ?? []) : [];
  const personId = chosenPerson && chosenPerson.projectId === effectiveProjectId ? chosenPerson.id : undefined;
  const chosenMember = people.find((person) => person.userId === personId);

  const params = useMemo<ActivityParams>(
    () => ({ ...scope, ...(scope.projectId ? {} : { projectId }), eventType, ...(personId ? { initiatorId: personId } : {}) }),
    [scope, projectId, eventType, personId],
  );
  const { query, items } = useActivity(params);

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    for (const group of groupByDay(items, timeZone)) {
      const weekday = weekdayName(group.day);
      const title =
        group.day === today
          ? t('views.completed.today', { weekday })
          : group.day === addDays(today, -1)
            ? t('views.completed.yesterday', { weekday })
            : t('views.completed.day', { weekday, date: formatDateKey(group.day, group.day.slice(0, 4) !== today.slice(0, 4)) });
      result.push({ type: 'header', key: `h-${group.day}`, title, count: group.items.length });
      for (const item of group.items) result.push({ type: 'item', key: item.id, item });
    }
    return result;
  }, [items, timeZone, today, t]);

  const chosenProject = projects.find((project) => project.id === projectId);
  const showState = !query.data;

  const header = filters ? (
    <View testID={`${testID}-filters`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip
          large
          testID={`${testID}-event-all`}
          label={t('activity.filterAll')}
          selected={eventType === undefined}
          onPress={() => setEventType(undefined)}
        />
        {ACTIVITY_EVENT_TYPES.map((type_) => (
          <Chip
            key={type_}
            large
            testID={`${testID}-event-${type_}`}
            label={t(`activity.type.${type_}`)}
            selected={eventType === type_}
            onPress={() => setEventType(eventType === type_ ? undefined : type_)}
          />
        ))}
      </ScrollView>
      {scope.projectId && people.length === 0 ? null : (
        <View style={styles.projectRow}>
          {scope.projectId ? null : (
            <Chip
              large
              icon="folder"
              testID={`${testID}-project-chip`}
              label={chosenProject ? projectDisplayName(chosenProject) : t('activity.filterProject')}
              selected={projectId !== undefined}
              onPress={() => setProjectSheet(true)}
            />
          )}
          {people.length > 0 ? (
            <Chip
              large
              icon="user"
              testID={`${testID}-person-chip`}
              label={chosenMember ? chosenMember.displayName : t('activity.filterPerson')}
              selected={personId !== undefined}
              onPress={() => setPersonSheet(true)}
            />
          ) : null}
        </View>
      )}
    </View>
  ) : null;

  function renderRow({ item: row }: { item: Row }) {
    if (row.type === 'header') {
      return (
        <View style={styles.section}>
          <SectionHeader title={row.title} count={row.count} testID={`${testID}-${row.key}`} />
        </View>
      );
    }
    const { item } = row;
    const openable = item.objectType === 'TASK' && item.eventType !== 'DELETED';
    // In a shared project the line names who did it ("Bạn" only for my own events).
    const byOther = people.length > 0 && me.data !== undefined && item.initiatorId !== me.data.id;
    const who = byOther ? (people.find((person) => person.userId === item.initiatorId)?.displayName ?? t('activity.someone')) : undefined;
    return (
      <Pressable
        testID={`${testID}-item-${item.id}`}
        accessibilityRole={openable ? 'button' : 'text'}
        disabled={!openable}
        onPress={() => router.push(`/task/${item.objectId}`)}
        style={styles.item}
      >
        <Feather name={iconFor(item.eventType)} size={size.icon} color={palette.acc} />
        <View style={styles.itemTexts}>
          <Text style={styles.itemTitle}>
            {who !== undefined
              ? t(`activity.eventBy.${item.objectType}.${item.eventType}`, { who, name: item.objectName })
              : t(`activity.event.${item.objectType}.${item.eventType}`, { name: item.objectName })}
          </Text>
          {item.projectName && item.objectType !== 'PROJECT' ? (
            <Text style={styles.itemMeta}>{t('activity.inProject', { project: item.projectName })}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.fill} testID={testID}>
      {header}
      {showState ? (
        <QueryStateView query={query} testID={`${testID}-state`} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          contentContainerStyle={styles.content}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} />}
          ListEmptyComponent={
            <StateView
              tone="ok"
              icon="activity"
              title={t('activity.emptyTitle')}
              message={t('activity.emptyMessage')}
              testID={`${testID}-empty`}
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator color={palette.acc} style={styles.footer} />
            ) : query.hasNextPage ? (
              <View style={styles.footer}>
                <AppButton
                  variant="outline"
                  size="sm"
                  label={t('activity.loadMore')}
                  onPress={() => void query.fetchNextPage()}
                  testID={`${testID}-load-more`}
                />
              </View>
            ) : undefined
          }
        />
      )}
      <BottomSheet visible={personSheet} onClose={() => setPersonSheet(false)} title={t('activity.filterPerson')} testID={`${testID}-person-sheet`}>
        <ChoiceList
          testIDPrefix={`${testID}-person`}
          choices={[
            { value: ALL, label: t('activity.filterAllPeople') },
            ...people.map((person) => ({ value: person.userId, label: person.displayName })),
          ]}
          selected={personId ?? ALL}
          onSelect={(value) => {
            setPersonSheet(false);
            setChosenPerson(value === ALL ? undefined : { projectId: effectiveProjectId, id: value });
          }}
        />
      </BottomSheet>
      <BottomSheet visible={projectSheet} onClose={() => setProjectSheet(false)} title={t('activity.filterProject')} testID={`${testID}-project-sheet`}>
        <ChoiceList
          testIDPrefix={`${testID}-project`}
          choices={[
            { value: ALL, label: t('activity.filterAllProjects') },
            ...projects.map((project) => ({ value: project.id, label: projectDisplayName(project) })),
          ]}
          selected={projectId ?? ALL}
          onSelect={(value) => {
            setProjectSheet(false);
            setProjectId(value === ALL ? undefined : value);
          }}
        />
      </BottomSheet>
    </View>
  );
}

function iconFor(event: ActivityEventType): 'plus' | 'edit-2' | 'check-circle' | 'rotate-ccw' | 'trash-2' | 'archive' | 'inbox' {
  switch (event) {
    case 'ADDED':
      return 'plus';
    case 'UPDATED':
      return 'edit-2';
    case 'COMPLETED':
      return 'check-circle';
    case 'UNCOMPLETED':
      return 'rotate-ccw';
    case 'DELETED':
      return 'trash-2';
    case 'ARCHIVED':
      return 'archive';
    default:
      return 'inbox';
  }
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingBottom: 40, flexGrow: 1 },
    chips: { gap: 8, paddingHorizontal: gutter, paddingVertical: 8 },
    projectRow: { paddingHorizontal: gutter, paddingBottom: 8, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    section: { paddingHorizontal: gutter },
    item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingHorizontal: gutter, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line },
    itemTexts: { flex: 1, gap: 2 },
    itemTitle: { ...type.body, color: palette.ink },
    itemMeta: { ...type.meta, color: palette.mute },
    footer: { paddingVertical: 16, alignItems: 'center' },
  });
}
