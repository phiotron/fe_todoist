import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { inboxTeamApi, inboxTeamQueryKey } from '../../api/inboxTeam';
import type { Project, Task } from '../../api/models';
import type { WorkspaceResponse } from '../../api/workspaces';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { SectionHeader } from '../../components/SectionHeader';
import { flattenPages, nextPageParam } from '../../lib/pagination';
import { useNow } from '../../lib/useNow';
import { gutter, size, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { projectDisplayName } from '../projects/appearance';
import { useProjects } from '../projects/useProjects';
import { projectOrigin } from '../tasks/projectOrigin';
import { TaskRowEnvProvider } from '../tasks/taskRowEnv';
import { TaskRow } from '../tasks/TaskRow';
import { useToggleTask } from '../tasks/useTaskActions';
import { useWorkspaces } from '../team/useTeam';

/** Tasks shown per project before "See all" (which opens the project). */
export const INBOX_TEAM_PROJECT_LIMIT = 5;
/** Collapsed keys ('section' = the whole block, else a group key), per device (AsyncStorage). */
export const INBOX_TEAM_COLLAPSED_KEY = 'taskly.inboxTeam.collapsed';
const SECTION = 'section';
const SHARED_GROUP = 'shared';

interface ProjectBlock {
  project: Project;
  tasks: Task[];
}

interface Group {
  key: string;
  title: string;
  projects: ProjectBlock[];
}

const taskId = (task: Task) => task.id;

/** Team groups by name, then "Shared projects"; projects in server order (workspace project order). */
export function groupTeamWork(
  tasks: readonly Task[],
  projects: ReadonlyMap<string, Project>,
  workspaces: readonly WorkspaceResponse[] | undefined,
  labels: { shared: string; team: string },
): Group[] {
  const groups = new Map<string, Group>();
  for (const task of tasks) {
    const project = projects.get(task.projectId);
    const origin = projectOrigin(project, workspaces);
    if (!project || origin.kind === 'personal') continue; // defensive: only group projects belong here
    const key = origin.kind === 'team' ? origin.workspaceId : SHARED_GROUP;
    const title = origin.kind === 'team' ? (origin.teamName ?? labels.team) : labels.shared;
    let group = groups.get(key);
    if (!group) {
      group = { key, title, projects: [] };
      groups.set(key, group);
    }
    let block = group.projects.find((item) => item.project.id === project.id);
    if (!block) {
      block = { project, tasks: [] };
      group.projects.push(block);
    }
    block.tasks.push(task);
  }
  const all = [...groups.values()];
  const teams = all.filter((group) => group.key !== SHARED_GROUP).sort((a, b) => a.title.localeCompare(b.title));
  return [...teams, ...all.filter((group) => group.key === SHARED_GROUP)];
}

/** Collapsed keys remembered on this device; `loaded` = the stored value was read (avoids a flash of the wrong state). */
function useCollapsedKeys() {
  const [keys, setKeys] = useState<ReadonlySet<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(INBOX_TEAM_COLLAPSED_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setKeys(new Set(parsed.filter((item): item is string => typeof item === 'string')));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const toggle = useCallback((key: string) => {
    setKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // A lost write only forgets the fold state: never break the Inbox for it.
      void AsyncStorage.setItem(INBOX_TEAM_COLLAPSED_KEY, JSON.stringify([...next])).catch(() => undefined);
      return next;
    });
  }, []);
  return { keys, loaded, toggle };
}

/**
 * Inbox › "Team work" (user request, NOT a Todoist feature): below the personal Inbox, the undated open root tasks of
 * the joined team projects and shared projects (GET tasks?view=inbox_team), grouped team → project. Hidden when there
 * is no group project or nothing undated. Collapsible (whole block and per group, remembered on the device); at most
 * {@link INBOX_TEAM_PROJECT_LIMIT} tasks per project with "See all" opening the project; tap a task = its detail.
 */
