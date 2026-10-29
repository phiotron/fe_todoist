import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { gutter, radius, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useReviewCount } from './useReview';

/**
 * Card of the Team tab that opens the review screen. Admin: always (number of tasks waiting). Member / Guest: only
 * while one of their own requests waits. Nothing while loading or when the list failed (the Team tab stays quiet).
 */
export function ReviewCard({ isAdmin }: { isAdmin: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const { count, more, isPending, isError } = useReviewCount();
  if (isPending || isError || (!isAdmin && count === 0)) return null;
  const summary = count === 0 ? t('review.cardNone') : more ? t('review.cardCountMore', { n: count }) : t('review.cardCount', { n: count });
  return (
    <Pressable
      testID="team-review-card"
      accessibilityRole="button"
      accessibilityLabel={`${isAdmin ? t('review.title') : t('review.cardMine')}. ${summary}`}
      onPress={() => router.push('/review')}
      style={styles.card}
    >
      <Feather name="clock" size={20} color={palette.vio} />
      <View style={styles.texts}>
        <Text style={styles.title}>{isAdmin ? t('review.title') : t('review.cardMine')}</Text>
        <Text style={styles.summary}>{summary}</Text>
      </View>
      {count > 0 ? (
        <View testID="team-review-badge" style={styles.badge}>
          <Text style={styles.badgeText}>{more ? `${count}+` : count}</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={20} color={palette.mute} />
    </Pressable>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: gutter,
      marginBottom: 8,
      padding: 12,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: palette.line,
      backgroundColor: palette.soft,
    },
    texts: { flex: 1 },
    title: { ...type.body, color: palette.ink },
    summary: { ...type.meta, color: palette.mute },
    badge: { minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.vio },
    badgeText: { ...type.meta, color: palette.bg },
  });
}
