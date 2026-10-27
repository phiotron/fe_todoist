import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { Filter } from '../../api/filters';
import { filterSyntaxPosition, hasProblemCode } from '../../api/problem';
import { ActionMenu } from '../../components/ActionMenu';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { NotFoundView } from '../../components/NotFoundView';
import { QueryStateView } from '../../components/QueryStateView';
import { StateView } from '../../components/StateView';
import { SubHeader } from '../../components/SubHeader';
import { type, useTheme } from '../../theme';
import { DisplaySheet } from '../display/DisplaySheet';
import { filterViewKey } from '../display/displayRules';
import { displayRows } from '../display/groupTasks';
import { useGroupContext } from '../display/useGroupContext';
import { useViewDisplay, type ViewDisplay } from '../display/useViewDisplay';
import { nodeRow, sectionRow, type TaskListRow } from '../tasks/taskRows';
import { TaskListView } from '../tasks/TaskListView';
import { FilterFormSheet } from './FilterFormSheet';
import { describeFilterSyntax } from './filterSyntaxMessage';
import { MAX_FILTER_PARTS, useFilterTaskLists } from './useFilterTaskLists';
import { useDeleteFilter, useFilterValidation, useFilters, useSetFilterFavorite } from './useFilters';

/** filter/[id]: open tasks matching the query, one block per top-level comma part (spec 9.5). */
export function FilterScreen({ filterId, tab = false }: { filterId: string; tab?: boolean }) {
  const { query, filters } = useFilters();
  const filter = filters.find((item) => item.id === filterId);
  if (filter) return <FilterView filter={filter} tab={tab} />;
  if (query.isSuccess) return <NotFoundView onBack={() => router.back()} testID="filter-not-found" />;
  return <QueryStateView query={query} testID="filter-state" />;
}

type Sheet = 'display' | 'menu' | 'edit' | 'delete' | null;

function FilterView({ filter, tab }: { filter: Filter; tab: boolean }) {
  const { palette } = useTheme();
  const { t } = useTranslation();
  const viewKey = filterViewKey(filter.id);
  const display = useViewDisplay(viewKey);
  const validation = useFilterValidation(filter.query);
  const setFavorite = useSetFilterFavorite();
  const remove = useDeleteFilter();
  const [sheet, setSheet] = useState<Sheet>(null);

  async function confirmDelete() {
    try {
      await remove.mutateAsync(filter.id);
      setSheet(null);
      router.back();
    } catch {
      // Shown in the dialog.
    }
  }

  let body;
  if (hasProblemCode(validation.error, 'filter-syntax')) {
    body = (
      <View testID="filter-syntax-error" style={styles.syntax}>
        <ErrorText message={describeFilterSyntax(filter.query, filterSyntaxPosition(validation.error))} />
        <AppButton
          variant="outline"
          label={t('filters.syntax.edit')}
          onPress={() => setSheet('edit')}
          testID="filter-syntax-edit"
        />
      </View>
    );
  } else if (validation.isError) {
    body = <QueryStateView query={validation} testID="filter-validate-state" />;
  } else if (!validation.data || !display.ready) {
    body = <ActivityIndicator testID="filter-loading" style={styles.loading} />;
  } else {
    body = <FilterTasks parts={validation.data.parts} display={display} />;
  }

  return (
    <View style={[styles.fill, { backgroundColor: palette.bg }]}>
      <SubHeader
        onBack={tab ? undefined : () => router.back()}
        center={
          <View>
            <Text style={[type.barTitle, { color: palette.ink }]} numberOfLines={1} accessibilityRole="header">
              {filter.name}
            </Text>
            <Text style={[type.meta, { color: palette.mute }]} numberOfLines={1}>
              {filter.query}
            </Text>
          </View>
        }
        right={
          <View style={styles.headerActions}>
            <IconButton
              icon="sliders"
              label={t('display.open')}
              onPress={() => setSheet('display')}
              testID="filter-display-button"
            />
            <IconButton
              icon="more-horizontal"
              label={t('filters.screen.menu')}
              onPress={() => setSheet('menu')}
              testID="filter-menu-button"
            />
          </View>
        }
      />
      {body}
      <DisplaySheet visible={sheet === 'display'} viewKey={viewKey} onClose={() => setSheet(null)} />
      <ActionMenu
        visible={sheet === 'menu'}
        title={filter.name}
        onClose={() => setSheet(null)}
        testID="filter-actions"
        items={[
          { key: 'edit', label: t('filtersLabels.actions.edit'), icon: 'edit-2', onPress: () => setSheet('edit') },
          {
            key: 'favorite',
            label: filter.isFavorite ? t('filtersLabels.actions.unfavorite') : t('filtersLabels.actions.favorite'),
            icon: 'heart',
            onPress: () => setFavorite.mutate({ id: filter.id, favorite: !filter.isFavorite }),
            requiresOnline: true,
          },
          {
            key: 'delete',
            label: t('filtersLabels.actions.delete'),
            icon: 'trash-2',
            onPress: () => setSheet('delete'),
            destructive: true,
            requiresOnline: true,
          },
        ]}
      />
      <FilterFormSheet visible={sheet === 'edit'} filter={filter} onClose={() => setSheet(null)} />
      <ConfirmDialog
        visible={sheet === 'delete'}
        title={t('filters.delete.title')}
        message={t('filters.delete.message', { name: filter.name })}
        confirmLabel={t('filters.delete.confirm')}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          remove.reset();
          setSheet(null);
        }}
        busy={remove.isPending}
        error={remove.error ? describeError(remove.error).message : undefined}
        testID="filter-delete"
      />
    </View>
  );
}

