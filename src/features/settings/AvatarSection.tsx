import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { describeError } from '../../api/describeError';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, avatarApi } from '../../api/avatar';
import { AppButton } from '../../components/AppButton';
import { Avatar } from '../../components/Avatar';
import { ErrorText } from '../../components/ErrorText';
import { useSnackbar } from '../../components/Snackbar';
import { pickFile } from '../../lib/filePicker';
import { meQueryKey, useMe } from '../auth/session';
import { SettingsSection } from './ui';

/** Settings › Account › profile picture (spec 2.1: JPEG / PNG, at most 4 MB). */
export function AvatarSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } catch (failure) {
      setError(describeError(failure).message);
    } finally {
      setBusy(false);
    }
  }

  const change = () =>
    run(async () => {
      const file = await pickFile({ types: AVATAR_TYPES });
      if (!file) return;
      if (!(AVATAR_TYPES as readonly string[]).includes(file.mimeType)) {
        setError(t('avatar.wrongType'));
        return;
      }
      if (file.size !== null && file.size > AVATAR_MAX_BYTES) {
        setError(t('avatar.tooLarge'));
        return;
      }
      const user = await avatarApi.upload({ uri: file.uri, name: file.name, type: file.mimeType });
      queryClient.setQueryData(meQueryKey, user);
      snackbar.show({ message: t('avatar.saved') });
    });

  const remove = () =>
    run(async () => {
      const user = await avatarApi.remove();
      queryClient.setQueryData(meQueryKey, user);
      snackbar.show({ message: t('avatar.removed') });
    });

  return (
    <SettingsSection testID="settings-section-avatar" title={t('avatar.title')}>
      <View style={styles.row}>
        {me.data ? (
          <Avatar name={me.data.displayName} seed={me.data.id} size="xl" testID="avatar-preview" uri={me.data.avatarUrl} />
        ) : null}
        <View style={styles.actions}>
          <AppButton
            testID="avatar-change"
            variant="outline"
            size="sm"
            label={t('avatar.change')}
            busy={busy}
            requiresOnline
            onPress={() => void change()}
          />
          {me.data?.avatarUrl ? (
            <AppButton
              testID="avatar-remove"
              variant="ghost"
              size="sm"
              label={t('avatar.remove')}
              disabled={busy}
              requiresOnline
              onPress={() => void remove()}
            />
          ) : null}
        </View>
      </View>
      <ErrorText testID="avatar-error" message={error} />
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, flexWrap: 'wrap' },
});
