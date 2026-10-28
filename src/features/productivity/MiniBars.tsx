import { StyleSheet, Text, View } from 'react-native';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

export interface MiniBar {
  key: string;
  /** Short caption under the bar (weekday, day of month). */
  label: string;
  /** 0..1 */
  ratio: number;
  /** Drawn in the muted colour (a day off / vacation). */
  muted?: boolean;
  /** Highlighted (reached the goal). */
  strong?: boolean;
  accessibilityLabel?: string;
}

/** Plain-View bar chart (no chart library): one column per entry, colour from the theme (accent, never red). */
export function MiniBars({ bars, testID = 'mini-bars', height = 72 }: { bars: readonly MiniBar[]; testID?: string; height?: number }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View testID={testID} style={styles.row} accessibilityRole="list">
      {bars.map((bar) => (
        <View key={bar.key} style={styles.col} accessible accessibilityLabel={bar.accessibilityLabel ?? bar.label}>
          <View style={[styles.track, { height }]}>
            <View
              testID={`${testID}-${bar.key}`}
              style={[
                styles.fill,
                bar.muted ? styles.muted : bar.strong ? styles.strong : styles.normal,
                { height: Math.max(3, Math.round(height * Math.min(1, Math.max(0, bar.ratio)))) },
              ]}
            />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {bar.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    col: { flex: 1, alignItems: 'center', gap: 4 },
    track: { width: '100%', justifyContent: 'flex-end' },
    fill: { width: '100%', borderRadius: 4 },
    normal: { backgroundColor: palette.line2 },
    strong: { backgroundColor: palette.acc },
    muted: { backgroundColor: palette.line },
    label: { ...type.caption, color: palette.mute },
  });
}
