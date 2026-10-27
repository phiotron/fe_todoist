import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { gutter, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useFavoriteProjects } from '../projects/useProjects';
import { BrowseProjectRow } from './BrowseProjectRow';

/** "Yêu thích": favorite projects in the order they were added (spec 5.7). M2 adds LABEL / FILTER rows here. */
export function FavoritesBlock() {
  const styles = useThemedStyles(createFavoritesBlockStyles);
  const { t } = useTranslation();
  const favorites = useFavoriteProjects();
  if (favorites.length === 0) return null;
  return (
    <View>
      <Text style={styles.title} accessibilityRole="header">
        {t('browse.favorites')}
      </Text>
      {favorites.map((project) => (
        <BrowseProjectRow key={project.id} project={project} idPrefix="favorite-project" />
      ))}
    </View>
  );
}

function createFavoritesBlockStyles(palette: Palette) {
  return StyleSheet.create({
    title: { ...type.section, color: palette.ink, paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 4 },
  });
}
