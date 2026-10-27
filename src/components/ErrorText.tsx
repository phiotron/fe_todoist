import { StyleSheet, Text } from 'react-native';
import { type, useThemedStyles } from '../theme';
import type { Palette } from '../theme/palette';

/** .err: 13px warn under a field or a form. */
export function ErrorText({ message, testID }: { message: string | undefined; testID?: string }) {
  const styles = useThemedStyles(createErrorTextStyles);
  if (!message) return null;
  return (
    <Text testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
      {message}
    </Text>
  );
}

function createErrorTextStyles(palette: Palette) {
  return StyleSheet.create({ error: { ...type.meta, color: palette.warn, marginTop: 6 } });
}
