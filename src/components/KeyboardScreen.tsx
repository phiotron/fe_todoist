import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

interface KeyboardScreenProps {
  children: ReactNode;
  /** Style of the scroll content (padding, centering…). */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Form screen that scrolls and moves up with the keyboard, so the submit button and links stay reachable.
 * "padding" on both platforms: SDK 58 apps are edge-to-edge on Android, where adjustResize no longer shrinks
 * the window, so the view must add the keyboard height itself.
 */
export function KeyboardScreen({ children, contentStyle }: KeyboardScreenProps) {
  return (
    <KeyboardAvoidingView style={styles.fill} behavior="padding" testID="keyboard-screen">
      <ScrollView
        testID="keyboard-screen-scroll"
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1 },
});