/** Row keys must stay unique when one task matches two parts. */
function prefixed(rows: readonly TaskListRow[], prefix: string): TaskListRow[] {
  return rows.map((row) => ({ ...row, key: `${prefix}:${row.key}` }));
}

function FilterTasks({ parts, display }: { parts: readonly string[]; display: ViewDisplay }) {
  const { palette } = useTheme();
  const { t } = useTranslation();
  const { lists, combined, truncated } = useFilterTaskLists(parts, display.params);
  const groupBy = display.options.groupBy;
  const ctx = useGroupContext(groupBy);

  const rows = useMemo(() => {
    if (combined.isPending || combined.isError) return [];
    if (lists.length === 1) return displayRows(lists[0].tasks, groupBy, ctx);
    return lists.flatMap((list, index) => {
      const head = sectionRow(`part-${index}`, { title: list.part });
      if (list.tasks.length === 0) {
        return [
          head,
          nodeRow(
            `part-${index}-empty`,
            <Text testID={`filter-part-${index}-empty`} style={[styles.partEmpty, { color: palette.mute }]}>
              {t('filters.screen.partEmpty')}
            </Text>,
          ),
        ];
      }
      return [head, ...prefixed(displayRows(list.tasks, groupBy, ctx), `part-${index}`)];
    });
  }, [lists, combined.isPending, combined.isError, groupBy, ctx, t]);

  return (
    <View style={styles.fill}>
      {truncated ? (
        <Text testID="filter-parts-truncated" style={[styles.partEmpty, { color: palette.mute }]}>
          {t('filters.screen.truncated', { n: MAX_FILTER_PARTS })}
        </Text>
      ) : null}
      <TaskListView
        rows={rows}
        query={combined}
        empty={<StateView tone="ok" icon="filter" title={t('filters.screen.empty')} testID="filter-tasks-empty" />}
        showProject
        testID="filter-tasks"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerActions: { flexDirection: 'row' },
  loading: { padding: 24 },
  syntax: { padding: 20, gap: 12 },
  partEmpty: { ...type.meta, paddingHorizontal: 20, paddingVertical: 8 },
});
