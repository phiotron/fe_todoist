import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { gutter, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

interface ReviewSelectionBarProps {
  count: number;
  onSelectAll: () => void;
  onApprove: () => void;
  onReject: () => void;
}

/** Bottom bar of the review multi-select: "Chọn tất cả", "Duyệt (n)", "Trả lại (n)". Plain props, no data hook. */
export function ReviewSelectionBar({ count, onSelectAll, onApprove, onReject }: ReviewSelectionBarProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View testID="review-selection-bar" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <AppButton testID="review-select-all" size="sm" variant="ghost" label={t('review.selectAll')} onPress={onSelectAll} />
      <View style={styles.spacer} />
      <AppButton testID="review-batch-approve" size="sm" label={t('review.approveN', { n: count })} disabled={count === 0} onPress={onApprove} />
      <AppButton testID="review-batch-reject" size="sm" variant="outline" label={t('review.rejectN', { n: count })} disabled={count === 0} onPress={onReject} />
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingTop: 8,
      paddingHorizontal: gutter,
      borderTopWidth: 1,
      borderTopColor: palette.line,
      backgroundColor: palette.bg,
    },
    spacer: { flex: 1 },
  });
}
