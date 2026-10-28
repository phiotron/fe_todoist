import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Task } from '../../api/models';
import { queryKeys } from '../../api/queryKeys';
import { searchApi, type SearchObjects } from '../../api/search';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { ListRow } from '../../components/ListRow';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StateView } from '../../components/StateView';
import { Toggle } from '../../components/Toggle';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { usePagedList } from '../../lib/usePagedList';
import { fonts, type, useTheme } from '../../theme';
import { useMe } from '../auth/session';
import { projectColorHex } from '../projects/appearance';
import { taskRows } from '../tasks/taskRows';
import { TaskListView } from '../tasks/TaskListView';
import { SEARCH_DEBOUNCE_MS, SEARCH_MAX_LENGTH, checkSearchTerm } from './searchTerm';
import { useRecentSearches } from './useRecentSearches';

const taskId = (task: Task) => task.id;

/** Search tab (spec 9.5): tasks + projects / sections / labels / filters, completed-only switch, 5 recent keywords. */
export function SearchScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const me = useMe();
  const recent = useRecentSearches(me.data?.id);
  const [text, setText] = useState('');
  const [completed, setCompleted] = useState(false);
  const debounced = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);
  const typed = checkSearchTerm(text);
  const settled = checkSearchTerm(debounced);

  // Remember the keyword in use when the screen loses focus (task opened, tab switched) — never each keystroke.
  const termRef = useRef<string | null>(null);
  termRef.current = typed.kind === 'ok' && settled.kind === 'ok' ? settled.term : null;
  const { remember } = recent;
  useFocusEffect(
    useCallback(
      () => () => {
        if (termRef.current) remember(termRef.current);
      },
      [remember],
    ),
  );

  function submit() {
    if (typed.kind === 'ok') remember(typed.term);
  }

  function pickRecent(term: string) {
    setText(term);
    remember(term);
  }

  let body: ReactNode;
  if (typed.kind === 'empty') {
    body = <RecentSearches items={recent.items} onPick={pickRecent} onClear={recent.clear} />;
  } else if (typed.kind === 'tooLong') {
    body = <ErrorText message={t('search.tooLong', { n: SEARCH_MAX_LENGTH })} testID="search-too-long" />;
  } else if (settled.kind !== 'ok') {
    body = <ActivityIndicator testID="search-waiting" style={styles.waiting} />;
  } else {
    body = <SearchResults term={settled.term} completed={completed} onOpen={() => remember(settled.term)} />;
  }

  return (
    <View style={[styles.fill, { backgroundColor: palette.bg }]}>
      <ScreenHeader title={t('search.title')} />
      <View style={styles.top}>
        <View style={[styles.inputBox, { borderColor: palette.line2, backgroundColor: palette.bg }]}>
          <Feather name="search" size={20} color={palette.ink2} />
          <TextInput
            testID="search-input"
            accessibilityLabel={t('search.title')}
            placeholder={t('search.placeholder')}
            placeholderTextColor={palette.mute}
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
            style={[styles.input, { color: palette.ink }]}
          />
          {text.length > 0 ? (
            <IconButton icon="x-circle" label={t('search.clear')} onPress={() => setText('')} testID="search-clear" />
          ) : null}
        </View>
        <View style={[styles.switchRow, { borderBottomColor: palette.line }]}>
          <Text style={[styles.switchLabel, { color: palette.ink }]}>{t('search.completedToggle')}</Text>
          <Toggle
            testID="search-completed"
            label={t('search.completedToggle')}
            value={completed}
            onChange={setCompleted}
          />
        </View>
      </View>
      {body}
    </View>
  );
}

function GroupTitle({ title }: { title: string }) {
  const { palette } = useTheme();
  return <Text style={[styles.groupTitle, { color: palette.mute }]}>{title}</Text>;
}

