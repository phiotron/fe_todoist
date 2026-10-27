import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { DialogFrame } from '../../components/DialogFrame';
import { Toggle } from '../../components/Toggle';
import { size, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

interface DisplayDialogProps {
  visible: boolean;
  showCompleted: boolean;
  onShowCompletedChange: (value: boolean) => void;
  onClose: () => void;
}

/**
 * Display (M1): only the "Completed tasks" switch, local and off every time the screen opens. M2 replaces it with
 * sort / group / filter saved per account (view-options).
 */
export function DisplayDialog({ visible, showCompleted, onShowCompletedChange, onClose }: DisplayDialogProps) {
  const styles = useThemedStyles(createDisplayDialogStyles);
  const { t } = useTranslation();
  return (
    <DialogFrame visible={visible} title={t('projectScreen.display.title')} onRequestClose={onClose} testID="display-dialog">
      <View style={styles.row}>
        <Text style={[type.body, styles.label]}>{t('projectScreen.display.completedTasks')}</Text>
        <Toggle
          value={showCompleted}
          onChange={onShowCompletedChange}
          label={t('projectScreen.display.completedTasks')}
          testID="display-completed"
        />
      </View>
      <View style={styles.actions}>
        <AppButton label={t('common.done')} onPress={onClose} testID="display-done" />
      </View>
    </DialogFrame>
  );
}

function createDisplayDialogStyles(palette: Palette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: size.listRow },
    label: { flex: 1, color: palette.ink },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  });
}
