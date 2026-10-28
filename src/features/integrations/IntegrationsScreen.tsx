import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { authorizedAppsApi, type AuthorizedAppResponse } from '../../api/authorizedApps';
import { describeError } from '../../api/describeError';
import { queryKeys } from '../../api/queryKeys';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { QueryStateView } from '../../components/QueryStateView';
import { StateView } from '../../components/StateView';
import { useSnackbar } from '../../components/Snackbar';
import i18n from '../../i18n';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { scopeLabelKey } from '../oauth/authorizeParams';
import { SettingsPage } from '../settings/SettingsPage';
import { SettingsSection, useSettingsStyles } from '../settings/ui';

/** Date of a consent in the UI language (medium style, e.g. "28 Oct 2026"); the raw text when it is not a date. */
export function formatAuthorizedDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

/**
 * Settings › Integrations (M13c F4): the third-party apps the user allowed (name, what they can do, since when) with a
 * "Revoke" per app. Revoking asks first, then DELETE me/authorized-apps/{clientId} and the list reloads.
 */
export function IntegrationsScreen() {
  const { t } = useTranslation();
  const settingsStyles = useSettingsStyles();
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const query = useQuery({ queryKey: queryKeys.authorizedApps.all, queryFn: authorizedAppsApi.list });
  const [target, setTarget] = useState<AuthorizedAppResponse | null>(null);
  const [error, setError] = useState<string>();
  const revoke = useMutation({ mutationFn: (clientId: string) => authorizedAppsApi.revoke(clientId) });

  function close() {
    setTarget(null);
    setError(undefined);
  }

  function confirmRevoke() {
    if (!target || revoke.isPending) return;
    const app = target;
    revoke
      .mutateAsync(app.clientId)
      .then(() => {
        close();
        snackbar.show({ message: t('integrations.revoked', { name: app.name }) });
      })
      .catch((caught: unknown) => setError(describeError(caught).message))
      .finally(() => void queryClient.invalidateQueries({ queryKey: queryKeys.authorizedApps.all }));
  }

  const apps = query.data;
  return (
    <SettingsPage testID="integrations-screen" title={t('integrations.title')}>
      <Text style={settingsStyles.hint}>{t('integrations.description')}</Text>
      {apps === undefined ? (
        <QueryStateView query={query} testID="integrations-state" />
      ) : apps.length === 0 ? (
        <StateView tone="ok" icon="link" title={t('integrations.empty')} testID="integrations-empty" />
      ) : (
        <SettingsSection testID="integrations-list" title={t('integrations.sectionTitle')}>
          {apps.map((app) => (
            <View key={app.clientId} style={styles.card} testID={`integrations-app-${app.clientId}`}>
              <View style={styles.texts}>
                <Text style={styles.name} numberOfLines={1}>
                  {app.name}
                </Text>
                {app.scopes.map((scope) => {
                  const key = scopeLabelKey(scope);
                  return (
                    <Text key={scope} style={styles.scope}>
                      {key ? t(key) : scope}
                    </Text>
                  );
                })}
                <Text style={styles.meta}>
                  {t('integrations.authorizedOn', { date: formatAuthorizedDate(app.authorizedAt, i18n.language) })}
                </Text>
              </View>
              <AppButton
                testID={`integrations-revoke-${app.clientId}`}
                variant="outline"
                size="sm"
                label={t('integrations.revoke')}
                onPress={() => {
                  setError(undefined);
                  setTarget(app);
                }}
              />
            </View>
          ))}
        </SettingsSection>
      )}
      <ConfirmDialog
        visible={target !== null}
        testID="integrations-revoke-dialog"
        title={t('integrations.revokeTitle', { name: target?.name ?? '' })}
        message={t('integrations.revokeMessage')}
        confirmLabel={t('integrations.revoke')}
        onConfirm={confirmRevoke}
        onCancel={close}
        busy={revoke.isPending}
        error={error}
      />
    </SettingsPage>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.line,
    },
    texts: { flex: 1 },
    name: { ...type.body, fontWeight: '700', color: palette.ink },
    scope: { ...type.meta, color: palette.ink2, marginTop: 2 },
    meta: { ...type.meta, color: palette.mute, marginTop: 6 },
  });
}
