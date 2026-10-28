import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useIsOnline } from '../../lib/useIsOnline';
import { describeGoogleLinkError } from './googleErrors';
import { useSession } from './session';

/**
 * Completes a pending Google link once the user is fully signed in (password, plus the 2FA code when asked)
 * and reports the result in a dialog that survives the navigation that follows.
 * Never throws; does nothing when no link is pending.
 */
export function useFinishGoogleLink(): () => Promise<void> {
  const { t } = useTranslation();
  const { completeGoogleLink } = useSession();
  const isOnline = useIsOnline();
  return useCallback(async () => {
    const link = await completeGoogleLink();
    if (link.type === 'linked') {
      Alert.alert(t('google.linkedTitle'), t('google.linkedMessage'));
    } else if (link.type === 'failed') {
      // The sign-in stands even when linking fails (400 expired linkToken, 409...).
      Alert.alert(t('google.linkFailedTitle'), describeGoogleLinkError(link.error, isOnline));
    }
  }, [completeGoogleLink, isOnline, t]);
}
