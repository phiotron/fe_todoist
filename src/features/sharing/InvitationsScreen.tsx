import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { QueryStateView } from '../../components/QueryStateView';
import { StateView } from '../../components/StateView';
import { useSnackbar } from '../../components/Snackbar';
import { SubHeader } from '../../components/SubHeader';
import { gutter, radius, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { openAccepted } from './JoinScreen';
import { useAcceptInvitation, useDeclineInvitation, useMyInvitations } from './useSharing';

/** Invitations sent to my email that are still open: Accept / Decline (spec 11.2). Pull to refresh. */
export function InvitationsScreen() {
  const styles = useThemedStyles(createInvitationsStyles);
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const query = useMyInvitations();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const items = query.data ?? [];
  const error = accept.error ?? decline.error;

  return (
    <View testID="invitations-screen" style={styles.fill}>
      <SubHeader title={t('sharing.invitations.title')} onBack={() => router.back()} />
      {query.isPending || query.isError ? (
        <QueryStateView query={query} testID="invitations-state" />
      ) : items.length === 0 ? (
        <StateView tone="ok" icon="mail" title={t('sharing.invitations.empty')} message={t('sharing.invitations.emptyHint')} testID="invitations-empty" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
        >
          {items.map((item) => (
            <View key={item.id} testID={`invitation-${item.id}`} style={styles.card}>
              <Text style={[type.meta, styles.kind]}>
                {item.kind === 'PROJECT' ? t('sharing.invitations.kindProject') : t('sharing.invitations.kindWorkspace')}
              </Text>
              <Text style={[type.bodyStrong, styles.target]}>{item.targetName}</Text>
              <Text style={[type.meta, styles.from]}>{t('sharing.invitations.from', { name: item.invitedByName })}</Text>
              <View style={styles.actions}>
                <AppButton
                  label={t('sharing.invitations.accept')}
                  size="sm"
                  requiresOnline
                  busy={accept.isPending && accept.variables === item.id}
                  onPress={() =>
                    accept.mutate(item.id, {
                      onSuccess: (result) => {
                        snackbar.show({ message: t('sharing.invitations.accepted') });
                        openAccepted(result);
                      },
                    })
                  }
                  testID={`invitation-accept-${item.id}`}
                />
                <AppButton
                  label={t('sharing.invitations.decline')}
                  size="sm"
                  variant="outline"
                  requiresOnline
                  busy={decline.isPending && decline.variables === item.id}
                  onPress={() => decline.mutate(item.id, { onSuccess: () => snackbar.show({ message: t('sharing.invitations.declined') }) })}
                  testID={`invitation-decline-${item.id}`}
                />
              </View>
            </View>
          ))}
          <ErrorText message={error ? describeError(error).message : undefined} testID="invitations-error" />
        </ScrollView>
      )}
    </View>
  );
}

function createInvitationsStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: gutter, paddingBottom: 48, gap: 12 },
    card: { borderWidth: 1, borderColor: palette.line2, borderRadius: radius.card, padding: 16, gap: 4 },
    kind: { color: palette.mute },
    target: { color: palette.ink },
    from: { color: palette.ink2 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  });
}
