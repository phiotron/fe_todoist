import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ListRow } from '../../components/ListRow';
import { gutter, useTheme } from '../../theme';
import { useSetFilterFavorite } from '../filters/useFilters';
import { useSetLabelFavorite } from '../labels/useLabels';
import { projectColorHex } from '../projects/appearance';
import type { FavoriteEntry } from './resolveFavorites';
import { SwipeToFavorite } from './SwipeToFavorite';

type LabelOrFilterEntry = Exclude<FavoriteEntry, { type: 'PROJECT' }>;

/** A favorite label / filter in Browse → Favorites; swipe right removes it from favorites (spec 9.2). */
export function FavoriteItemRow({ entry }: { entry: LabelOrFilterEntry }) {
  const { palette } = useTheme();
  const setLabelFavorite = useSetLabelFavorite();
  const setFilterFavorite = useSetFilterFavorite();
  const isLabel = entry.type === 'LABEL';
  const item = entry.type === 'LABEL' ? entry.label : entry.filter;
  const testID = `favorite-${isLabel ? 'label' : 'filter'}-${item.id}`;
  return (
    <SwipeToFavorite
      isFavorite
      onToggle={() =>
        isLabel
          ? setLabelFavorite.mutate({ id: item.id, favorite: false })
          : setFilterFavorite.mutate({ id: item.id, favorite: false })
      }
      testID={`${testID}-swipe`}
    >
      <View style={[styles.pad, { backgroundColor: palette.bg }]}>
        <ListRow
          testID={testID}
          title={item.name}
          icon={isLabel ? 'tag' : 'filter'}
          iconColor={projectColorHex(item.color)}
          onPress={() => router.push(isLabel ? `/label/${item.id}` : `/filter/${item.id}`)}
        />
      </View>
    </SwipeToFavorite>
  );
}

const styles = StyleSheet.create({ pad: { paddingHorizontal: gutter } });
