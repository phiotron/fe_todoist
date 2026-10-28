import type { MeResponse } from '../../api/auth';

/**
 * Missing M5 fields (older server, or a user cached from AuthResponse) mean "not linked" and
 * "has a password": an unknown password state is left to the server, which answers 409 password-required.
 * Also used by the Account sections that behave differently for Google-only accounts.
 */
export function googleLinkState(user: MeResponse): { linked: boolean; hasPassword: boolean } {
  return {
    linked: user.linkedProviders?.includes('GOOGLE') === true,
    hasPassword: user.hasPassword !== false,
  };
}
