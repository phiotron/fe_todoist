import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { describeError } from '../../api/describeError';
import { queryKeys } from '../../api/queryKeys';
import { searchApi } from '../../api/search';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { ListRow } from '../../components/ListRow';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import type { NamedDestination } from '../../lib/share/shareDestination';
import { type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { SEARCH_DEBOUNCE_MS, SEARCH_MAX_LENGTH, checkSearchTerm } from '../search/searchTerm';
import { projectDisplayName, projectColorHex } from '../projects/appearance';
import { useProjectNameLabel } from '../projects/useProjectNameLabel';
import { useProjects } from '../projects/useProjects';

interface ShareTargetPickerProps {
  /** Recently used destinations (shown while nothing is typed). */
  recent: readonly NamedDestination[];
  onPick: (destination: NamedDestination) => void;
}

/**
 * Where does the shared text go as a comment: search (open tasks + projects, the existing search API) with the recent
 * destinations and the active projects shown while the box is empty.
 */
export function ShareTargetPicker({ recent, onPick }: ShareTargetPickerProps) {
  const styles = useThemedStyles(createPickerStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const projectLabel = useProjectNameLabel();
  const [text, setText] = useState('');
  const debounced = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);
  const typed = checkSearchTerm(text);
  const settled = checkSearchTerm(debounced);
  const term = typed.kind === 'ok' && settled.kind === 'ok' ? settled.term : null;

  const tasks = useQuery({
    // A first page only (a picker, not a result list); own key because the Search tab keeps an infinite query under search/tasks.
    queryKey: [...queryKeys.search.all, 'share-target', 'tasks', term ?? ''],
    queryFn: () => searchApi.tasks(term ?? '', false, null),
    enabled: term !== null,
  });
  const objects = useQuery({
    queryKey: queryKeys.search.objects(term ?? ''),
    queryFn: () => searchApi.objects(term ?? ''),
    enabled: term !== null,
  });
  const { all: allProjects, query: projectsQuery } = useProjects();

  const toProject = (project: { id: string; isInbox: boolean; name: string }): NamedDestination => ({
    kind: 'project',
    id: project.id,
    name: projectDisplayName(project),
  });

  function row(destination: NamedDestination, subtitle?: string, color?: string) {
    return (
      <ListRow
        key={`${destination.kind}-${destination.id}`}
        testID={`share-target-${destination.kind}-${destination.id}`}
        title={destination.name}
        icon={destination.kind === 'task' ? 'check-circle' : 'folder'}
        iconColor={color}
        right={subtitle ? <Text style={[type.meta, styles.subtitle]} numberOfLines={1}>{subtitle}</Text> : undefined}
        onPress={() => onPick(destination)}
      />
    );
  }

  let body;
  if (typed.kind === 'tooLong') {
    body = <ErrorText testID="share-target-too-long" message={t('shareTarget.searchTooLong', { n: SEARCH_MAX_LENGTH })} />;
  } else if (typed.kind === 'ok') {
    const failure = tasks.error ?? objects.error;
    if (failure) {
      body = (
        <View>
          <ErrorText testID="share-target-error" message={describeError(failure).message} />
          <AppButton
            variant="ghost"
            label={t('shareTarget.retry')}
            onPress={() => {
              void tasks.refetch();
              void objects.refetch();
            }}
            testID="share-target-retry"
          />
        </View>
      );
    } else if (term !== null && tasks.data && objects.data) {
      const projects = objects.data.projects;
      const found = tasks.data.items;
      body =
        projects.length === 0 && found.length === 0 ? (
          <Text testID="share-target-empty" style={[type.body, styles.empty]}>
            {t('shareTarget.noResults')}
          </Text>
        ) : (
          <View>
            {projects.length > 0 ? <GroupTitle title={t('shareTarget.projects')} /> : null}
            {projects.map((project) => row(toProject(project), undefined, projectColorHex(project.color)))}
            {found.length > 0 ? <GroupTitle title={t('shareTarget.tasks')} /> : null}
            {found.map((task) =>
              row({ kind: 'task', id: task.id, name: task.content }, t('shareTarget.inProject', { project: projectLabel(task.projectId, task.projectName) })),
            )}
          </View>
        );
    } else {
      body = <ActivityIndicator testID="share-target-waiting" style={styles.waiting} color={palette.acc} />;
    }
  } else {
    body = (
      <View>
        {recent.length > 0 ? <GroupTitle title={t('shareTarget.recent')} /> : null}
        {recent.map((entry) => row(entry))}
        {allProjects.length > 0 ? <GroupTitle title={t('shareTarget.projects')} /> : null}
        {allProjects.map((project) => row(toProject(project), undefined, projectColorHex(project.color)))}
        {projectsQuery.isError && allProjects.length === 0 ? (
          <ErrorText testID="share-target-projects-error" message={t('shareTarget.loadError')} />
        ) : null}
      </View>
    );
  }

  return (
    <View testID="share-target-picker">
      <View style={[styles.inputBox, { borderColor: palette.line2 }]}>
        <Feather name="search" size={20} color={palette.ink2} />
        <TextInput
          testID="share-target-input"
          accessibilityLabel={t('shareTarget.searchLabel')}
          placeholder={t('shareTarget.searchPlaceholder')}
          placeholderTextColor={palette.mute}
          value={text}
          onChangeText={setText}
          autoCorrect={false}
          style={[styles.input, { color: palette.ink }]}
        />
      </View>
      {body}
    </View>
  );
}

function GroupTitle({ title }: { title: string }) {
  const styles = useThemedStyles(createPickerStyles);
  return <Text style={[type.meta, styles.groupTitle]}>{title}</Text>;
}

function createPickerStyles(palette: Palette) {
  return StyleSheet.create({
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    input: { ...type.body, flex: 1, paddingVertical: 8 },
    groupTitle: { color: palette.mute, marginTop: 10, marginBottom: 2, textTransform: 'uppercase' },
    subtitle: { color: palette.mute, maxWidth: 140 },
    empty: { color: palette.mute, paddingVertical: 16 },
    waiting: { marginTop: 24 },
  });
}
