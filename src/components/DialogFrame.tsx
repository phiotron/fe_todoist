import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette, radius, shadow, type } from '../theme';

interface DialogFrameProps {
  visible: boolean;
  title: string;
  onRequestClose: () => void;
  children: ReactNode;
  testID?: string;
}

/** .dlg over a light scrim (M-Confirm): radius 16, padding 20, 18/700 title; Back = onRequestClose. */
export function DialogFrame({ visible, title, onRequestClose, children, testID }: DialogFrameProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <View testID={testID} style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: palette.scrimLight, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: palette.bg,
    borderRadius: radius.dialog,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 20,
    maxHeight: '85%',
    ...shadow,
  },
  title: { ...type.dialogTitle, color: palette.ink, marginBottom: 8 },
});
