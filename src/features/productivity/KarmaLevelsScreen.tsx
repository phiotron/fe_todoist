import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SubHeader } from '../../components/SubHeader';
import { gutter, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { KARMA_LEVELS } from './productivityModel';
import { useProductivity } from './useProductivity';

/** About Karma levels (M10, design M-Productivity): intro, point rules and the 8 levels; the current one is marked. */
export function KarmaLevelsScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { data } = useProductivity();
  const levels = data?.karma?.levels ?? KARMA_LEVELS;
  const current = data?.karma?.level;
  return (
    <View style={styles.fill} testID="karma-levels-screen">
      <SubHeader title={t('productivity.karma.aboutTitle')} onBack={() => router.back()} testID="karma-levels-header" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>{t('productivity.karma.aboutIntro')}</Text>
        <Text style={styles.body}>{t('productivity.karma.aboutRules')}</Text>
        {levels.map((entry) => (
          <View key={entry.level} style={[styles.row, entry.level === current && styles.current]} testID={`karma-level-${entry.level}`}>
            <Text style={styles.name}>{t(`productivity.levels.${entry.level}`)}</Text>
            <Text style={styles.min}>
              {entry.level === current
                ? `${t('productivity.karma.current')} · ${t('productivity.karma.minKarma', { n: entry.minKarma })}`
                : t('productivity.karma.minKarma', { n: entry.minKarma })}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: gutter, paddingBottom: 40, gap: 12 },
    body: { ...type.body, color: palette.ink2 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.line },
    current: { backgroundColor: palette.soft, borderColor: palette.acc },
    name: { ...type.bodyStrong, color: palette.ink },
    min: { ...type.meta, color: palette.mute },
  });
}
