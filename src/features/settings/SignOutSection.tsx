import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppButton } from '../../components/AppButton';
import { useTheme } from '../../theme';
import { useSession } from '../auth/session';
import { SettingsSection } from './ui';

/** "Log out" of M-Settings: a full-width outline button with the danger text colour. */
export function SignOutSection() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  // A ref blocks double presses synchronously; state alone updates one render too late.
  const inFlight = useRef(false);

  async function onSignOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // signOut may reject when clearing the token store fails; the session is signed out anyway
      // and the (app) guard leaves this screen.
    } finally {
      inFlight.current = false;
      setSigningOut(false);
    }
  }

  return (
    <SettingsSection testID="settings-section-signOut">
      <AppButton
        testID="settings-sign-out"
        variant="outline"
        color={palette.warn}
        full
        label={t('settings.signOut.button')}
        busy={signingOut}
        onPress={() => void onSignOut()}
      />
    </SettingsSection>
  );
}
