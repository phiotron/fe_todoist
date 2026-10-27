import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { size, type, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';
import { AppButton } from './AppButton';
import type { IconName } from './IconButton';

interface StateViewProps {
  /** ok = empty / done (soft accent circle), error = load failure (p1s circle, warn icon). */
  tone: 'ok' | 'error';
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

/** Centered state of M-Empty / M-Error: 96px circle, 20/700 title, muted sentence, primary button. */
export function StateView({ tone, icon, title, message, actionLabel, onAction, testID = 'state' }: StateViewProps) {
  const styles = useThemedStyles(createStateViewStyles);
  const { palette } = useTheme();
  const circle = tone === 'ok' ? palette.soft : palette.p1s;
  const iconColor = tone === 'ok' ? palette.acc2 : palette.warn;
  return (
    <View style={styles.box} testID={testID}>
      <View style={[styles.circle, { backgroundColor: circle }]}>
        <Feather name={icon} size={44} color={iconColor} />
      </View>
      <Text style={styles.title} accessibilityRole={tone === 'error' ? 'alert' : 'header'}>
        {title}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? <AppButton label={actionLabel} onPress={onAction} testID={`${testID}-action`} /> : null}
    </View>
  );
}

function createStateViewStyles(palette: Palette) {
  return StyleSheet.create({
    box: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32, paddingVertical: 48 },
    circle: { width: size.stateIcon, height: size.stateIcon, borderRadius: size.stateIcon / 2, alignItems: 'center', justifyContent: 'center' },
    title: { ...type.stateTitle, color: palette.ink, marginTop: 8, textAlign: 'center' },
    message: { ...type.body, color: palette.mute, textAlign: 'center' },
  });
}
