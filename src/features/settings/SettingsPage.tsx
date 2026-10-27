import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { KeyboardScreen } from '../../components/KeyboardScreen';
import { SubHeader } from '../../components/SubHeader';
import { useSettingsStyles } from './ui';

interface SettingsPageProps {
  testID: string;
  title: string;
  children: ReactNode;
  /** Defaults to router.back(). */
  onBack?: () => void;
}

/** Frame of every settings page (M-Settings): back button + title (20/700), then scrollable content with 20 margins. */
export function SettingsPage({ testID, title, children, onBack }: SettingsPageProps) {
  const styles = useSettingsStyles();
  return (
    <View testID={testID} style={styles.page}>
      <SubHeader title={title} onBack={onBack ?? (() => router.back())} />
      <KeyboardScreen contentStyle={styles.content}>{children}</KeyboardScreen>
    </View>
  );
}
