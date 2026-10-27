import { useQuery } from '@tanstack/react-query';
import { twoFactorApi } from '../../api/twoFactor';
import { useSession } from '../auth/session';

export const twoFactorQueryKey = ['twoFactor'] as const;

/** GET me/2fa: { enabled, recoveryCodesLeft } (account page, delete account, two-factor page). */
export function useTwoFactorStatus() {
  const { status } = useSession();
  return useQuery({ queryKey: twoFactorQueryKey, queryFn: twoFactorApi.status, enabled: status === 'signedIn' });
}
