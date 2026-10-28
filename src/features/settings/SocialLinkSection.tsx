import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { ApiError } from '../../api/errors';
import { identitiesApi, linkedProvidersOf, type SocialProvider } from '../../api/identities';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { useIsOnline } from '../../lib/useIsOnline';
import { meQueryKey, useMe } from '../auth/session';
import { describeBeginFailure, describeSocialUnlinkError, providerName } from '../social/socialErrors';
import { beginSocialFlow } from '../social/socialFlow';
import { SettingsSection, SuccessText, useSettingsStyles } from './ui';

type Message = { kind: 'error' | 'info'; text: string };

/**
 * Settings > Account > "Link Apple" / "Link Facebook" (M13b), same shape as GoogleLinkSection. Linking opens the browser and
 * the answer comes back through the deep link route (src/app/oauth/[provider].tsx), which links and returns here.
 */
export function SocialLinkSection({ provider }: { provider: SocialProvider }) {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const me = useMe();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  // Synchronous lock: state updates are async, so two quick presses could both pass a state check.
  const inFlight = useRef(false);
  const key = provider.toLowerCase();
  const name = providerName(provider);

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
    run(async () => {
      const result = await beginSocialFlow(provider, 'link');
      return result === 'opened'
        ? { kind: 'info', text: t('social.settings.opening') }
        : { kind: 'error', text: describeBeginFailure(provider, result) };
    });

  const onUnlink = () =>
    run(async (): Promise<Message | null> => {
      try {
        await identitiesApi.unlinkSocial(provider);
      } catch (error) {
        // 404 = not linked any more (stale screen): the goal is reached, just refresh the status.
        const alreadyUnlinked = error instanceof ApiError && error.status === 404;
        if (!alreadyUnlinked) return { kind: 'error', text: describeSocialUnlinkError(provider, error, isOnline) };
      }
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
      return { kind: 'info', text: t('social.settings.unlinkSuccess', { provider: name }) };
    });

  // The Account screen already shows the profile's own loading / error state.
  if (!me.data) return null;

  const linked = linkedProvidersOf(me.data).includes(provider);
  const hasPassword = me.data.hasPassword !== false;

  return (
    <SettingsSection testID={`settings-section-${key}`} title={t('social.settings.title', { provider: name })}>
      <View style={styles.row}>
        <Text testID={`settings-${key}-status`} style={styles.rowLabel}>
          {linked ? t('social.settings.linked', { provider: name }) : t('social.settings.notLinked')}
        </Text>
        {linked ? (
          <AppButton
            testID={`settings-${key}-unlink`}
            variant="outline"
            size="sm"
            label={t('social.settings.unlink')}
            busy={busy}
            disabled={!hasPassword}
            requiresOnline
            onPress={() => void onUnlink()}
          />
        ) : (
          <AppButton
            testID={`settings-${key}-link`}
            variant="outline"
            size="sm"
            label={t('social.settings.link', { provider: name })}
            busy={busy}
            requiresOnline
            onPress={() => void onLink()}
          />
        )}
      </View>
      {linked && !hasPassword ? (
        <Text testID={`settings-${key}-need-password`} style={styles.hint}>
          {t('social.settings.needPassword', { provider: name })}
        </Text>
      ) : null}
      {message?.kind === 'error' ? <ErrorText testID={`settings-${key}-message`} message={message.text} /> : null}
      {message?.kind === 'info' ? <SuccessText testID={`settings-${key}-message`} text={message.text} /> : null}
    </SettingsSection>
  );
}
