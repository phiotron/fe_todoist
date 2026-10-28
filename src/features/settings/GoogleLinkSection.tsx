import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { ApiError } from '../../api/errors';
import { identitiesApi } from '../../api/identities';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { getGoogleIdToken } from '../../lib/googleSignIn';
import { useIsOnline } from '../../lib/useIsOnline';
import { describeGoogleLinkError, describeGoogleSignInFailure, describeGoogleUnlinkError } from '../auth/googleErrors';
import { meQueryKey, useMe } from '../auth/session';
import { googleLinkState } from './googleLinkState';
import { SettingsSection, SuccessText, useSettingsStyles } from './ui';

type Message = { kind: 'error' | 'info'; text: string };

/** Settings > Account > "Link Google": link with a fresh ID token, or unlink (spec 12.1). */
export function GoogleLinkSection() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const me = useMe();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  // Synchronous lock: state updates are async, so two quick presses could both pass a state check.
  const inFlight = useRef(false);

  async function run(action: () => Promise<Message | null>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const onLink = () =>
    run(async (): Promise<Message | null> => {
      const result = await getGoogleIdToken();
      // Cancelled in the account picker: no request, nothing changes.
      if (result.type === 'cancelled') return null;
      if (result.type === 'error') return { kind: 'error', text: describeGoogleSignInFailure(result.reason) };
      try {
        await identitiesApi.linkGoogle({ idToken: result.idToken });
      } catch (error) {
        return { kind: 'error', text: describeGoogleLinkError(error, isOnline) };
      }
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
      return { kind: 'info', text: t('google.settings.linkSuccess') };
    });

  const onUnlink = () =>
    run(async (): Promise<Message | null> => {
      try {
        await identitiesApi.unlinkGoogle();
      } catch (error) {
        // 404 = not linked any more (stale screen): the goal is reached, just refresh the status.
        const alreadyUnlinked = error instanceof ApiError && error.status === 404;
        if (!alreadyUnlinked) return { kind: 'error', text: describeGoogleUnlinkError(error, isOnline) };
      }
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
      return { kind: 'info', text: t('google.settings.unlinkSuccess') };
    });

  // The Account screen already shows the profile's own loading / error state.
  if (!me.data) return null;

  const { linked, hasPassword } = googleLinkState(me.data);

  return (
    <SettingsSection testID="settings-section-google" title={t('google.settings.title')}>
      {/* Design `.lrow`: status on the left, the action on the right. */}
      <View style={styles.row}>
        <Text testID="settings-google-status" style={styles.rowLabel}>
          {linked ? t('google.settings.linked') : t('google.settings.notLinked')}
        </Text>
        {linked ? (
          <AppButton
            testID="settings-google-unlink"
            variant="outline"
            size="sm"
            label={t('google.settings.unlink')}
            busy={busy}
            disabled={!hasPassword}
            requiresOnline
            onPress={() => void onUnlink()}
          />
        ) : (
          <AppButton
            testID="settings-google-link"
            variant="outline"
            size="sm"
            label={t('google.settings.link')}
            busy={busy}
            requiresOnline
            onPress={() => void onLink()}
          />
        )}
      </View>
      {linked && !hasPassword ? (
        <Text testID="settings-google-need-password" style={styles.hint}>
          {t('google.settings.needPassword')}
        </Text>
      ) : null}
      {message?.kind === 'error' ? <ErrorText testID="settings-google-message" message={message.text} /> : null}
      {message?.kind === 'info' ? <SuccessText testID="settings-google-message" text={message.text} /> : null}
    </SettingsSection>
  );
}
