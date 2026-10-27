import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { gutter, palette, type } from '../../theme';
import { useFavoriteProjects } from '../projects/useProjects';
import { BrowseProjectRow } from './BrowseProjectRow';

/** "Yêu thích": favorite projects in the order they were added (spec 5.7). M2 adds LABEL / FILTER rows here. */
export function FavoritesBlock() {
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

const styles = StyleSheet.create({
  title: { ...type.section, color: palette.ink, paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 4 },
});
