import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '../../components/Chip';
import { gutter, type, useTheme } from '../../theme';
import { useLabels } from '../labels/useLabels';

/** "Labels" block at the bottom of Browse (M-Browse): one chip per label; hidden when there is none. */
export function BrowseLabels() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { labels } = useLabels();
  if (labels.length === 0) return null;
  return (
    <View>
      <Text testID="browse-labels-header" accessibilityRole="header" style={[type.section, styles.title, { color: palette.ink }]}>
        {t('filtersLabels.labelsTitle')}
      </Text>
      <View style={styles.chips}>
        {labels.map((label) => (
          <Chip
            key={label.id}
            label={label.name}
            icon="tag"
            onPress={() => router.push(`/label/${label.id}`)}
            testID={`browse-label-${label.id}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: gutter, paddingTop: 8 },
});
