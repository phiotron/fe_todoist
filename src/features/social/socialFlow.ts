import type { SocialProvider } from '../../api/identities';
import { openExternalUrl } from '../../lib/externalBrowser';
import { SOCIAL_CONFIG, type SocialConfig } from '../../lib/socialConfig';
import { newUuid } from '../../lib/uuid';

/**
 * Apple / Facebook sign-in on Android is a web flow (spec M13b): the app opens the provider page in the browser, the
 * provider redirects to the backend, the backend redirects to taskly://oauth/{apple|facebook}?state&idToken|accessToken&name
 * and the route src/app/oauth/[provider].tsx hands the query to takeSocialResult().
 */
export type SocialPurpose = 'signIn' | 'link';

interface PendingFlow {
  provider: SocialProvider;
  purpose: SocialPurpose;
  state: string;
}

/** Memory only: one flow at a time; the random state proves the deep link answers the page this app opened. */
let pending: PendingFlow | null = null;

export function authorizationUrl(provider: SocialProvider, config: SocialConfig, state: string): string | null {
  if (provider === 'APPLE') {
    if (!config.appleServiceId || !config.appleRedirectUri) return null;
    return (
      'https://appleid.apple.com/auth/authorize' +
      `?response_type=${encodeURIComponent('code id_token')}` +
      '&response_mode=form_post' +
      `&client_id=${encodeURIComponent(config.appleServiceId)}` +
      `&redirect_uri=${encodeURIComponent(config.appleRedirectUri)}` +
      `&scope=${encodeURIComponent('name email')}` +
      `&state=${encodeURIComponent(state)}`
    );
  }
  if (!config.facebookAppId || !config.facebookRedirectUri) return null;
  return (
    'https://www.facebook.com/v19.0/dialog/oauth' +
    `?client_id=${encodeURIComponent(config.facebookAppId)}` +
    `&redirect_uri=${encodeURIComponent(config.facebookRedirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    '&response_type=code' +
    '&scope=email'
  );
}

export type BeginResult = 'opened' | 'notConfigured' | 'failed';

/** Opens the provider page. 'notConfigured' = the build has no Services ID / app ID (nothing is opened). */
export async function beginSocialFlow(
  provider: SocialProvider,
  purpose: SocialPurpose,
  config: SocialConfig = SOCIAL_CONFIG,
): Promise<BeginResult> {
  const state = newUuid();
  const url = authorizationUrl(provider, config, state);
  if (url === null) return 'notConfigured';
  pending = { provider, purpose, state };
  const opened = await openExternalUrl(url);
  if (!opened) {
    pending = null;
    return 'failed';
  }
  return 'opened';
}

/** The query of the deep link, as expo-router hands it over. */
export interface SocialCallbackParams {
  state?: string;
  idToken?: string;
  accessToken?: string;
  name?: string;
  error?: string;
}

export type SocialResult =
  | { type: 'success'; provider: SocialProvider; purpose: SocialPurpose; token: string; name: string | null }
  | { type: 'cancelled'; purpose: SocialPurpose }
  /** stateMismatch: no flow of this app is waiting (app restarted, link opened twice or forged) — nothing is sent. */
  | { type: 'error'; reason: 'stateMismatch' | 'failed' };

/** Consumes the pending flow: a deep link is accepted once, and only with the state this app generated. */
export function takeSocialResult(provider: SocialProvider, params: SocialCallbackParams): SocialResult {
  const flow = pending;
  pending = null;
  if (!flow || flow.provider !== provider || !params.state || params.state !== flow.state) {
    return { type: 'error', reason: 'stateMismatch' };
  }
  if (params.error === 'cancelled') return { type: 'cancelled', purpose: flow.purpose };
  const token = provider === 'APPLE' ? params.idToken : params.accessToken;
  if (params.error || !token) return { type: 'error', reason: 'failed' };
  return { type: 'success', provider, purpose: flow.purpose, token, name: params.name?.trim() || null };
}

/** For tests and sign-out. */
export function forgetSocialFlow(): void {
  pending = null;
}

export function providerFromRoute(value: string | undefined): SocialProvider | null {
  if (value === 'apple') return 'APPLE';
  if (value === 'facebook') return 'FACEBOOK';
  return null;
}
