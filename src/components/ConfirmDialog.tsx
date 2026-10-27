import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { palette, type } from '../theme';
import { AppButton } from './AppButton';
import { DialogFrame } from './DialogFrame';
import { ErrorText } from './ErrorText';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  busy?: boolean;
  error?: string;
  testID?: string;
}

/** BR-11 (M-Confirm): asked before every delete; Cancel never calls the API; the action is red when destructive. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = true,
  busy = false,
  error,
  testID = 'confirm-dialog',
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <DialogFrame visible={visible} title={title} onRequestClose={onCancel} testID={testID}>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <ErrorText message={error} testID={`${testID}-error`} />
      <View style={styles.actions}>
        <AppButton variant="outline" label={t('common.cancel')} onPress={onCancel} disabled={busy} testID={`${testID}-cancel`} />
        <AppButton
          variant={destructive ? 'danger' : 'primary'}
          label={confirmLabel}
          onPress={onConfirm}
          busy={busy}
          requiresOnline
          testID={`${testID}-confirm`}
        />
      </View>
    </DialogFrame>
  );
}

const styles = StyleSheet.create({
  message: { ...type.bodySmall, color: palette.mute },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 18 },
});
