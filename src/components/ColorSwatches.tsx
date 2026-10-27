import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { PROJECT_COLORS, type ProjectColor } from '../api/models';
import { projectColorHex } from '../features/projects/appearance';
import { useTheme } from '../theme';

interface ColorSwatchesProps {
  value: ProjectColor;
  onChange: (color: ProjectColor) => void;
  testID?: string;
}

/** The 20 colour keys of projects, labels and filters (spec 10.1): round swatches, a tick on the chosen one. */
export function ColorSwatches({ value, onChange, testID = 'color-swatches' }: ColorSwatchesProps) {
  const { palette } = useTheme();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {PROJECT_COLORS.map((color) => {
        const selected = color === value;
        return (
          <Pressable
            key={color}
            testID={`${testID}-${color}`}
            accessibilityRole="radio"
            accessibilityLabel={color}
            accessibilityState={{ selected }}
            hitSlop={4}
            onPress={() => onChange(color)}
            style={[styles.swatch, { backgroundColor: projectColorHex(color) }, selected && { borderColor: palette.ink }]}
          >
            {selected ? <Feather name="check" size={16} color="#FFFFFF" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 4 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
