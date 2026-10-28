import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

/** Thin goal / level progress bar; `ratio` 0..1. */
export function ProgressBar({ ratio, testID = 'progress-bar' }: { ratio: number; testID?: string }) {
  const styles = useThemedStyles(createStyles);
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.track}
    >
      <View testID={`${testID}-fill`} style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    track: { height: 10, borderRadius: 5, backgroundColor: palette.soft, overflow: 'hidden' },
    fill: { height: 10, borderRadius: 5, backgroundColor: palette.acc },
  });
}
