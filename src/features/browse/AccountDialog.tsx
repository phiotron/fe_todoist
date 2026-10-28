import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { Avatar } from '../../components/Avatar';
import { DialogFrame } from '../../components/DialogFrame';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useMe, useSession } from '../auth/session';

/** Who is signed in + Sign out (moved from the M0 home screen; M3 adds "sign out of all devices" in Settings). */
export function AccountDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useThemedStyles(createAccountDialogStyles);
  const { t } = useTranslation();
  const { signOut } = useSession();
  const me = useMe();
  const [signingOut, setSigningOut] = useState(false);
  // A ref blocks double presses synchronously; state alone updates one render too late.
  const signingOutRef = useRef(false);

  async function onSignOut() {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // signOut may reject when clearing the token store fails, but the session is already signed out and the
      // auth guard leaves the app; there is nothing left to show or retry here.
    } finally {
      signingOutRef.current = false;
      setSigningOut(false);
    }
  }

  return (
    <DialogFrame visible={visible} title={t('browse.account')} onRequestClose={onClose} testID="account-dialog">
      {me.data ? (
        <View style={styles.who}>
          <Avatar name={me.data.displayName} seed={me.data.id} size="xl" uri={me.data.avatarUrl} />
          <Text testID="account-name" style={styles.name}>
            {me.data.displayName}
          </Text>
          <Text testID="account-email" style={styles.email}>
            {me.data.email}
          </Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        <AppButton variant="outline" label={t('browse.accountClose')} onPress={onClose} disabled={signingOut} testID="account-close" />
        <AppButton variant="danger" label={t('browse.signOut')} onPress={() => void onSignOut()} busy={signingOut} testID="account-sign-out" />
      </View>
    </DialogFrame>
  );
}

function createAccountDialogStyles(palette: Palette) {
  return StyleSheet.create({
    who: { alignItems: 'center', gap: 4, marginBottom: 12 },
    name: { ...type.sheetTitle, color: palette.ink, marginTop: 8 },
    email: { ...type.meta, color: palette.mute },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  });
}
