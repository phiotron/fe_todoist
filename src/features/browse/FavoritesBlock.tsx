import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { gutter, palette, type } from '../../theme';
import { useFilters } from '../filters/useFilters';
import { useLabels } from '../labels/useLabels';
import { useProjects } from '../projects/useProjects';
import { BrowseProjectRow } from './BrowseProjectRow';
import { FavoriteItemRow } from './FavoriteItemRow';
import { resolveFavorites } from './resolveFavorites';
import { useFavoriteTargets } from './useFavoriteTargets';

/** "Yêu thích": favorite projects, labels and filters in the order they were added (spec 5.7, 9.2). */
export function FavoritesBlock() {
  const { t } = useTranslation();
  const favorites = useFavoriteTargets();
  const { all } = useProjects();
  const wantsLabels = favorites.some((favorite) => favorite.targetType === 'LABEL');
  const wantsFilters = favorites.some((favorite) => favorite.targetType === 'FILTER');
  const { labels } = useLabels(wantsLabels);
  const { filters } = useFilters(wantsFilters);
  const entries = useMemo(() => resolveFavorites(favorites, all, labels, filters), [favorites, all, labels, filters]);
  if (entries.length === 0) return null;
  return (
    <View>
      <Text style={styles.title} accessibilityRole="header">
        {t('browse.favorites')}
      </Text>
      {entries.map((entry) =>
        entry.type === 'PROJECT' ? (
          <BrowseProjectRow key={`PROJECT-${entry.id}`} project={entry.project} idPrefix="favorite-project" />
        ) : (
          <FavoriteItemRow key={`${entry.type}-${entry.id}`} entry={entry} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...type.section, color: palette.ink, paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 4 },
});
