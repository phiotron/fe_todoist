import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, type, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';

export interface SegmentedOption<K extends string> {
  key: K;
  label: string;
}

interface SegmentedProps<K extends string> {
  options: readonly SegmentedOption<K>[];
  value: K;
  onChange: (key: K) => void;
  testID?: string;
}

/** .seg: side-coloured track, the selected option is a raised white pill (radio group for screen readers). */
export function Segmented<K extends string>({ options, value, onChange, testID = 'segmented' }: SegmentedProps<K>) {
  const styles = useThemedStyles(createSegmentedStyles);
  const { palette } = useTheme();
  return (
    <View style={styles.track} accessibilityRole="radiogroup" testID={testID}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            testID={`${testID}-${option.key}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text style={[type.buttonSmall, { color: selected ? palette.ink : palette.ink2 }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createSegmentedStyles(palette: Palette) {
  return StyleSheet.create({
    track: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: radius.control, backgroundColor: palette.side },
    option: { flex: 1, height: 38, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center' },
    selected: { backgroundColor: palette.bg, elevation: 1, shadowColor: palette.ink, shadowOpacity: 0.12, shadowRadius: 3 },
  });
}
