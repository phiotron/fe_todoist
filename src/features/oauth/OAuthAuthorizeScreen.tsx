import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../api/errors';
import { describeError } from '../../api/describeError';
import { oauthApi } from '../../api/oauth';
import { queryKeys } from '../../api/queryKeys';
import { AppButton } from '../../components/AppButton';
import { QueryStateView } from '../../components/QueryStateView';
import { StateView } from '../../components/StateView';
import { useSnackbar } from '../../components/Snackbar';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { SettingsPage } from '../settings/SettingsPage';
import { buildDenyUrl, parseAuthorizeParams, scopeLabelKey, type RawParams } from './authorizeParams';

function goHome() {
  router.replace('/');
}

/**
 * Consent screen of a third-party app (M13c F2), opened by `taskly://oauth/authorize?client_id=…&redirect_uri=…&scope=…
 * &state=…&code_challenge=…&code_challenge_method=S256`. The server validates the app, the return address and the scopes
 * (400 → "invalid request", the app is NOT redirected). Allow → POST oauth/authorize → open `redirectUrl`; Deny → open the
 * return address with `error=access_denied`. The user must already be signed in (the (app) layout sends everyone else to
 * the login screen; returning here after login is not built).
 */
export function OAuthAuthorizeScreen({ params }: { params: RawParams }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const snackbar = useSnackbar();
  const parsed = useMemo(() => parseAuthorizeParams(params), [params]);
  const request = parsed.ok ? parsed.request : null;

  const preview = useQuery({
    queryKey: queryKeys.oauthPreview({
      clientId: request?.clientId ?? '',
      redirectUri: request?.redirectUri ?? '',
      scope: request?.scope ?? '',
    }),
    queryFn: () =>
      oauthApi.preview({ clientId: request!.clientId, redirectUri: request!.redirectUri, scope: request!.scope }),
    enabled: request !== null,
    retry: false,
    staleTime: 0,
  });
  const allow = useMutation({ mutationFn: oauthApi.authorize });

  async function open(url: string) {
    try {
      await Linking.openURL(url);
      goHome();
    } catch {
      snackbar.show({ message: t('oauth.openFailed'), tone: 'error' });
    }
  }

  function onAllow() {
    if (!request || allow.isPending) return;
    allow
      .mutateAsync(request)
      .then((response) => open(response.redirectUrl))
      .catch((error: unknown) => snackbar.show({ message: describeError(error).message, tone: 'error' }));
  }

  function onDeny() {
    if (request) void open(buildDenyUrl(request.redirectUri, request.state));
  }

  const invalid = (message: string) => (
    <StateView
      tone="error"
      icon="alert-triangle"
      title={t('oauth.invalidTitle')}
      message={message}
      actionLabel={t('oauth.goHome')}
      onAction={goHome}
      testID="oauth-invalid"
    />
  );

  let body;
  if (!request) {
    body = invalid(t('oauth.invalidLink'));
  } else if (preview.isError && preview.error instanceof ApiError && preview.error.status === 400) {
    body = invalid(t('oauth.invalidServer'));
  } else if (!preview.data) {
    body = <QueryStateView query={preview} testID="oauth-state" />;
  } else {
    body = (
      <View testID="oauth-consent">
        <Text style={styles.heading}>{t('oauth.heading', { app: preview.data.appName })}</Text>
        <Text style={styles.sub}>{t('oauth.scopesTitle')}</Text>
        {preview.data.scopes.map((scope) => {
          const key = scopeLabelKey(scope);
          return (
            <Text key={scope} style={styles.scope} testID={`oauth-scope-${scope}`}>
              {`• ${key ? t(key) : scope}`}
            </Text>
          );
        })}
        <Text style={styles.note}>{t('oauth.redirectNote', { uri: preview.data.redirectUri })}</Text>
        <View style={styles.actions}>
          <AppButton testID="oauth-deny" variant="outline" label={t('oauth.deny')} onPress={onDeny} disabled={allow.isPending} />
          <AppButton testID="oauth-allow" label={t('oauth.allow')} onPress={onAllow} busy={allow.isPending} requiresOnline />
        </View>
      </View>
    );
  }

  return (
    <SettingsPage testID="oauth-authorize-screen" title={t('oauth.title')} onBack={goHome}>
      {body}
    </SettingsPage>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    heading: { ...type.dialogTitle, color: palette.ink, marginTop: 16 },
    sub: { ...type.body, color: palette.ink2, marginTop: 16, marginBottom: 6 },
    scope: { ...type.body, color: palette.ink, paddingVertical: 4 },
    note: { ...type.meta, color: palette.mute, marginTop: 16 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  });
}
