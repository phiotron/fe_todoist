import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import { emailAddressKey, emailAddressesApi, type EmailAddressResponse, type EmailTarget } from '../../api/emailAddresses';
import { AppButton } from '../../components/AppButton';
import { DialogFrame } from '../../components/DialogFrame';
import { ErrorText } from '../../components/ErrorText';
import { radius, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';

interface EmailAddressDialogProps {
  visible: boolean;
  target: EmailTarget;
  onClose: () => void;
  testID?: string;
}

/**
 * M13a "Email tasks to this project / Inbox" and "Email to this task": shows the user's address for the target with a
 * Copy button (expo-clipboard) and "New address" (asks first; the old address stops working).
 */
export function EmailAddressDialog({ visible, target, onClose, testID = 'email-dialog' }: EmailAddressDialogProps) {
  const styles = useThemedStyles(createEmailAddressDialogStyles);
  const { palette } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = emailAddressKey(target);
  const query = useQuery({
    queryKey: key,
    queryFn: () => emailAddressesApi.get(target),
    enabled: visible,
    // The address only changes when the user asks for a new one (the mutation below writes the cache).
    staleTime: Infinity,
  });
  const regenerate = useMutation({ mutationFn: () => emailAddressesApi.regenerate(target) });
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const address = query.data?.address;

  useEffect(() => {
    if (!visible) {
      setCopied(false);
      setConfirming(false);
      regenerate.reset();
    }
    // Only closing matters here (fresh state on the next open).
  }, [visible]);

  async function onCopy() {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
  }

  function onRegenerate() {
    // mutateAsync: per-call callbacks of mutate are dropped if the dialog unmounts meanwhile (M1 lesson).
    void regenerate.mutateAsync().then(
      (next: EmailAddressResponse) => {
        queryClient.setQueryData(key, next);
        setCopied(false);
        setConfirming(false);
      },
      () => undefined, // shown below from regenerate.error
    );
  }

  const isProject = target.kind === 'project';
  const loadError = query.error ? describeError(query.error).message : undefined;
  const actionError = regenerate.error ? describeError(regenerate.error).message : undefined;

  return (
    <DialogFrame
      visible={visible}
      title={isProject ? t('email.titleProject') : t('email.titleTask')}
      onRequestClose={onClose}
      testID={testID}
    >
      <Text style={styles.hint}>{isProject ? t('email.hintProject') : t('email.hintTask')}</Text>
      {address ? (
        <View style={styles.addressBox}>
          <Text
            selectable
            accessibilityLabel={t('email.address')}
            style={styles.address}
            testID={`${testID}-address`}
          >
            {address}
          </Text>
        </View>
      ) : loadError ? null : (
        <View style={styles.loading} testID={`${testID}-loading`}>
          <ActivityIndicator color={palette.acc} />
          <Text style={styles.hint}>{t('email.loading')}</Text>
        </View>
      )}
      {copied ? (
        <Text style={styles.copied} accessibilityLiveRegion="polite" testID={`${testID}-copied`}>
          {t('email.copied')}
        </Text>
      ) : null}
      {address && isProject ? <Text style={styles.small}>{t('email.syntaxHint')}</Text> : null}
      {address ? <Text style={styles.small}>{t('email.secretHint')}</Text> : null}
      <ErrorText message={loadError ?? actionError} testID={`${testID}-error`} />
      {confirming ? (
        <View testID={`${testID}-confirm`}>
          <Text style={styles.confirmTitle}>{t('email.regenerateTitle')}</Text>
          <Text style={styles.hint}>{t('email.regenerateMessage')}</Text>
          <View style={styles.actions}>
            <AppButton
              variant="outline"
              label={t('common.cancel')}
              onPress={() => setConfirming(false)}
              disabled={regenerate.isPending}
              testID={`${testID}-confirm-cancel`}
            />
            <AppButton
              variant="danger"
              label={t('email.regenerateConfirm')}
              onPress={onRegenerate}
              busy={regenerate.isPending}
              requiresOnline
              testID={`${testID}-confirm-ok`}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {loadError ? (
            <AppButton variant="outline" label={t('common.retry')} onPress={() => void query.refetch()} testID={`${testID}-retry`} />
          ) : (
            <AppButton
              variant="outline"
              label={t('email.regenerate')}
              onPress={() => {
                regenerate.reset();
                setConfirming(true);
              }}
              disabled={!address}
              requiresOnline
              testID={`${testID}-regenerate`}
            />
          )}
          <AppButton label={t('email.copy')} icon="copy" onPress={() => void onCopy()} disabled={!address} testID={`${testID}-copy`} />
          <AppButton variant="ghost" label={t('email.close')} onPress={onClose} testID={`${testID}-close`} />
        </View>
      )}
    </DialogFrame>
  );
}

function createEmailAddressDialogStyles(palette: Palette) {
  return StyleSheet.create({
    hint: { ...type.bodySmall, color: palette.mute },
    small: { ...type.meta, color: palette.mute, marginTop: 8 },
    addressBox: {
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: palette.line2,
      backgroundColor: palette.soft,
    },
    address: { ...type.bodyStrong, color: palette.ink },
    loading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    copied: { ...type.meta, color: palette.acc2, marginTop: 6 },
    confirmTitle: { ...type.bodyStrong, color: palette.ink, marginTop: 12 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 18 },
  });
}
