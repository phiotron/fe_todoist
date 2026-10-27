import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { radius, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

/** Logo row at the top of the M-Auth frame: accent square with a check mark + "Taskly" 24/700. Taskly's own mark. */
export function AuthLogo() {
  const styles = useThemedStyles(createAuthLogoStyles);
  const { palette } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header">
      <View testID="auth-logo-mark" style={styles.mark}>
        <Feather name="check" size={24} color={palette.onacc} />
      </View>
      <Text style={styles.name}>Taskly</Text>
    </View>
  );
}

function createAuthLogoStyles(palette: Palette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
    mark: {
      width: 40,
      height: 40,
      borderRadius: radius.card,
      backgroundColor: palette.acc,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { ...type.screenTitle, fontSize: 24, color: palette.ink, letterSpacing: -0.48 },
  });
}
