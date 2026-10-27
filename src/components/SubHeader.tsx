import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { type, useThemedStyles } from '../theme';
import type { Palette } from '../theme/palette';
import { IconButton } from './IconButton';
import { useTopInset } from './useTopInset';

interface SubHeaderProps {
  title?: string;
  /** Omitted on a tab screen (no screen to go back to): no back button. */
  onBack?: () => void;
  /** Replaces the title (task detail breadcrumb). */
  center?: ReactNode;
  right?: ReactNode;
  testID?: string;
}

/** Top bar of a pushed screen (M-Completed, M-TaskDetail): back 44 + 20/700 title + actions. */
export function SubHeader({ title, onBack, center, right, testID = 'sub-header' }: SubHeaderProps) {
  const styles = useThemedStyles(createSubHeaderStyles);
  const { t } = useTranslation();
  const top = useTopInset();
  return (
    <View testID={testID} style={[styles.row, { paddingTop: top }]}>
      {onBack ? <IconButton icon="chevron-left" label={t('common.back')} onPress={onBack} testID={`${testID}-back`} /> : null}
      <View style={styles.center}>
        {center ?? (
          <Text style={[type.barTitle, styles.title]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

function createSubHeaderStyles(palette: Palette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4, backgroundColor: palette.bg },
    center: { flex: 1 },
    title: { color: palette.ink },
  });
}
