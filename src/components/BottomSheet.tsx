import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, shadow, type, useThemedStyles } from '../theme';
import type { Palette } from '../theme/palette';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Custom top row instead of the title (M-Schedule: ✕ · title · Xong). */
  header?: ReactNode;
  children: ReactNode;
  /** Default true = children are wrapped in a ScrollView. Pass false for content that scrolls itself (FlatList, own ScrollView). */
  scroll?: boolean;
  testID?: string;
}

/**
 * .scrim + .sheet: panel from the bottom, radius 20 on top, grab bar; tap the scrim or Back to close.
 * accessibilityViewIsModal sits on the container (not the sheet) so the scrim, a sibling of the sheet, stays reachable.
 */
export function BottomSheet({ visible, onClose, title, header, children, scroll = true, testID = 'bottom-sheet' }: BottomSheetProps) {
  const styles = useThemedStyles(createBottomSheetStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.container} behavior="padding" accessibilityViewIsModal>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          testID={`${testID}-scrim`}
        />
        <View style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]} testID={testID}>
          <View style={styles.grab} />
          {header ??
            (title ? (
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
            ) : null)}
          {scroll ? (
            <ScrollView testID={`${testID}-scroll`} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createBottomSheetStyles(palette: Palette) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    scrim: { backgroundColor: palette.scrim },
    sheet: {
      backgroundColor: palette.bg,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingTop: 12,
      paddingHorizontal: 20,
      maxHeight: '90%',
      ...shadow,
    },
    grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: palette.line2, marginBottom: 14 },
    title: { ...type.sheetTitle, color: palette.ink, marginBottom: 8 },
  });
}
