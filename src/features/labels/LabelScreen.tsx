import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { Label } from '../../api/labels';
import { ActionMenu } from '../../components/ActionMenu';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { IconButton } from '../../components/IconButton';
import { NotFoundView } from '../../components/NotFoundView';
import { QueryStateView } from '../../components/QueryStateView';
import { StateView } from '../../components/StateView';
import { SubHeader } from '../../components/SubHeader';
import { useTheme } from '../../theme';
import { DisplaySheet } from '../display/DisplaySheet';
import { labelViewKey } from '../display/displayRules';
import { displayRows } from '../display/groupTasks';
import { useGroupContext } from '../display/useGroupContext';
import { useViewDisplay, type ViewDisplay } from '../display/useViewDisplay';
import { TaskListView } from '../tasks/TaskListView';
import { useTaskList } from '../tasks/useTaskList';
import { LabelFormSheet } from './LabelFormSheet';
import { useDeleteLabel, useLabels, useSetLabelFavorite } from './useLabels';

/** label/[id]: open tasks of one label (GET tasks?labelId=) with its own Display. */
export function LabelScreen({ labelId, tab = false }: { labelId: string; tab?: boolean }) {
  const { query, labels } = useLabels();
  const label = labels.find((item) => item.id === labelId);
  if (label) return <LabelView label={label} tab={tab} />;
  // No GET labels/{id} (spec 12.7): a loaded list without the id means it is gone (spec 9.3, 404 rule).
  if (query.isSuccess) return <NotFoundView onBack={() => router.back()} testID="label-not-found" />;
  return <QueryStateView query={query} testID="label-state" />;
}

type Sheet = 'display' | 'menu' | 'edit' | 'delete' | null;

function LabelView({ label, tab }: { label: Label; tab: boolean }) {
  const { palette } = useTheme();
  const { t } = useTranslation();
  const viewKey = labelViewKey(label.id);
  const display = useViewDisplay(viewKey);
  const setFavorite = useSetLabelFavorite();
  const remove = useDeleteLabel();
  const [sheet, setSheet] = useState<Sheet>(null);

  async function confirmDelete() {
    try {
      await remove.mutateAsync(label.id);
      setSheet(null);
      router.back();
    } catch {
      // Shown in the dialog.
    }
  }

  return (
    <View style={[styles.fill, { backgroundColor: palette.bg }]}>
      <SubHeader
        title={label.name}
        onBack={tab ? undefined : () => router.back()}
        right={
          <View style={styles.headerActions}>
            <IconButton
              icon="sliders"
              label={t('display.open')}
              onPress={() => setSheet('display')}
              testID="label-display-button"
            />
            <IconButton
              icon="more-horizontal"
              label={t('labels.screen.menu')}
              onPress={() => setSheet('menu')}
              testID="label-menu-button"
            />
          </View>
        }
      />
      {display.ready ? (
        <LabelTasks labelId={label.id} display={display} />
      ) : (
        <ActivityIndicator testID="label-display-loading" style={styles.loading} />
      )}
      <DisplaySheet visible={sheet === 'display'} viewKey={viewKey} onClose={() => setSheet(null)} />
      <ActionMenu
        visible={sheet === 'menu'}
        title={label.name}
        onClose={() => setSheet(null)}
        testID="label-actions"
        items={[
          { key: 'edit', label: t('filtersLabels.actions.edit'), icon: 'edit-2', onPress: () => setSheet('edit') },
          {
            key: 'favorite',
            label: label.isFavorite ? t('filtersLabels.actions.unfavorite') : t('filtersLabels.actions.favorite'),
            icon: 'heart',
            onPress: () => setFavorite.mutate({ id: label.id, favorite: !label.isFavorite }),
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
      <LabelFormSheet visible={sheet === 'edit'} label={label} onClose={() => setSheet(null)} />
      <ConfirmDialog
        visible={sheet === 'delete'}
        title={t('labels.delete.title')}
        message={t('labels.delete.message', { name: label.name })}
        confirmLabel={t('labels.delete.confirm')}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          remove.reset();
          setSheet(null);
        }}
        busy={remove.isPending}
        error={remove.error ? describeError(remove.error).message : undefined}
        testID="label-delete"
      />
    </View>
  );
}

function LabelTasks({ labelId, display }: { labelId: string; display: ViewDisplay }) {
  const { t } = useTranslation();
  const { query, tasks } = useTaskList({ labelId, ...display.params });
  const groupBy = display.options.groupBy;
  const ctx = useGroupContext(groupBy);
  const rows = useMemo(() => displayRows(tasks, groupBy, ctx), [tasks, groupBy, ctx]);
  return (
    <TaskListView
      rows={rows}
      query={query}
      empty={<StateView tone="ok" icon="tag" title={t('labels.screen.empty')} testID="label-tasks-empty" />}
      showProject
      testID="label-tasks"
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerActions: { flexDirection: 'row' },
  loading: { padding: 24 },
});
