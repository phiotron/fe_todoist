import { StyleSheet, Text } from 'react-native';
import { palette, type } from '../theme';

/** .err: 13px warn under a field or a form. */
export function ErrorText({ message, testID }: { message: string | undefined; testID?: string }) {
  if (!message) return null;
  return (
    <Text testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({ error: { ...type.meta, color: palette.warn, marginTop: 6 } });
