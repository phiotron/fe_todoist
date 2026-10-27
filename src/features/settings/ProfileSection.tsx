import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { accountApi } from '../../api/account';
import { describeError } from '../../api/describeError';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { TextField } from '../../components/TextField';
import { meQueryKey, useMe } from '../auth/session';
import { displayNameError } from '../auth/validation';
import { SettingsSection, SuccessText, useSettingsStyles } from './ui';

interface ProfileErrors {
  form?: string;
  displayName?: string;
}

export function ProfileSection() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const queryClient = useQueryClient();
  const me = useMe();
  // null = not edited yet: show the name from the server.
  const [draft, setDraft] = useState<string | null>(null);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);
  const value = draft ?? me.data?.displayName ?? '';

  async function onSave() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaved(false);
    const message = displayNameError(value);
    if (message) {
      setErrors({ displayName: message });
      inFlight.current = false;
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const user = await accountApi.updateProfile({ displayName: value.trim() });
      queryClient.setQueryData(meQueryKey, user);
      setDraft(null);
      setSaved(true);
    } catch (error) {
      // The typed name stays in the field so the user can retry.
      const view = describeError(error);
      setErrors(view.fields.displayName ? { displayName: view.fields.displayName } : { form: view.message });
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  }

  return (
    <SettingsSection testID="settings-section-profile" title={t('settings.profile.title')}>
      {me.data ? (
        <Text testID="profile-email" style={styles.hint}>
          {t('settings.profile.email', { email: me.data.email })}
        </Text>
      ) : null}
      <TextField
        testID="profile-displayName"
        label={t('settings.profile.displayName')}
        value={value}
        onChangeText={(text) => {
          setDraft(text);
          setSaved(false);
        }}
        autoComplete="name"
        error={errors.displayName}
      />
      <ErrorText testID="profile-error" message={errors.form} />
      <SuccessText testID="profile-saved" text={saved ? t('settings.saved') : undefined} />
      <AppButton
        testID="profile-save"
        label={t('settings.profile.save')}
        busy={saving}
        requiresOnline
        onPress={() => void onSave()}
      />
    </SettingsSection>
  );
}
