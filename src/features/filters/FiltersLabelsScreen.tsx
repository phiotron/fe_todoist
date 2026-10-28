import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import type { Filter } from '../../api/filters';
import type { Label } from '../../api/labels';
import { ActionMenu, type ActionMenuItem } from '../../components/ActionMenu';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { ListRow } from '../../components/ListRow';
import { QueryStateView } from '../../components/QueryStateView';
import { ReorderModal } from '../../components/ReorderModal';
import { SectionHeader } from '../../components/SectionHeader';
import { SubHeader } from '../../components/SubHeader';
import { gutter, layout, size, space, type, useTheme } from '../../theme';
import { SwipeToFavorite } from '../browse/SwipeToFavorite';
import { LabelFormSheet } from '../labels/LabelFormSheet';
import { useDeleteLabel, useLabels, useReorderLabel, useSetLabelFavorite } from '../labels/useLabels';
import { projectColorHex } from '../projects/appearance';
import { FilterFormSheet } from './FilterFormSheet';
import { useDeleteFilter, useFilters, useReorderFilter, useSetFilterFavorite } from './useFilters';

type Kind = 'label' | 'filter';
type Target = { kind: 'label'; item: Label } | { kind: 'filter'; item: Filter };

/** Filters & Labels (design M-Filters): two blocks; tap opens, long-press = menu, swipe right = favorite. */
export function FiltersLabelsScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { query: filtersQuery, filters } = useFilters();
  const { query: labelsQuery, labels } = useLabels();
  const setLabelFavorite = useSetLabelFavorite();
  const setFilterFavorite = useSetFilterFavorite();
  const deleteLabel = useDeleteLabel();
  const deleteFilter = useDeleteFilter();
  const reorderLabel = useReorderLabel();
  const reorderFilter = useReorderFilter();
  const [menuTarget, setMenuTarget] = useState<Target | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Target | null>(null);
  const [labelForm, setLabelForm] = useState<{ label?: Label } | null>(null);
  const [filterForm, setFilterForm] = useState<{ filter?: Filter } | null>(null);
  const [reorderKind, setReorderKind] = useState<Kind | null>(null);

  function toggleFavorite(target: Target) {
    const variables = { id: target.item.id, favorite: !target.item.isFavorite };
    if (target.kind === 'label') setLabelFavorite.mutate(variables);
    else setFilterFavorite.mutate(variables);
  }

  function actionsFor(target: Target): ActionMenuItem[] {
    return [
      {
        key: 'edit',
        label: t('filtersLabels.actions.edit'),
        icon: 'edit-2',
        onPress: () =>
          target.kind === 'label' ? setLabelForm({ label: target.item }) : setFilterForm({ filter: target.item }),
      },
      {
        key: 'favorite',
        label: target.item.isFavorite ? t('filtersLabels.actions.unfavorite') : t('filtersLabels.actions.favorite'),
        icon: 'heart',
        onPress: () => toggleFavorite(target),
        requiresOnline: true,
      },
      {
        key: 'reorder',
        label: target.kind === 'label' ? t('filtersLabels.reorderLabels') : t('filtersLabels.reorderFilters'),
        icon: 'list',
        onPress: () => setReorderKind(target.kind),
      },
      {
        key: 'delete',
        label: t('filtersLabels.actions.delete'),
        icon: 'trash-2',
        onPress: () => setDeleteTarget(target),
        destructive: true,
        requiresOnline: true,
      },
    ];
  }

  const deleting = deleteTarget?.kind === 'filter' ? deleteFilter : deleteLabel;

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'label') await deleteLabel.mutateAsync(deleteTarget.item.id);
      else await deleteFilter.mutateAsync(deleteTarget.item.id);
      setDeleteTarget(null);
    } catch {
      // The dialog shows deleting.error and stays open for a retry.
    }
  }

  function cancelDelete() {
    deleteLabel.reset();
    deleteFilter.reset();
    setDeleteTarget(null);
  }

  let deleteMessage: string | undefined;
  if (deleteTarget?.kind === 'label') deleteMessage = t('labels.delete.message', { name: deleteTarget.item.name });
  if (deleteTarget?.kind === 'filter') deleteMessage = t('filters.delete.message', { name: deleteTarget.item.name });

  const actionError = setLabelFavorite.error ?? setFilterFavorite.error ?? reorderLabel.error ?? reorderFilter.error;
  const reorderItems = (reorderKind === 'label' ? labels : filters).map((item) => ({ id: item.id, label: item.name }));

  function row(target: Target) {
    const { item } = target;
    const prefix = `fl-${target.kind}-${item.id}`;
    return (
      <SwipeToFavorite
        key={prefix}
        isFavorite={item.isFavorite}
        onToggle={() => toggleFavorite(target)}
        testID={`${prefix}-swipe`}
      >
        {/* The swipe's heart action lies under the row (absoluteFill): the row must be opaque or it shows through. */}
        <View style={[styles.pad, { backgroundColor: palette.bg }]}>
          <ListRow
            testID={prefix}
            title={item.name}
            icon={target.kind === 'label' ? 'tag' : 'filter'}
            iconColor={projectColorHex(item.color)}
            right={
              item.isFavorite ? (
                <View testID={`${prefix}-favorite`} accessibilityLabel={t('filtersLabels.favoriteMark')}>
                  <Feather name="heart" size={16} color={palette.mute} />
                </View>
              ) : undefined
            }
            onPress={() => router.push(target.kind === 'label' ? `/label/${item.id}` : `/filter/${item.id}`)}
            onLongPress={() => setMenuTarget(target)}
          />
        </View>
      </SwipeToFavorite>
    );
  }

  function block(kind: Kind) {
    const isLabel = kind === 'label';
    const query = isLabel ? labelsQuery : filtersQuery;
    const targets: Target[] = isLabel
      ? labels.map((item) => ({ kind: 'label', item }))
      : filters.map((item) => ({ kind: 'filter', item }));
    const id = isLabel ? 'fl-labels' : 'fl-filters';
    let body;
    if (targets.length > 0) body = targets.map(row);
    else if (query.isPending || query.isError)
      body = (
        <View style={styles.pad}>
          <QueryStateView query={query} testID={`${id}-state`} />
        </View>
      );
    else
      body = (
        <Text testID={`${id}-empty`} style={[styles.empty, { color: palette.mute }]}>
          {isLabel ? t('filtersLabels.noLabels') : t('filtersLabels.noFilters')}
        </Text>
      );
    return (
      <View testID={id} style={isLabel ? styles.laterBlock : undefined}>
        <View style={styles.pad}>
          <SectionHeader
            title={isLabel ? t('filtersLabels.labelsTitle') : t('filtersLabels.filtersTitle')}
            testID={`${id}-header`}
            right={
              <IconButton
                icon="plus"
                label={isLabel ? t('filtersLabels.addLabel') : t('filtersLabels.addFilter')}
                onPress={() => (isLabel ? setLabelForm({}) : setFilterForm({}))}
                requiresOnline
                testID={`${id}-add`}
              />
            }
          />
        </View>
        {body}
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: palette.bg }]}>
      <SubHeader
        title={t('filtersLabels.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/browse'))}
      />
      <ErrorText message={actionError ? describeError(actionError).message : undefined} testID="fl-error" />
      <ScrollView testID="fl-scroll" contentContainerStyle={styles.content}>
        {block('filter')}
        {block('label')}
      </ScrollView>
      <ActionMenu
        visible={menuTarget !== null}
        title={menuTarget?.item.name}
        items={menuTarget ? actionsFor(menuTarget) : []}
        onClose={() => setMenuTarget(null)}
        testID="fl-actions"
      />
      <ConfirmDialog
        visible={deleteTarget !== null}
        title={deleteTarget?.kind === 'filter' ? t('filters.delete.title') : t('labels.delete.title')}
        message={deleteMessage}
        confirmLabel={t('filtersLabels.actions.delete')}
        onConfirm={() => void confirmDelete()}
        onCancel={cancelDelete}
        busy={deleting.isPending}
        error={deleting.error ? describeError(deleting.error).message : undefined}
        testID="fl-delete"
      />
      <LabelFormSheet visible={labelForm !== null} label={labelForm?.label} onClose={() => setLabelForm(null)} />
      <FilterFormSheet visible={filterForm !== null} filter={filterForm?.filter} onClose={() => setFilterForm(null)} />
      <ReorderModal
        visible={reorderKind !== null}
        title={reorderKind === 'label' ? t('filtersLabels.reorderLabels') : t('filtersLabels.reorderFilters')}
        items={reorderItems}
        onMove={(id, afterId) =>
          reorderKind === 'label' ? reorderLabel.mutate({ id, afterId }) : reorderFilter.mutate({ id, afterId })
        }
        onClose={() => setReorderKind(null)}
        testID="fl-reorder"
      />
    </View>
  );
}

/**
 * The tab layout's + floats `layout.fabBottom` above the screen bottom (left / centre / right, M3x): the list ends this
 * far below its last row so that row can scroll clear of the button whatever the tab bar / navigation bar height.
 */
const FAB_CLEARANCE = layout.fabBottom + size.fab + space.m;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // No side padding here: rows pad themselves so the swipe action spans the full width (as Browse → Favorites).
  content: { paddingBottom: FAB_CLEARANCE },
  pad: { paddingHorizontal: gutter },
  /** Design M-Filters: 24 above the Labels heading. */
  laterBlock: { marginTop: space.xl },
  empty: { ...type.meta, paddingVertical: 12, paddingHorizontal: gutter },
});