export function InboxTeamSection() {
  const styles = useThemedStyles(createInboxTeamStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const now = useNow();
  const timeZone = useUserTimeZone();
  const { toggle, pendingId, errorMessage } = useToggleTask();
  const { all, byId } = useProjects();
  const workspaces = useWorkspaces().query.data;
  const collapsed = useCollapsedKeys();
  const hasGroupProject = useMemo(
    () => all.some((project) => projectOrigin(project, undefined).kind !== 'personal' && project.archivedAt === null),
    [all],
  );
  const query = useInfiniteQuery({
    queryKey: inboxTeamQueryKey,
    queryFn: ({ pageParam }) => inboxTeamApi.list(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: nextPageParam,
    enabled: hasGroupProject,
  });
  const tasks = useMemo(() => flattenPages(query.data?.pages, taskId), [query.data]);
  const groups = useMemo(
    () => groupTeamWork(tasks, byId, workspaces, { shared: t('views.inboxTeam.shared'), team: t('views.inboxTeam.team') }),
    [tasks, byId, workspaces, t],
  );
  const count = groups.reduce((sum, group) => sum + group.projects.reduce((n, block) => n + block.tasks.length, 0), 0);

  if (!hasGroupProject || !collapsed.loaded || count === 0) return null;
  const sectionCollapsed = collapsed.keys.has(SECTION);

  return (
    <View style={styles.wrap} testID="inbox-team">
      <Pressable
        testID="inbox-team-header"
        accessibilityRole="button"
        accessibilityLabel={sectionCollapsed ? t('views.inboxTeam.expand') : t('views.inboxTeam.collapse')}
        accessibilityState={{ expanded: !sectionCollapsed }}
        onPress={() => collapsed.toggle(SECTION)}
        style={styles.header}
      >
        <Feather name={sectionCollapsed ? 'chevron-up' : 'chevron-down'} size={size.iconSmall} color={palette.ink2} />
        <Feather name="users" size={size.iconSmall} color={palette.acc} />
        <Text style={[type.section, styles.title]}>{t('views.inboxTeam.title')}</Text>
        <Text style={styles.count}>{t('views.inboxTeam.count', { n: count })}</Text>
      </Pressable>
      {sectionCollapsed ? null : (
        <TaskRowEnvProvider fetchLists>
        <ScrollView style={{ maxHeight: Math.round(height * 0.45) }} testID="inbox-team-list" nestedScrollEnabled>
          {errorMessage ? (
            <View style={styles.pad}>
              <ErrorText message={errorMessage} testID="inbox-team-error" />
            </View>
          ) : null}
          {groups.map((group) => {
            const groupCollapsed = collapsed.keys.has(group.key);
            return (
              <View key={group.key}>
                <View style={styles.pad}>
                  <SectionHeader
                    title={group.title}
                    count={group.projects.reduce((n, block) => n + block.tasks.length, 0)}
                    collapsed={groupCollapsed}
                    onToggle={() => collapsed.toggle(group.key)}
                    testID={`inbox-team-group-${group.key}`}
                  />
                </View>
                {groupCollapsed
                  ? null
                  : group.projects.map((block) => (
                      <View key={block.project.id}>
                        <Pressable
                          testID={`inbox-team-project-${block.project.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={t('views.inboxTeam.openProject', { name: projectDisplayName(block.project) })}
                          onPress={() => router.push({ pathname: '/project/[id]', params: { id: block.project.id } })}
                          style={styles.project}
                        >
                          <Feather name="hash" size={size.iconSmall - 2} color={palette.mute} />
                          <Text style={styles.projectName} numberOfLines={1}>
                            {projectDisplayName(block.project)}
                          </Text>
                        </Pressable>
                        {block.tasks.slice(0, INBOX_TEAM_PROJECT_LIMIT).map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            now={now}
                            timeZone={timeZone}
                            onToggle={toggle}
                            toggleDisabled={pendingId === task.id}
                          />
                        ))}
                        {block.tasks.length > INBOX_TEAM_PROJECT_LIMIT ? (
                          <View style={styles.more}>
                            <AppButton
                              variant="ghost"
                              size="sm"
                              color={palette.acc}
                              label={t('views.inboxTeam.seeAll', { n: block.tasks.length })}
                              onPress={() => router.push({ pathname: '/project/[id]', params: { id: block.project.id } })}
                              testID={`inbox-team-see-all-${block.project.id}`}
                            />
                          </View>
                        ) : null}
                      </View>
                    ))}
              </View>
            );
          })}
          {query.hasNextPage ? (
            <View style={styles.more}>
              <AppButton
                variant="ghost"
                color={palette.acc}
                label={t('views.inboxTeam.loadMore')}
                busy={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
                testID="inbox-team-load-more"
              />
            </View>
          ) : null}
        </ScrollView>
        </TaskRowEnvProvider>
      )}
    </View>
  );
}

function createInboxTeamStyles(palette: Palette) {
  return StyleSheet.create({
    wrap: { borderTopWidth: 1, borderTopColor: palette.line, backgroundColor: palette.bg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: gutter, paddingVertical: 12 },
    title: { color: palette.ink },
    count: { ...type.meta, color: palette.mute, flexShrink: 1 },
    pad: { paddingHorizontal: gutter },
    project: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: gutter, paddingTop: 8, paddingBottom: 4 },
    projectName: { ...type.meta, color: palette.ink2, flexShrink: 1 },
    more: { paddingHorizontal: gutter, paddingVertical: 4, alignItems: 'flex-start' },
  });
}