function RecentSearches({
  items,
  onPick,
  onClear,
}: {
  items: readonly string[];
  onPick: (term: string) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  if (items.length === 0) {
    return (
      <Text testID="search-hint" style={[styles.hint, { color: palette.mute }]}>
        {t('search.hint')}
      </Text>
    );
  }
  return (
    <View testID="search-recent" style={styles.recent}>
      <View style={styles.recentHeader}>
        <GroupTitle title={t('search.recentTitle')} />
        <AppButton variant="ghost" label={t('search.recentClear')} onPress={onClear} testID="search-recent-clear" />
      </View>
      {items.map((term, index) => (
        <Pressable
          key={term}
          testID={`search-recent-${index}`}
          accessibilityRole="button"
          accessibilityLabel={term}
          onPress={() => onPick(term)}
          style={styles.recentRow}
        >
          <Feather name="clock" size={20} color={palette.ink2} />
          <Text style={[styles.recentText, { color: palette.ink }]}>{term}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SearchResults({ term, completed, onOpen }: { term: string; completed: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  const { query, items } = usePagedList(
    queryKeys.search.tasks(term, completed),
    (cursor) => searchApi.tasks(term, completed, cursor),
    taskId,
  );
  const objects = useQuery({
    queryKey: queryKeys.search.objects(term),
    queryFn: () => searchApi.objects(term),
    enabled: !completed,
  });
  const rows = useMemo(() => taskRows(items), [items]);
  const header = completed ? (
    <View testID="search-completed-title" style={styles.objects}>
      <GroupTitle title={t('search.completedTitle')} />
    </View>
  ) : (
    <SearchObjectsBlock objects={objects.data} onOpen={onOpen} />
  );
  return (
    <TaskListView
      rows={rows}
      query={query}
      header={header}
      empty={
        <StateView
          tone="ok"
          icon={completed ? 'check-circle' : 'search'}
          title={completed ? t('search.noCompleted') : t('search.noTasks')}
          testID="search-results-empty"
        />
      }
      showProject
      testID="search-results"
    />
  );
}

function SearchObjectsBlock({ objects, onOpen }: { objects: SearchObjects | undefined; onOpen: () => void }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const open = (href: string) => {
    onOpen();
    router.push(href);
  };
  return (
    <View style={styles.objects}>
      {objects && objects.projects.length > 0 ? (
        <>
          <GroupTitle title={t('search.groups.projects')} />
          {objects.projects.map((project) => (
            <ListRow
              key={project.id}
              testID={`search-project-${project.id}`}
              title={project.name}
              icon="hash"
              iconColor={projectColorHex(project.color)}
              onPress={() => open(`/project/${project.id}`)}
            />
          ))}
        </>
      ) : null}
      {objects && objects.sections.length > 0 ? (
        <>
          <GroupTitle title={t('search.groups.sections')} />
          {objects.sections.map((section) => (
            <ListRow
              key={section.id}
              testID={`search-section-${section.id}`}
              title={section.name}
              icon="layers"
              iconColor={palette.ink2}
              right={section.projectName}
              onPress={() => open(`/project/${section.projectId}`)}
            />
          ))}
        </>
      ) : null}
      {objects && objects.labels.length > 0 ? (
        <>
          <GroupTitle title={t('search.groups.labels')} />
          {objects.labels.map((label) => (
            <ListRow
              key={label.id}
              testID={`search-label-${label.id}`}
              title={label.name}
              icon="tag"
              iconColor={projectColorHex(label.color)}
              onPress={() => open(`/label/${label.id}`)}
            />
          ))}
        </>
      ) : null}
      {objects && objects.filters.length > 0 ? (
        <>
          <GroupTitle title={t('search.groups.filters')} />
          {objects.filters.map((filter) => (
            <ListRow
              key={filter.id}
              testID={`search-filter-${filter.id}`}
              title={filter.name}
              icon="filter"
              iconColor={projectColorHex(filter.color)}
              onPress={() => open(`/filter/${filter.id}`)}
            />
          ))}
        </>
      ) : null}
      {objects?.comments && objects.comments.length > 0 ? (
        <>
          <GroupTitle title={t('comments.searchGroup')} />
          {objects.comments.map((comment) => (
            <ListRow
              key={comment.id}
              testID={`search-comment-${comment.id}`}
              title={comment.content}
              icon="message-circle"
              iconColor={palette.ink2}
              right={comment.taskContent ?? comment.projectName}
              onPress={() => open(comment.taskId ? `/task/${comment.taskId}` : `/project-comments/${comment.projectId}`)}
            />
          ))}
        </>
      ) : null}
      <GroupTitle title={t('search.groups.tasks')} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { paddingHorizontal: 20 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 14,
  },
  input: { ...type.body, flex: 1, height: 48 },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: 1 },
  switchLabel: { ...type.body, flex: 1 },
  waiting: { padding: 24 },
  hint: { ...type.body, textAlign: 'center', padding: 32 },
  recent: { paddingHorizontal: 20 },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  recentText: { ...type.body },
  objects: { paddingHorizontal: 20 },
  groupTitle: { ...type.caption, fontFamily: fonts.semibold, paddingTop: 12, paddingBottom: 4 },
});
