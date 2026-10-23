import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NetworkError } from '../../api/errors';
import { colors } from '../../lib/theme';
import { useMe, useSession } from '../auth/session';

/** Temporary M0 home: greeting + sign out. Inbox / Today arrive in M1. */
export function HomeScreen() {
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
      // signOut may reject when clearing the token store fails, but the session is already signed out
      // and the auth guard leaves this screen; there is nothing left to show or retry here.
    } finally {
      signingOutRef.current = false;
      setSigningOut(false);
    }
  }

  let content: ReactNode;
  if (me.data) {
    content = (
      <Text testID="home-greeting" style={styles.greeting}>
        {t('home.greeting', { name: me.data.displayName })}
      </Text>
    );
  } else if (me.isError) {
    content = (
      <Text style={styles.error}>
        {me.error instanceof NetworkError ? t('errors.network') : t('errors.unknown')}
      </Text>
    );
  } else {
    content = <ActivityIndicator />;
  }

  return (
    <View style={styles.screen}>
      {content}
      <Pressable
        testID="home-sign-out"
        accessibilityRole="button"
        disabled={signingOut}
        onPress={onSignOut}
        style={[styles.button, signingOut && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{t('home.signOut')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.background },
  greeting: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 32 },
  error: { color: colors.danger, marginBottom: 32 },
  button: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
});
